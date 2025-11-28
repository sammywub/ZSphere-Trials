import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { deployments, ethers, fhevm } from "hardhat";

type Signers = {
  player: HardhatEthersSigner;
};

describe("ZSphereGameSepolia", function () {
  let signers: Signers;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    const deployment = await deployments.get("ZSphereGame");
    contractAddress = deployment.address;

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { player: ethSigners[0] };
  });

  beforeEach(async function () {
    step = 0;
    steps = 0;
  });

  it("plays and decrypts a round", async function () {
    steps = 10;
    this.timeout(5 * 40000);

    const contract = await ethers.getContractAt("ZSphereGame", contractAddress);

    progress("Initializing FHEVM CLI helpers...");
    await fhevm.initializeCLIApi();

    progress("Reading player state...");
    let state = await contract.getPlayerState(signers.player.address);
    if (!state[5]) {
      progress("Starting game for player...");
      const startTx = await contract.connect(signers.player).startGame();
      await startTx.wait();
      state = await contract.getPlayerState(signers.player.address);
    }

    progress("Encrypting guess (big 0 -> small 1)...");
    const encryptedGuess = await fhevm
      .createEncryptedInput(contractAddress, signers.player.address)
      .add32(0)
      .add32(1)
      .encrypt();

    progress("Submitting playRound transaction...");
    const playTx = await contract
      .connect(signers.player)
      .playRound(encryptedGuess.handles[0], encryptedGuess.handles[1], encryptedGuess.inputProof);
    await playTx.wait();

    progress("Fetching encrypted state...");
    const updatedState = await contract.getPlayerState(signers.player.address);
    expect(updatedState[0]).to.not.eq(ethers.ZeroHash);

    progress("Decrypting score...");
    const decryptedScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      updatedState[0],
      contractAddress,
      signers.player,
    );
    progress(`Score after play: ${decryptedScore}`);

    progress("Decrypting outcome...");
    const decryptedOutcome = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      updatedState[3],
      contractAddress,
      signers.player,
    );
    progress(`Outcome (1=win,0=lose): ${decryptedOutcome}`);

    expect(decryptedScore).to.be.greaterThan(0);
  });
});
