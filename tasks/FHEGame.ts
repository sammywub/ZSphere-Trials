import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Prints the ZSphereGame address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const deployment = await deployments.get("ZSphereGame");

  console.log("ZSphereGame address is " + deployment.address);
});

task("task:start", "Starts the game for the connected account")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("ZSphereGame");
    console.log(`ZSphereGame: ${deployment.address}`);

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("ZSphereGame", deployment.address);

    const tx = await contract.connect(signer).startGame();
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:play", "Plays a round with encrypted big ball and small ball choices")
  .addOptionalParam("address", "Optionally specify the contract address")
  .addParam("big", "Big ball index (0-3)")
  .addParam("small", "Small ball index (1-3)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const big = parseInt(taskArguments.big);
    const small = parseInt(taskArguments.small);
    if (!Number.isInteger(big) || !Number.isInteger(small)) {
      throw new Error(`Arguments --big and --small must be integers`);
    }

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("ZSphereGame");
    console.log(`ZSphereGame: ${deployment.address}`);

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("ZSphereGame", deployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add32(big)
      .add32(small)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .playRound(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    const state = await contract.getPlayerState(signer.address);
    const score = await fhevm.userDecryptEuint(FhevmType.euint32, state[0], deployment.address, signer);
    const outcome = await fhevm.userDecryptEuint(FhevmType.euint32, state[3], deployment.address, signer);
    console.log(`Updated score: ${score}`);
    console.log(`Outcome (1=win,0=lose): ${outcome}`);
  });

task("task:decrypt-state", "Decrypts the caller game state")
  .addOptionalParam("address", "Optionally specify the contract address")
  .addOptionalParam("player", "Player address whose state will be decrypted")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("ZSphereGame");
    console.log(`ZSphereGame: ${deployment.address}`);

    const [signer] = await ethers.getSigners();
    const targetPlayer: string = (taskArguments.player as string) || signer.address;

    const contract = await ethers.getContractAt("ZSphereGame", deployment.address);
    const state = await contract.getPlayerState(targetPlayer);

    const decryptedScore = await fhevm.userDecryptEuint(FhevmType.euint32, state[0], deployment.address, signer);
    const decryptedBigBall = await fhevm.userDecryptEuint(FhevmType.euint32, state[1], deployment.address, signer);
    const decryptedSmallBall = await fhevm.userDecryptEuint(FhevmType.euint32, state[2], deployment.address, signer);
    const decryptedOutcome = await fhevm.userDecryptEuint(FhevmType.euint32, state[3], deployment.address, signer);

    console.log(`Rounds played: ${state[4].toString()}`);
    console.log(`Started       : ${state[5]}`);
    console.log(`Score         : ${decryptedScore}`);
    console.log(`Last big ball : ${decryptedBigBall}`);
    console.log(`Last small ball: ${decryptedSmallBall}`);
    console.log(`Outcome (1=win,0=lose): ${decryptedOutcome}`);
  });
