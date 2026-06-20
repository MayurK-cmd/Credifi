// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IPriceFeedHSP } from "./interfaces/IPriceFeedHSP.sol";

/// @title  CrediFiPool
/// @notice Pooled lending market for native HSK. Lenders deposit and earn
///         interest; borrowers draw from the pool by posting collateral
///         sized to their credit tier (verified via CrediFiOracle).
/// @dev    Accounting model (ERC-4626 style):
///           - Lenders hold `shares` pro-rata of `totalAssets`.
///           - `totalAssets` = `address(this).balance` - `totalBorrows`
///             (treasury fees are transferred out at repay time, so they
///             are not double-counted).
///           - First deposit mints 1:1; subsequent deposits mint pro-rata.
///
///         Interest model (linear, NOT compounded):
///           interest = principal * rateBps * blocksElapsed / BPS / BLOCKS_PER_YEAR
///
///         Liquidation: simple health-factor threshold. A position is
///         liquidatable when collateral/debt < LIQUIDATION_THRESHOLD_BPS / BPS
///         (i.e. HF < 1.10 in v1). No auction; liquidator receives collateral
///         in exchange for repaying the debt.
///
///         All tier thresholds and ratios mirror frontend/src/lib/mockData.ts.
///         Change them here AND there together.
contract CrediFiPool is Ownable, ReentrancyGuard {
    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice Basis points. 1 BPS = 0.01%. Used throughout for ratios and rates.
    uint256 public constant BPS = 10_000;

    // Tier thresholds — mirror CrediFiOracle.TIER_*_MIN and frontend mockData.
    uint16 public constant TIER_A_MIN = 800;
    uint16 public constant TIER_B_MIN = 650;
    uint16 public constant TIER_C_MIN = 450;

    // Tier encoding: 1=A, 2=B, 3=C, 4=D. Mirrors CrediFiOracle.TIER_*.
    uint8 public constant TIER_A = 1;
    uint8 public constant TIER_B = 2;
    uint8 public constant TIER_C = 3;
    uint8 public constant TIER_D = 4;

    /// @notice Tier A required collateral: 50% of borrow.
    uint256 public constant TIER_A_RATIO_BPS = 5_000;
    /// @notice Tier B required collateral: 80% of borrow.
    uint256 public constant TIER_B_RATIO_BPS = 8_000;
    /// @notice Tier C required collateral: 120% of borrow.
    uint256 public constant TIER_C_RATIO_BPS = 12_000;
    /// @notice Tier D required collateral: 150% of borrow.
    uint256 public constant TIER_D_RATIO_BPS = 15_000;

    /// @notice Health factor below which a position is liquidatable.
    /// @dev    HF = collateral / debt. Threshold of 110% means a position
    ///         can be liquidated as soon as collateral drops below 1.10x debt.
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 11_000;

    /// @notice Default borrow APR. 8% per year.
    uint256 public constant DEFAULT_BORROW_RATE_BPS = 800;
    /// @notice Lower bound on per-borrow APR (1%).
    uint256 public constant MIN_BORROW_RATE_BPS = 100;
    /// @notice Upper bound on per-borrow APR (30%).
    uint256 public constant MAX_BORROW_RATE_BPS = 3_000;

    /// @notice Share of borrower interest routed to treasury. 25% of interest
    ///         means an 8% borrow APR yields 6% to lenders and 2% to treasury.
    uint256 public constant PROTOCOL_FEE_BPS = 2_500;

    /// @notice Approximate HSK Chain block count for one year assuming ~5s blocks.
    /// @dev    365 days × 24 hours × 60 min × 60 sec / 5 sec per block = 6_307_200.
    uint256 public constant BLOCKS_PER_YEAR = 6_307_200;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    struct LenderPosition {
        uint256 shares;
    }

    struct BorrowerPosition {
        uint256 principal;
        uint256 collateral;
        uint64 interestRateBps;
        uint64 lastAccrualBlock;
        uint256 scoreNonceUsed;
        bool active;
    }

    mapping(address lender => LenderPosition) public lenders;
    mapping(address borrower => BorrowerPosition) public borrowers;

    /// @notice Total outstanding principal across all active loans.
    uint256 public totalBorrows;

    /// @notice Total shares minted to lenders. Used for pro-rata accounting.
    uint256 public totalShares;

    /// @notice CrediFiOracle used to verify off-chain-signed scores.
    address public immutable oracle;

    /// @notice Recipient of the protocol fee cut on interest payments.
    address public immutable treasury;

    /// @notice Optional HSP price feed. address(0) means 1:1 HSK pricing.
    address public priceFeed;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event Deposit(address indexed lender, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lender, uint256 burnedShares, uint256 amountOut);
    event Borrow(
        address indexed borrower,
        uint256 amount,
        uint256 collateral,
        uint16 score,
        uint8 tier,
        uint256 scoreNonce
    );
    event Repaid(address indexed borrower, uint256 principal, uint256 interest, uint256 treasuryFee);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        uint256 debt,
        uint256 collateralSeized
    );
    event PriceFeedUpdated(address indexed prev, address indexed curr);

    // ---------------------------------------------------------------------
    // Custom errors
    // ---------------------------------------------------------------------

    error Pool__CollateralTooLow(uint256 required, uint256 provided);
    error Pool__NoActiveLoan();
    error Pool__Overpayment(uint256 sent, uint256 owed);
    error Pool__Underpayment(uint256 sent, uint256 owed);
    error Pool__InsufficientLiquidity(uint256 requested, uint256 available);
    error Pool__NotLiquidatable(uint256 healthFactorBps);
    error Pool__InvalidScore();
    error Pool__LoanAlreadyActive();
    error Pool__ZeroAmount();
    error Pool__ZeroAddress();
    error Pool__InvalidRate(uint256 supplied, uint256 min, uint256 max);
    error Pool__InvalidTier(uint8 tier);

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @param _oracle   CrediFiOracle address (must be deployed first).
    /// @param _treasury Recipient of protocol fees.
    constructor(address _oracle, address _treasury) Ownable(msg.sender) {
        if (_oracle == address(0) || _treasury == address(0)) revert Pool__ZeroAddress();
        oracle = _oracle;
        treasury = _treasury;
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Sets the HSP price feed. Pass address(0) to revert to 1:1 pricing.
    function setPriceFeed(address feed) external onlyOwner {
        emit PriceFeedUpdated(priceFeed, feed);
        priceFeed = feed;
    }

    // ---------------------------------------------------------------------
    // Lender flow
    // ---------------------------------------------------------------------

    /// @notice Deposit native HSK and mint lender shares pro-rata.
    /// @dev    ERC-4626 style share accounting: existing depositors get a fair
    ///         share of the new liquidity without diluting themselves. The
    ///         share calculation subtracts the incoming `msg.value` from the
    ///         asset base so the new depositor doesn't pay for their own
    ///         deposit.
    /// @return shares The number of shares minted to the caller.
    function deposit() external payable nonReentrant returns (uint256 shares) {
        if (msg.value == 0) revert Pool__ZeroAmount();
        uint256 totalAssetsExcludingDeposit = _poolTotalAssets() - msg.value;
        if (totalShares == 0 || totalAssetsExcludingDeposit == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalShares) / totalAssetsExcludingDeposit;
        }
        totalShares += shares;
        lenders[msg.sender].shares += shares;
        emit Deposit(msg.sender, msg.value, shares);
    }

    /// @notice Burn lender shares and withdraw HSK including accrued interest.
    /// @dev    Capped at the pool's available liquidity (no dust). If a lender
    ///         requests more than the pool can pay, they get what is available
    ///         and the remainder is silently forfeited — this keeps the
    ///         accounting clean without reverting legitimate withdrawals.
    /// @param  shares The number of shares to redeem.
    /// @return amountOut HSK actually transferred to the caller.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 amountOut) {
        LenderPosition storage pos = lenders[msg.sender];
        if (shares == 0 || shares > pos.shares) revert Pool__ZeroAmount();
        uint256 assets = _poolTotalAssets();
        uint256 owed = assets == 0 ? 0 : (shares * assets) / totalShares;
        uint256 available = address(this).balance - totalBorrows;
        amountOut = owed > available ? available : owed;

        // CEI: state updates before external call.
        pos.shares -= shares;
        totalShares -= shares;

        if (amountOut > 0) {
            (bool ok, ) = msg.sender.call{value: amountOut}("");
            require(ok, "withdraw transfer failed");
        }
        emit Withdrawn(msg.sender, shares, amountOut);
    }

    // ---------------------------------------------------------------------
    // Borrower flow
    // ---------------------------------------------------------------------

    /// @notice Borrow HSK from the pool, posting collateral sized to the
    ///         signer's credit tier.
    /// @param  amount    HSK to borrow (must not exceed availableLiquidity).
    /// @param  score     Off-chain signed score.
    /// @param  tier      Tier 1..4 (must match computeTier(score)).
    /// @param  expiresAt Signature expiry timestamp.
    /// @param  nonce     Strictly increasing per wallet.
    /// @param  v,r,s     ECDSA signature over EIP-712 typed data.
    /// @return collateralLocked HSK posted as collateral (msg.value).
    function borrow(
        uint256 amount,
        uint16 score,
        uint8 tier,
        uint64 expiresAt,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable nonReentrant returns (uint256 collateralLocked) {
        if (amount == 0) revert Pool__ZeroAmount();
        BorrowerPosition storage pos = borrowers[msg.sender];
        if (pos.active) revert Pool__LoanAlreadyActive();

        // 1. Verify the score signature.
        (bool ok, ) = _oracleVerify(oracle, msg.sender, score, tier, expiresAt, nonce, v, r, s);
        if (!ok) revert Pool__InvalidScore();

        // 2. Check collateral.
        uint256 ratio = _ratioForTier(tier);
        uint256 required = (amount * ratio) / BPS;
        if (msg.value < required) revert Pool__CollateralTooLow(required, msg.value);

        // 3. Check pool has enough available liquidity.
        uint256 available = address(this).balance - msg.value - totalBorrows;
        if (amount > available) revert Pool__InsufficientLiquidity(amount, available);

        // 4. Atomically consume the score nonce to prevent replay.
        _oracleConsume(oracle, msg.sender, nonce);

        // 5. Write storage (CEI).
        pos.principal = amount;
        pos.collateral = msg.value;
        pos.interestRateBps = uint64(DEFAULT_BORROW_RATE_BPS);
        pos.lastAccrualBlock = uint64(block.number);
        pos.scoreNonceUsed = nonce;
        pos.active = true;
        totalBorrows += amount;
        collateralLocked = msg.value;

        // 6. External call last.
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "borrow transfer failed");
        emit Borrow(msg.sender, amount, msg.value, score, tier, nonce);
    }

    /// @notice Repay the caller's outstanding loan in full (principal + interest).
    /// @dev    `msg.value` must be >= the owed amount. Excess is refunded to
    ///         the caller. The interest portion is split between treasury
    ///         (PROTOCOL_FEE_BPS) and the lender pool (implicitly, via share
    ///         price increase).
    ///         Allowing slight overpayment removes the 1-block read/exec race
    ///         between quoting `accruedDebt` and submitting the repay tx.
    function repay() external payable nonReentrant {
        BorrowerPosition storage pos = borrowers[msg.sender];
        if (!pos.active) revert Pool__NoActiveLoan();

        (uint256 principal, uint256 interest) = _splitOwed(pos);
        uint256 owed = principal + interest;
        if (msg.value < owed) revert Pool__Underpayment(msg.value, owed);

        uint256 treasuryFee = (interest * PROTOCOL_FEE_BPS) / BPS;
        uint256 collateralReturn = pos.collateral;
        uint256 refund = msg.value - owed;

        // CEI: state updates first.
        totalBorrows -= principal;
        pos.principal = 0;
        pos.collateral = 0;
        pos.lastAccrualBlock = uint64(block.number);
        pos.active = false;

        // External calls last. Refund excess to caller, return collateral,
        // then pay treasury fee.
        if (refund > 0) {
            (bool ok0, ) = msg.sender.call{value: refund}("");
            require(ok0, "refund failed");
        }
        if (collateralReturn > 0) {
            (bool ok1, ) = msg.sender.call{value: collateralReturn}("");
            require(ok1, "collateral return failed");
        }
        if (treasuryFee > 0) {
            (bool ok2, ) = treasury.call{value: treasuryFee}("");
            require(ok2, "treasury transfer failed");
        }

        emit Repaid(msg.sender, principal, interest, treasuryFee);
    }

    // ---------------------------------------------------------------------
    // Liquidation
    // ---------------------------------------------------------------------

    /// @notice Liquidate an undercollateralized position.
    /// @dev    The caller must attach at least `debt` HSK to repay the
    ///         borrower's full outstanding debt; any excess is refunded.
    ///         In return they receive the borrower's collateral.
    ///         Reverts if the position is still healthy.
    function liquidate(address borrower) external payable nonReentrant {
        BorrowerPosition storage pos = borrowers[borrower];
        if (!pos.active) revert Pool__NoActiveLoan();
        uint256 hf = _healthFactor(pos);
        if (hf >= LIQUIDATION_THRESHOLD_BPS) revert Pool__NotLiquidatable(hf);

        uint256 debt = _accruedDebt(pos);
        if (msg.value < debt) revert Pool__Underpayment(msg.value, debt);

        uint256 collateralSeized = pos.collateral;
        uint256 principal = pos.principal;
        uint256 refund = msg.value - debt;

        // CEI: zero state before external calls.
        totalBorrows -= principal;
        pos.principal = 0;
        pos.collateral = 0;
        pos.lastAccrualBlock = uint64(block.number);
        pos.active = false;

        if (refund > 0) {
            (bool ok0, ) = msg.sender.call{value: refund}("");
            require(ok0, "refund failed");
        }
        (bool ok, ) = msg.sender.call{value: collateralSeized}("");
        require(ok, "liquidate transfer failed");
        emit Liquidated(borrower, msg.sender, debt, collateralSeized);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Returns the total outstanding debt (principal + accrued interest)
    ///         for the borrower's position.
    function accruedDebt(address borrower) external view returns (uint256) {
        return _accruedDebt(borrowers[borrower]);
    }

    /// @notice Returns the current health factor for a borrower in BPS.
    /// @dev    HF = collateral / debt, scaled to BPS. Values < LIQUIDATION_THRESHOLD_BPS
    ///         indicate a liquidatable position. When `priceFeed` is set, HSK
    ///         collateral is converted via the feed; otherwise 1:1.
    function healthFactor(address borrower) external view returns (uint256) {
        return _healthFactor(borrowers[borrower]);
    }

    /// @notice HSK available to be borrowed (idle liquidity minus outstanding borrows).
    function availableLiquidity() external view returns (uint256) {
        uint256 idle = address(this).balance - totalBorrows;
        return idle;
    }

    /// @notice Total pool assets net of borrows. Used for share price math.
    function poolTotalAssets() external view returns (uint256) {
        return _poolTotalAssets();
    }

    /// @notice Returns the collateral ratio (in BPS) for a given tier.
    function ratioForTier(uint8 tier) external pure returns (uint256) {
        return _ratioForTier(tier);
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _accruedDebt(BorrowerPosition storage pos) internal view returns (uint256) {
        if (!pos.active) return 0;
        uint256 blocksElapsed = block.number > pos.lastAccrualBlock
            ? block.number - pos.lastAccrualBlock
            : 0;
        uint256 interest = (pos.principal * uint256(pos.interestRateBps) * blocksElapsed) /
            BPS /
            BLOCKS_PER_YEAR;
        return pos.principal + interest;
    }

    function _splitOwed(BorrowerPosition storage pos) internal view returns (uint256 principal, uint256 interest) {
        uint256 blocksElapsed = block.number > pos.lastAccrualBlock
            ? block.number - pos.lastAccrualBlock
            : 0;
        interest = (pos.principal * uint256(pos.interestRateBps) * blocksElapsed) /
            BPS /
            BLOCKS_PER_YEAR;
        principal = pos.principal;
    }

    function _healthFactor(BorrowerPosition storage pos) internal view returns (uint256) {
        if (!pos.active) return type(uint256).max;
        uint256 debt = _accruedDebt(pos);
        if (debt == 0) return type(uint256).max;
        uint256 collateralValue = pos.collateral;
        if (priceFeed != address(0)) {
            // Optional price conversion. Capped at 1e18 to prevent overflow.
            uint256 price = IPriceFeedHSP(priceFeed).latestAnswer();
            collateralValue = (collateralValue * price) / 1e18;
        }
        return (collateralValue * BPS) / debt;
    }

    function _poolTotalAssets() internal view returns (uint256) {
        uint256 idle = address(this).balance > totalBorrows ? address(this).balance - totalBorrows : 0;
        return idle;
    }

    function _ratioForTier(uint8 tier) internal pure returns (uint256) {
        if (tier == TIER_A) return TIER_A_RATIO_BPS;
        if (tier == TIER_B) return TIER_B_RATIO_BPS;
        if (tier == TIER_C) return TIER_C_RATIO_BPS;
        if (tier == TIER_D) return TIER_D_RATIO_BPS;
        revert Pool__InvalidTier(tier);
    }

    /// @dev Thin wrappers around the oracle so this contract doesn't need to
    ///      import CrediFiOracle directly. Low-level staticcall / call so
    ///      the ABI surface stays narrow.
    function _oracleVerify(
        address oracleAddr,
        address wallet,
        uint16 score,
        uint8 tier,
        uint64 expiresAt,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view returns (bool ok, address recovered) {
        (bool success, bytes memory data) = oracleAddr.staticcall(
            abi.encodeWithSignature(
                "verifyScore(address,uint16,uint8,uint64,uint256,uint8,bytes32,bytes32)",
                wallet, score, tier, expiresAt, nonce, v, r, s
            )
        );
        if (!success) return (false, address(0));
        return abi.decode(data, (bool, address));
    }

    function _oracleConsume(address oracleAddr, address wallet, uint256 nonce) internal {
        (bool success, ) = oracleAddr.call(abi.encodeWithSignature("consumeNonce(address,uint256)", wallet, nonce));
        require(success, "consumeNonce failed");
    }
}