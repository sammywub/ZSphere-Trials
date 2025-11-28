import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { ZSphereGame, ZSphereGame__factory } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ZSphereGame")) as ZSphereGame__factory;
  const contract = (await factory.deploy()) as ZSphereGame;
  const address = await contract.getAddress();

  return { contract, address };
}

async function decryptState(
  contract: ZSphereGame,
  contractAddress: string,
  signer: HardhatEthersSigner,
  player: string,
) {
  const state = await contract.getPlayerState(player);

  const score = await fhevm.userDecryptEuint(FhevmType.euint32, state[0], contractAddress, signer);
  const lastBig = await fhevm.userDecryptEuint(FhevmType.euint32, state[1], contractAddress, signer);
  const lastSmall = await fhevm.userDecryptEuint(FhevmType.euint32, state[2], contractAddress, signer);
  const outcome = await fhevm.userDecryptEuint(FhevmType.euint32, state[3], contractAddress, signer);

  return {
    score,
    lastBig,
    lastSmall,
    outcome,
    rounds: state[4],
    started: state[5],
  };
}

describe("ZSphereGame (local mock)", function () {
  let signers: Signers;
  let contract: ZSphereGame;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0], bob: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, address: contractAddress } = await deployFixture());
    await contract.connect(signers.alice).startGame();
  });

  it("initializes player with encrypted score of 100", async function () {
    const state = await decryptState(contract, contractAddress, signers.alice, signers.alice.address);

    expect(state.started).to.eq(true);
    expect(state.rounds).to.eq(0);
    expect(state.score).to.eq(100);
  });

  it("adds 10 points for a correct pick and keeps encrypted path", async function () {
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(0)
      .add32(1) // winning: big 0 -> small 1
      .encrypt();

    await contract
      .connect(signers.alice)
      .playRound(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);

    const state = await decryptState(contract, contractAddress, signers.alice, signers.alice.address);

    expect(state.score).to.eq(110);
    expect(state.outcome).to.eq(1);
    expect(state.lastBig).to.eq(0);
    expect(state.lastSmall).to.eq(1);
    expect(state.rounds).to.eq(1);
  });

  it("subtracts 10 points for a wrong pick and never goes below zero", async function () {
    const makeWrongPick = async () => {
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(3) // winning option for big 3 is 2, so choose wrong (1)
        .add32(1)
        .encrypt();

      await contract
        .connect(signers.alice)
        .playRound(input.handles[0], input.handles[1], input.inputProof);
    };

    for (let i = 0; i < 11; i++) {
      await makeWrongPick();
    }

    const state = await decryptState(contract, contractAddress, signers.alice, signers.alice.address);

    expect(state.score).to.eq(0);
    expect(state.outcome).to.eq(0);
    expect(state.lastBig).to.eq(3);
    expect(state.lastSmall).to.eq(1);
    expect(state.rounds).to.eq(11);
  });
});
