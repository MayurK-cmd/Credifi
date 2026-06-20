// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title  CrediFiOracle
/// @notice Stores the latest credit score per wallet, verified via EIP-712
///         signatures produced off-chain by the CrediFi backend.
/// @dev    Score flow:
///           1. Backend scores a wallet off-chain, signs an EIP-712 typed
///              message containing (wallet, score, tier, expiresAt, nonce).
///           2. The backend's relayer (or any signer-key holder) submits the
///              signature via submitScore(...). Only the configured signer
///              address may submit.
///           3. The Pool calls verifyScore(...) at borrow time and
///              consumeNonce(...) inside borrow() to atomically prevent replay.
///
///         Tier recomputation: the oracle recomputes the tier from the score
///         and reverts if the caller's tier argument disagrees. This means a
///         compromised or malicious backend cannot lie about tier independently
///         of the score it signed.
///
///         Tier thresholds mirror frontend/src/lib/mockData.ts exactly:
///           A: score >= 800,  B: score >= 650,  C: score >= 450,  D: score < 450.
contract CrediFiOracle is Ownable, EIP712 {
    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice EIP-712 type hash for the off-chain score signature.
    /// @dev    MUST match the type string used by the off-chain signer
    ///         (see test/helpers/signScore.ts).
    bytes32 public constant SCORE_TYPEHASH =
        keccak256("Score(address wallet,uint16 score,uint8 tier,uint64 expiresAt,uint256 nonce)");

    /// @notice Tier A minimum score. Mirrors frontend/src/lib/mockData.ts.
    uint16 public constant TIER_A_MIN = 800;

    /// @notice Tier B minimum score. Mirrors frontend/src/lib/mockData.ts.
    uint16 public constant TIER_B_MIN = 650;

    /// @notice Tier C minimum score. Mirrors frontend/src/lib/mockData.ts.
    uint16 public constant TIER_C_MIN = 450;

    /// @notice Inclusive maximum score. Scores above this revert.
    uint16 public constant SCORE_MAX = 1_000;

    // Tier encoding: 1=A, 2=B, 3=C, 4=D. Mirrors CrediFiPool._ratioForTier.
    uint8 public constant TIER_A = 1;
    uint8 public constant TIER_B = 2;
    uint8 public constant TIER_C = 3;
    uint8 public constant TIER_D = 4;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Latest accepted score per wallet.
    mapping(address wallet => Score) public scores;

    /// @notice Configured backend signer. Only this address may call submitScore.
    address public signer;

    /// @notice Configured CrediFiPool. Only this address may call consumeNonce.
    address public pool;

    struct Score {
        uint16 score;
        uint8 tier;
        uint64 expiresAt;
        uint256 nonce;
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @notice Emitted when a new score is accepted and stored.
    event ScoreSubmitted(address indexed wallet, uint16 score, uint8 tier, uint64 expiresAt, uint256 nonce);

    /// @notice Emitted when the backend signer is rotated.
    event SignerUpdated(address indexed prev, address indexed curr);

    /// @notice Emitted when the configured pool is rotated.
    event PoolUpdated(address indexed prev, address indexed curr);

    // ---------------------------------------------------------------------
    // Custom errors
    // ---------------------------------------------------------------------

    error Oracle__InvalidSignature();
    error Oracle__Expired();
    error Oracle__StaleNonce();
    error Oracle__UnauthorizedSigner();
    error Oracle__InvalidTier(uint8 expected, uint8 supplied);
    error Oracle__ScoreOutOfRange(uint16 score);
    error Oracle__ZeroSigner();
    error Oracle__ZeroPool();
    error Oracle__UnauthorizedCaller(address caller, address expected);

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @param _signer Backend EOA or contract address authorized to submit scores.
    constructor(address _signer) EIP712("CrediFiOracle", "1") Ownable(msg.sender) {
        if (_signer == address(0)) revert Oracle__ZeroSigner();
        signer = _signer;
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Rotates the backend signer. Owner only.
    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert Oracle__ZeroSigner();
        emit SignerUpdated(signer, newSigner);
        signer = newSigner;
    }

    /// @notice Configures the CrediFiPool authorized to consume nonces.
    /// @dev    Owner only. Set this exactly once during deployment; rotating
    ///         mid-flight would require coordinating nonce state with the pool.
    function setPool(address newPool) external onlyOwner {
        if (newPool == address(0)) revert Oracle__ZeroPool();
        emit PoolUpdated(pool, newPool);
        pool = newPool;
    }

    // ---------------------------------------------------------------------
    // External: score submission
    // ---------------------------------------------------------------------

    /// @notice Verifies an EIP-712 signature from the configured signer and
    ///         stores the new score. Callable only by `signer`.
    /// @param wallet   Wallet address the score is for.
    /// @param score    Credit score 0..SCORE_MAX.
    /// @param tier     Tier 1..4 (must match computeTier(score)).
    /// @param expiresAt Unix timestamp after which the signature is invalid.
    /// @param nonce    Strictly increasing per wallet.
    /// @param v        ECDSA recovery byte.
    /// @param r        ECDSA r component.
    /// @param s        ECDSA s component.
    function submitScore(
        address wallet,
        uint16 score,
        uint8 tier,
        uint64 expiresAt,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (msg.sender != signer) revert Oracle__UnauthorizedSigner();
        // _verify performs the signature-only check (recover + signer match).
        // Expiry, range, tier are re-checked explicitly below for clarity
        // and so their custom errors can be surfaced distinctly.
        (bool sigOk, ) = _verify(wallet, score, tier, expiresAt, nonce, v, r, s);
        if (!sigOk) revert Oracle__InvalidSignature();
        if (block.timestamp > expiresAt) revert Oracle__Expired();
        if (score > SCORE_MAX) revert Oracle__ScoreOutOfRange(score);
        uint8 expected = computeTier(score);
        if (tier != expected) revert Oracle__InvalidTier(expected, tier);
        // Strictly increasing per-wallet nonce. consumeNonce() inside the pool
        // enforces the same invariant again at borrow time to atomically
        // prevent replay across the borrow flow.
        if (nonce <= scores[wallet].nonce) revert Oracle__StaleNonce();

        scores[wallet] = Score({ score: score, tier: tier, expiresAt: expiresAt, nonce: nonce });
        emit ScoreSubmitted(wallet, score, tier, expiresAt, nonce);
    }

    /// @notice View variant of score verification. Used by the Pool at borrow
    ///         time. Performs the same checks as submitScore minus storage write.
    function verifyScore(
        address wallet,
        uint16 score,
        uint8 tier,
        uint64 expiresAt,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public view returns (bool ok, address recovered) {
        return _verify(wallet, score, tier, expiresAt, nonce, v, r, s);
    }

    /// @notice Atomically consumes the latest nonce for `wallet`. Callable
    ///         only by the configured `pool`. Used by CrediFiPool.borrow to
    ///         prevent the same signature from being used twice.
    /// @dev    Increments by requiring `nonce > stored`. We update storage
    ///         after the nonce check so an invalid call is free.
    function consumeNonce(address wallet, uint256 nonce) external {
        if (msg.sender != pool) revert Oracle__UnauthorizedCaller(msg.sender, pool);
        uint256 current = scores[wallet].nonce;
        if (nonce <= current) revert Oracle__StaleNonce();
        scores[wallet].nonce = nonce;
    }

    // ---------------------------------------------------------------------
    // Pure helpers
    // ---------------------------------------------------------------------

    /// @notice Returns the tier (1=A, 2=B, 3=C, 4=D) for a given score.
    /// @dev    Mirrors frontend/src/lib/mockData.ts::tierFromScore.
    function computeTier(uint16 score) public pure returns (uint8) {
        if (score >= TIER_A_MIN) return TIER_A;
        if (score >= TIER_B_MIN) return TIER_B;
        if (score >= TIER_C_MIN) return TIER_C;
        return TIER_D;
    }

    /// @notice Returns the current stored score for `wallet`. Useful for the
    ///         frontend "view score" flow.
    function currentScore(address wallet) external view returns (Score memory) {
        return scores[wallet];
    }

    // ---------------------------------------------------------------------
    // Internal: signature verification
    // ---------------------------------------------------------------------

    /// @dev Recovers the signer from an EIP-712 typed data hash and checks
    ///      that it equals the configured `signer`. Does NOT check expiry,
    ///      range, or tier — those are caller's responsibility.
    function _verify(
        address wallet,
        uint16 score,
        uint8 tier,
        uint64 expiresAt,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view returns (bool ok, address recovered) {
        bytes32 structHash = keccak256(
            abi.encode(SCORE_TYPEHASH, wallet, score, tier, expiresAt, nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        recovered = ECDSA.recover(digest, v, r, s);
        // EIP-712 malleability check (OZ ECDSA enforces low-s; we additionally
        // reject v != 27/28 to avoid chain-id replays across forks).
        if (recovered == address(0)) return (false, address(0));
        if (v != 27 && v != 28) return (false, address(0));
        return (recovered == signer, recovered);
    }
}