// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  ReentrancyAttacker
/// @notice Test-only mock used to verify ReentrancyGuard blocks reentrant calls
///         on deposit/withdraw/borrow/repay/liquidate in CrediFiPool.
/// @dev    Not deployed outside test runs. Do NOT import in production code.
///
///         Note: the storage variable is named `pool` (not `target`) because
///         ethers v6's BaseContract exposes a `target` field for the contract's
///         own address. Naming a public field `target` would clash with the
///         typechain-generated interface.
contract ReentrancyAttacker {
    address public immutable pool;
    uint256 public reentrancyAttempts;
    bool public attacking;

    constructor(address _pool) {
        pool = _pool;
    }

    /// @notice Initiates the attack by depositing then attempting to re-enter withdraw.
    function attackDeposit() external payable {
        attacking = true;
        // Call deposit on the pool with msg.value forwarded.
        (bool ok, ) = pool.call{value: msg.value}(abi.encodeWithSignature("deposit()"));
        require(ok, "deposit failed");
        attacking = false;
    }

    /// @notice Hook: when this contract receives HSK from the pool, try to
    ///         call back into withdraw again.
    receive() external payable {
        if (attacking && reentrancyAttempts < 3) {
            reentrancyAttempts += 1;
            // Try to re-enter withdraw — should revert due to ReentrancyGuard.
            (bool ok, ) = pool.call(abi.encodeWithSignature("withdraw(uint256)", 1));
            // We don't care about ok here; the test asserts the call reverts.
            ok; // silence unused warning
        }
    }
}
