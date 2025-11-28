# ZSphere Trials

ZSphere Trials is a fully homomorphic encrypted guessing game that keeps every player action private on-chain. Each player begins with 100 encrypted points, chooses among four big spheres and hidden small spheres, and wins or loses 10 points per round without ever revealing their choices or score in plaintext. The frontend, contract, and relayer flow are wired to demonstrate end-to-end private computation on Ethereum testnet.

## Why it matters

- **Full privacy with FHE**: Scores, guesses, and outcomes stay encrypted at rest and during computation thanks to Zama FHEVM types.
- **Deterministic fairness**: Winning paths (1, 3, 2, 2) are stored on-chain as encrypted constants; correctness is verified without leakage.
- **User-owned decryption**: Players sign EIP-712 payloads to request decryption through the relayer; only the caller can reveal their state.
- **Simple UX for encrypted flows**: Reads use viem, writes use ethers, and RainbowKit handles wallet connectivity on Sepolia.
- **Production-minded stack**: Hardhat + hardhat-deploy for repeatable deployments, typed tasks for CLI play, and React + Vite for the UI.

## Gameplay loop

1. Connect a wallet on Sepolia.
2. Start the game to mint an encrypted 100-point balance.
3. Choose a big sphere (0–3) and one of its three small spheres (1–3); the pair is encrypted client-side.
4. Submit the encrypted guess; the contract updates the encrypted score with +10 or -10 (floored at zero).
5. Optionally decrypt your state (score, last path, outcome) by signing the relayer request; plaintext stays off-chain.

## Problems solved

- **On-chain game privacy**: Demonstrates a pattern for keeping game state secret while preserving deterministic rules.
- **Leak-free validation**: Correct paths are validated homomorphically; no hints or intermediate values leak from storage or events.
- **User-controlled reveals**: Players choose when to decrypt, preventing passive observers from tracking performance.
- **Reusable encrypted UX**: Shows how to pair ethers writes with viem reads and relayer-based decryption for other FHEVM apps.

## Key features

- Encrypted scoring with configurable reward/penalty (+/-10, clamped at zero).
- Four-sphere puzzle with immutable encrypted answers (1, 3, 2, 2).
- Hardhat tasks to start, play, decrypt, and fetch addresses directly from deployments.
- React UI that visualizes encrypted handles, tracks rounds, and surfaces decrypted values only after user approval.
- Sepolia-ready configuration with generated ABI copied from `deployments/sepolia`.

## Architecture

- **Smart contract (`contracts/ZSphereGame.sol`)**: Implements the encrypted game using Zama FHEVM types (`euint32`, `ebool`), explicit address parameters for view functions, and internal sharing of encrypted state per player.
- **Deployment (`deploy/deploy.ts`)**: hardhat-deploy script that logs deployed addresses; relies on named `deployer` and private key configuration.
- **Tasks (`tasks/*.ts`)**: CLI flows for starting the game, submitting encrypted guesses, decrypting state, and printing addresses; uses the FHEVM CLI API for encryption/decryption during tests or scripts.
- **Frontend (`src/src/*`)**: React + Vite app; viem for reads, ethers for writes; RainbowKit/Wagmi for wallet UX; Zama relayer SDK for generating EIP-712 signatures and decrypting user state. Contract address and ABI live in `src/src/config/contracts.ts`.
- **Docs (`docs/`)**: FHE contract and relayer references for Zama integrations.

## Tech stack

- **Blockchain**: Hardhat, hardhat-deploy, TypeScript-based scripts, ethers v6.
- **FHE**: `@fhevm/solidity`, Zama Ethereum config, FHEVM Hardhat plugin, Zama relayer SDK.
- **Frontend**: React 19 + Vite + TypeScript, RainbowKit/Wagmi, viem (reads), ethers (writes).
- **Quality**: eslint, TypeScript project refs, coverage scripts, and typed tasks.

## Project structure

```
ZSphere-Trials/
├── contracts/          # FHEVM smart contracts (ZSphereGame)
├── deploy/             # hardhat-deploy scripts
├── tasks/              # Hardhat tasks for start/play/decrypt/address
├── test/               # Unit/integration tests
├── docs/               # Zama FHEVM and relayer notes
├── src/                # Frontend app (React + Vite)
├── deployments/        # Generated deployment artifacts (copy ABI from here)
└── hardhat.config.ts   # Hardhat configuration
```

## Setup and usage

### Prerequisites

- Node.js 20+
- npm (project uses npm; no package.json changes are required)

### Install dependencies (root)

```bash
npm install
```

### Environment variables (root)

Create `.env` in the project root:

```
PRIVATE_KEY=your_private_key_without_0x
INFURA_API_KEY=your_infura_api_key
ETHERSCAN_API_KEY=optional_for_verification
```

Use a private key (no mnemonic). The deployer account should hold Sepolia ETH.

### Compile, test, and coverage

```bash
npm run compile
npm run test
npm run coverage   # optional, generates coverage data
```

### Local development

```bash
# Start a local FHEVM-ready Hardhat node
npx hardhat node
# Deploy locally
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

After deployment, copy the generated ABI from `deployments/sepolia/ZSphereGame.json` into
`src/src/config/contracts.ts`, and set `CONTRACT_ADDRESS` to the deployed address. The frontend must not rely on
environment variables, so keep the address/ABI in code.

### Hardhat tasks (Sepolia examples)

```bash
npx hardhat task:address --network sepolia
npx hardhat task:start --network sepolia
npx hardhat task:play --network sepolia --big 0 --small 1
npx hardhat task:decrypt-state --network sepolia
```

### Frontend

```bash
cd src
npm install
npm run dev        # start Vite dev server
npm run build      # production build
npm run preview    # preview the build
```

Requirements:
- Wallet must be on Sepolia.
- Contract address/ABI must be set in `src/src/config/contracts.ts` and sourced from `deployments/sepolia`.
- Reads use viem; writes use ethers; no frontend environment variables or local storage are used.

## Security and privacy notes

- Contract view methods accept explicit player addresses to avoid `msg.sender` reads.
- Encrypted answers and reward/penalty values are whitelisted to the contract with `FHE.allowThis`.
- Decryption is gated by user-signed EIP-712 messages; plaintext is only returned to the requesting wallet.
- Frontend never handles unencrypted state unless the user explicitly decrypts it.

## Roadmap

- Extend game modes (variable rewards, streak bonuses, or time-limited rounds).
- Leaderboard with opt-in decrypted submissions while preserving per-round privacy.
- Multi-chain testnet support and CI-driven deployment artifacts for frontend sync.
- Additional relayer UX: progress indicators, retry/backoff, and richer error messaging.
- Gas/latency profiling for FHE operations and selective batching of encrypted inputs.

## License

BSD-3-Clause-Clear. See `LICENSE` for details.
