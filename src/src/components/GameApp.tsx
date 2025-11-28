import { useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CONTRACT_READY, SEPOLIA_CHAIN_ID } from '../config/contracts';
import '../styles/GameApp.css';

type PlayerState = readonly [string, string, string, string, bigint, boolean];

type DecryptedState = {
  score?: number;
  bigBall?: number;
  smallBall?: number;
  outcome?: number;
};

const BIG_BALLS = [
  { id: 0, label: 'Sphere One', accent: '#7c3aed' },
  { id: 1, label: 'Sphere Two', accent: '#2563eb' },
  { id: 2, label: 'Sphere Three', accent: '#0ea5e9' },
  { id: 3, label: 'Sphere Four', accent: '#22c55e' },
];

const SMALL_BALLS = [1, 2, 3];

function formatHandle(value?: string) {
  if (!value) return '—';
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function GameApp() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [selectedBigBall, setSelectedBigBall] = useState<number | null>(null);
  const [selectedSmallBall, setSelectedSmallBall] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedState, setDecryptedState] = useState<DecryptedState | undefined>();
  const [statusMessage, setStatusMessage] = useState<string>('');

  const contractReady = CONTRACT_READY;

  const { data, refetch, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPlayerState',
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address) && chainId === SEPOLIA_CHAIN_ID && contractReady,
    },
  });

  const playerState = useMemo(() => {
    if (!data) return undefined;
    return data as PlayerState;
  }, [data]);

  const hasStarted = playerState ? playerState[5] : false;
  const roundsPlayed = playerState ? Number(playerState[4]) : 0;
  const encryptedScore = playerState ? (playerState[0] as string) : undefined;
  const encryptedBigBall = playerState ? (playerState[1] as string) : undefined;
  const encryptedSmallBall = playerState ? (playerState[2] as string) : undefined;
  const encryptedOutcome = playerState ? (playerState[3] as string) : undefined;

  useEffect(() => {
    setDecryptedState(undefined);
  }, [address, playerState?.[4]]);

  const handleStartGame = async () => {
    if (!contractReady) {
      setStatusMessage('Deploy the contract on Sepolia and set the address in config.');
      return;
    }
    if (!address) {
      setStatusMessage('Connect your wallet to begin.');
      return;
    }
    if (!signerPromise) {
      setStatusMessage('Waiting for signer.');
      return;
    }

    setIsStarting(true);
    setStatusMessage('Submitting start transaction...');

    try {
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.startGame();
      await tx.wait();
      setStatusMessage('Game started with 100 encrypted points.');
      await refetch();
    } catch (error) {
      console.error(error);
      setStatusMessage('Failed to start game.');
    } finally {
      setIsStarting(false);
    }
  };

  const handlePlayRound = async () => {
    if (!contractReady) {
      setStatusMessage('Deploy the contract on Sepolia and set the address in config.');
      return;
    }
    if (!address || selectedBigBall === null || selectedSmallBall === null) {
      setStatusMessage('Pick a big ball and a small ball first.');
      return;
    }
    if (!instance) {
      setStatusMessage('Encryption service is still loading.');
      return;
    }
    if (!signerPromise) {
      setStatusMessage('Waiting for signer.');
      return;
    }

    setIsPlaying(true);
    setStatusMessage('Encrypting your choice...');

    try {
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.add32(selectedBigBall);
      input.add32(selectedSmallBall);
      const encryptedInput = await input.encrypt();

      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.playRound(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      await tx.wait();

      setStatusMessage('Round submitted. Encrypted score updated.');
      setDecryptedState(undefined);
      await refetch();
    } catch (error) {
      console.error(error);
      setStatusMessage('Failed to submit your encrypted path.');
    } finally {
      setIsPlaying(false);
    }
  };

  const handleDecrypt = async () => {
    if (!contractReady) {
      setStatusMessage('Deploy the contract on Sepolia and set the address in config.');
      return;
    }
    if (!instance || !address || !playerState || !signerPromise) {
      setStatusMessage('Missing requirements to decrypt.');
      return;
    }

    setIsDecrypting(true);
    setStatusMessage('Preparing decryption request...');

    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        { handle: playerState[0], contractAddress: CONTRACT_ADDRESS },
        { handle: playerState[1], contractAddress: CONTRACT_ADDRESS },
        { handle: playerState[2], contractAddress: CONTRACT_ADDRESS },
        { handle: playerState[3], contractAddress: CONTRACT_ADDRESS },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      setDecryptedState({
        score: Number(result[playerState[0] as string] || 0),
        bigBall: Number(result[playerState[1] as string] || 0),
        smallBall: Number(result[playerState[2] as string] || 0),
        outcome: Number(result[playerState[3] as string] || 0),
      });
      setStatusMessage('Decrypted your private state.');
    } catch (error) {
      console.error(error);
      setStatusMessage('Unable to decrypt. Please try again.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const selectionReady = selectedBigBall !== null && selectedSmallBall !== null;
  const isWrongNetwork = chainId !== SEPOLIA_CHAIN_ID && isConnected;

  return (
    <div className="game-layout">
      <section className="game-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Encrypted balance</p>
            <h2 className="panel-title">Your score</h2>
          </div>
          <div className="pill">Rounds played: {roundsPlayed}</div>
        </div>

        {!contractReady && (
          <div className="callout warning">
            <p>Deploy ZSphereGame on Sepolia and update CONTRACT_ADDRESS in src/config/contracts.ts.</p>
          </div>
        )}

        {!isConnected && (
          <div className="callout">
            <p>Connect your wallet to start the ZSphere trials.</p>
          </div>
        )}

        {isWrongNetwork && (
          <div className="callout warning">
            <p>Please switch to the Sepolia network to play.</p>
          </div>
        )}

        {zamaError && (
          <div className="callout warning">
            <p>{zamaError}</p>
          </div>
        )}

        <div className="score-card">
          <div className="score-row">
            <div>
              <p className="label">Encrypted score</p>
              <p className="handle">{formatHandle(encryptedScore)}</p>
            </div>
            <div>
              <p className="label">Last big ball</p>
              <p className="handle">{formatHandle(encryptedBigBall)}</p>
            </div>
            <div>
              <p className="label">Last small ball</p>
              <p className="handle">{formatHandle(encryptedSmallBall)}</p>
            </div>
            <div>
              <p className="label">Round result</p>
              <p className="handle">{formatHandle(encryptedOutcome)}</p>
            </div>
          </div>

          <div className="score-actions">
            {!hasStarted ? (
              <button
                className="primary"
                disabled={isStarting || isWrongNetwork || zamaLoading || !isConnected || !contractReady}
                onClick={handleStartGame}
              >
                {isStarting ? 'Starting...' : 'Start with 100 points'}
              </button>
            ) : (
              <div className="decrypt-row">
                <button
                  className="secondary"
                  disabled={isDecrypting || zamaLoading || isWrongNetwork || !isConnected || isFetching || !contractReady}
                  onClick={handleDecrypt}
                >
                  {isDecrypting ? 'Decrypting...' : 'Decrypt my state'}
                </button>
                {decryptedState && (
                  <div className="decrypted-values">
                    <div>
                      <p className="label">Score</p>
                      <p className="value">{decryptedState.score}</p>
                    </div>
                    <div>
                      <p className="label">Last choice</p>
                      <p className="value">
                        Big {decryptedState.bigBall} → Small {decryptedState.smallBall}
                      </p>
                    </div>
                    <div>
                      <p className="label">Outcome</p>
                      <p className="value">{decryptedState.outcome === 1 ? '+10 win' : '-10 miss'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="game-actions">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Four encrypted spheres</p>
              <h3 className="panel-title">Pick a path</h3>
            </div>
            <p className="hint">
              Each big sphere hides one winning small ball. Correct path adds 10 points, wrong path loses 10 with a
              floor at zero.
            </p>
          </div>

          <div className="ball-grid">
            {BIG_BALLS.map((ball) => (
              <div
                key={ball.id}
                className={`big-ball ${selectedBigBall === ball.id ? 'active' : ''}`}
                style={{ borderColor: ball.accent }}
                onClick={() => setSelectedBigBall(ball.id)}
              >
                <div className="ball-header">
                  <div className="ball-index" style={{ backgroundColor: ball.accent }}>
                    {ball.id + 1}
                  </div>
                  <div>
                    <p className="label">Big ball</p>
                    <p className="value">{ball.label}</p>
                  </div>
                </div>
                <div className="small-balls">
                  {SMALL_BALLS.map((small) => (
                    <button
                      key={small}
                      className={`small-ball ${selectedSmallBall === small && selectedBigBall === ball.id ? 'chosen' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBigBall(ball.id);
                        setSelectedSmallBall(small);
                      }}
                    >
                      {small}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="action-footer">
            <div>
              <p className="label">Selected path</p>
              <p className="value">
                {selectedBigBall === null || selectedSmallBall === null
                  ? 'Pick a big ball and a small ball'
                  : `Big ${selectedBigBall + 1} → Small ${selectedSmallBall}`}
              </p>
            </div>
            <button
              className="primary"
              disabled={
                !hasStarted ||
                !selectionReady ||
                isPlaying ||
                zamaLoading ||
                isWrongNetwork ||
                !isConnected ||
                isFetching ||
                !contractReady
              }
              onClick={handlePlayRound}
            >
              {isPlaying ? 'Sending encrypted path...' : 'Submit encrypted guess'}
            </button>
          </div>
        </div>

        <div className="info-grid">
          <div className="info-card">
            <p className="label">Encrypted answers</p>
            <p className="value">
              Winning small balls are stored on-chain as encrypted values (1, 3, 2, 2) and never revealed in clear.
            </p>
          </div>
          <div className="info-card">
            <p className="label">Secure scoring</p>
            <p className="value">
              Scores and last paths are encrypted per player. Decryption requires your signature through the relayer.
            </p>
          </div>
          <div className="info-card">
            <p className="label">Network</p>
            <p className="value">Plays happen on Sepolia using viem for reads and ethers for writes.</p>
          </div>
        </div>

        {statusMessage && <div className="status-banner">{statusMessage}</div>}
      </section>
    </div>
  );
}
