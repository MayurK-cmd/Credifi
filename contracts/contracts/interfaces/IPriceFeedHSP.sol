// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  IPriceFeedHSP
/// @notice Minimal interface for the HSP (Hashfans Swap Protocol) price feed.
/// @dev    TODO(hsp): replace with the official HSP interface once the
///         hashfans.io manual integration guide has been reviewed
///         (see PLAN.md §8 Open questions). When `priceFeed == address(0)`,
///         the pool assumes 1 HSK == 1 HSK (no USD conversion) — this is the
///         v1 default and is sufficient for the demo. v2 will return a
///         price scaled to 1e18 with proper staleness checks.
interface IPriceFeedHSP {
    /// @notice Returns the latest HSK price in the quote asset, scaled to 1e18.
    /// @return price 1e18-scaled price of 1 HSK in the quote currency.
    function latestAnswer() external view returns (uint256 price);
}