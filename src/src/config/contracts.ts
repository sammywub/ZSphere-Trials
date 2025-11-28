export const SEPOLIA_CHAIN_ID = 11155111;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Replace with the deployed ZSphereGame address on Sepolia after deployment.
export const CONTRACT_ADDRESS = ZERO_ADDRESS;
export const CONTRACT_READY = CONTRACT_ADDRESS !== ZERO_ADDRESS;

// Generated ABI from ZSphereGame contract
export const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "euint32",
        "name": "encryptedScore",
        "type": "bytes32"
      }
    ],
    "name": "GameStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "euint32",
        "name": "newScore",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "euint32",
        "name": "bigBallChoice",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "euint32",
        "name": "smallBallChoice",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "euint32",
        "name": "encryptedOutcome",
        "type": "bytes32"
      }
    ],
    "name": "RoundPlayed",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "getEncryptedAnswer",
    "outputs": [
      {
        "internalType": "euint32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "getPlayerState",
    "outputs": [
      {
        "internalType": "euint32",
        "name": "score",
        "type": "bytes32"
      },
      {
        "internalType": "euint32",
        "name": "lastBigBall",
        "type": "bytes32"
      },
      {
        "internalType": "euint32",
        "name": "lastSmallBall",
        "type": "bytes32"
      },
      {
        "internalType": "euint32",
        "name": "lastOutcome",
        "type": "bytes32"
      },
      {
        "internalType": "uint32",
        "name": "roundsPlayed",
        "type": "uint32"
      },
      {
        "internalType": "bool",
        "name": "started",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "externalEuint32",
        "name": "bigBallChoiceEncrypted",
        "type": "bytes32"
      },
      {
        "internalType": "externalEuint32",
        "name": "smallBallChoiceEncrypted",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "playRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "startGame",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
