// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ZSphere encrypted guessing game
/// @notice Players keep an encrypted score while trying to pick the winning small ball for each big ball.
contract ZSphereGame is ZamaEthereumConfig {
    uint32 private constant INITIAL_SCORE = 100;
    uint32 private constant REWARD_POINTS = 10;
    uint32 private constant PENALTY_POINTS = 10;

    struct PlayerState {
        euint32 score;
        euint32 lastBigBall;
        euint32 lastSmallBall;
        euint32 lastOutcome;
        uint32 roundsPlayed;
        bool started;
    }

    mapping(address => PlayerState) private _players;

    euint32[4] private _encryptedAnswers;
    euint32 private _encryptedReward;
    euint32 private _encryptedPenalty;

    event GameStarted(address indexed player, euint32 encryptedScore);
    event RoundPlayed(
        address indexed player,
        euint32 newScore,
        euint32 bigBallChoice,
        euint32 smallBallChoice,
        euint32 encryptedOutcome
    );

    constructor() {
        _encryptedAnswers[0] = FHE.asEuint32(1);
        _encryptedAnswers[1] = FHE.asEuint32(3);
        _encryptedAnswers[2] = FHE.asEuint32(2);
        _encryptedAnswers[3] = FHE.asEuint32(2);

        _encryptedReward = FHE.asEuint32(REWARD_POINTS);
        _encryptedPenalty = FHE.asEuint32(PENALTY_POINTS);

        for (uint8 i = 0; i < _encryptedAnswers.length; i++) {
            FHE.allowThis(_encryptedAnswers[i]);
        }

        FHE.allowThis(_encryptedReward);
        FHE.allowThis(_encryptedPenalty);
    }

    /// @notice Starts the game for the caller with an encrypted score of 100.
    function startGame() external {
        PlayerState storage state = _players[msg.sender];
        require(!state.started, "Game already started");

        state.score = FHE.asEuint32(INITIAL_SCORE);
        state.lastBigBall = FHE.asEuint32(0);
        state.lastSmallBall = FHE.asEuint32(0);
        state.lastOutcome = FHE.asEuint32(0);
        state.roundsPlayed = 0;
        state.started = true;

        _shareStateWithPlayer(state, msg.sender);

        emit GameStarted(msg.sender, state.score);
    }

    /// @notice Plays a round using encrypted choices for the big ball and small ball.
    /// The correct small balls are encrypted on-chain in the order: 1, 3, 2, 2.
    /// @param bigBallChoiceEncrypted Encrypted index of the big ball (0-3)
    /// @param smallBallChoiceEncrypted Encrypted index of the chosen small ball (1-3)
    /// @param inputProof Proof produced by the client encrypting the inputs
    function playRound(
        externalEuint32 bigBallChoiceEncrypted,
        externalEuint32 smallBallChoiceEncrypted,
        bytes calldata inputProof
    ) external {
        PlayerState storage state = _players[msg.sender];
        require(state.started, "Game not started");

        euint32 bigBallChoice = FHE.fromExternal(bigBallChoiceEncrypted, inputProof);
        euint32 smallBallChoice = FHE.fromExternal(smallBallChoiceEncrypted, inputProof);

        euint32 winningChoice = _winningAnswer(bigBallChoice);
        ebool validBigBall = _isValidBigBall(bigBallChoice);
        ebool validSmallBall = _isValidSmallBall(smallBallChoice);
        ebool guessedCorrectly = FHE.and(validBigBall, FHE.and(validSmallBall, FHE.eq(smallBallChoice, winningChoice)));

        euint32 updatedScore = FHE.select(
            guessedCorrectly,
            FHE.add(state.score, _encryptedReward),
            _applyPenalty(state.score)
        );

        state.score = updatedScore;
        state.lastBigBall = bigBallChoice;
        state.lastSmallBall = smallBallChoice;
        state.lastOutcome = FHE.select(guessedCorrectly, FHE.asEuint32(1), FHE.asEuint32(0));
        state.roundsPlayed += 1;

        _shareStateWithPlayer(state, msg.sender);

        emit RoundPlayed(msg.sender, updatedScore, bigBallChoice, smallBallChoice, state.lastOutcome);
    }

    /// @notice Returns the encrypted correct small ball for a given big ball index.
    /// @param index Big ball index (0-3)
    function getEncryptedAnswer(uint256 index) external view returns (euint32) {
        require(index < _encryptedAnswers.length, "Invalid big ball");
        return _encryptedAnswers[index];
    }

    /// @notice Returns the encrypted game state for a player.
    /// @dev View methods must take the address explicitly to avoid msg.sender reads.
    function getPlayerState(address player)
        external
        view
        returns (euint32 score, euint32 lastBigBall, euint32 lastSmallBall, euint32 lastOutcome, uint32 roundsPlayed, bool started)
    {
        PlayerState storage state = _players[player];
        return (
            state.score,
            state.lastBigBall,
            state.lastSmallBall,
            state.lastOutcome,
            state.roundsPlayed,
            state.started
        );
    }

    function _winningAnswer(euint32 bigBallChoice) private view returns (euint32) {
        ebool isFirst = FHE.eq(bigBallChoice, FHE.asEuint32(0));
        ebool isSecond = FHE.eq(bigBallChoice, FHE.asEuint32(1));
        ebool isThird = FHE.eq(bigBallChoice, FHE.asEuint32(2));

        euint32 answerForThirdOrFourth = FHE.select(isThird, _encryptedAnswers[2], _encryptedAnswers[3]);
        euint32 answerForSecond = FHE.select(isSecond, _encryptedAnswers[1], answerForThirdOrFourth);
        return FHE.select(isFirst, _encryptedAnswers[0], answerForSecond);
    }

    function _isValidBigBall(euint32 bigBallChoice) private pure returns (ebool) {
        ebool isZero = FHE.eq(bigBallChoice, FHE.asEuint32(0));
        ebool isOne = FHE.eq(bigBallChoice, FHE.asEuint32(1));
        ebool isTwo = FHE.eq(bigBallChoice, FHE.asEuint32(2));
        ebool isThree = FHE.eq(bigBallChoice, FHE.asEuint32(3));

        return FHE.or(FHE.or(isZero, isOne), FHE.or(isTwo, isThree));
    }

    function _isValidSmallBall(euint32 smallBallChoice) private pure returns (ebool) {
        ebool isOne = FHE.eq(smallBallChoice, FHE.asEuint32(1));
        ebool isTwo = FHE.eq(smallBallChoice, FHE.asEuint32(2));
        ebool isThree = FHE.eq(smallBallChoice, FHE.asEuint32(3));

        return FHE.or(isOne, FHE.or(isTwo, isThree));
    }

    function _applyPenalty(euint32 score) private view returns (euint32) {
        ebool hasEnough = FHE.ge(score, _encryptedPenalty);
        euint32 reduced = FHE.sub(score, _encryptedPenalty);
        return FHE.select(hasEnough, reduced, FHE.asEuint32(0));
    }

    function _shareStateWithPlayer(PlayerState storage state, address player) private {
        FHE.allowThis(state.score);
        FHE.allow(state.score, player);

        FHE.allowThis(state.lastBigBall);
        FHE.allow(state.lastBigBall, player);

        FHE.allowThis(state.lastSmallBall);
        FHE.allow(state.lastSmallBall, player);

        FHE.allowThis(state.lastOutcome);
        FHE.allow(state.lastOutcome, player);
    }
}
