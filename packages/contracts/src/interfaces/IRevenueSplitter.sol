// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @title IRevenueSplitter
/// @notice The x402 payTo address of an API: it splits each token balance it holds between the seller and the platform
interface IRevenueSplitter {
  /// @notice A token balance was split and paid out
  /// @param _token The token
  /// @param _sellerAmount The amount paid to the seller
  /// @param _platformAmount The amount paid to the platform
  event Released(address indexed _token, uint256 _sellerAmount, uint256 _platformAmount);

  /// @notice The seller or the platform is the zero address
  error RevenueSplitter_ZeroAddress();

  /// @notice The platform share is above 10_000 basis points
  /// @param _platformBps The rejected share
  error RevenueSplitter_InvalidPlatformBps(uint16 _platformBps);

  /// @notice The splitter holds none of the token
  error RevenueSplitter_ZeroBalance();

  /// @notice Split the whole balance of a token and pay both parties; anyone can call it
  /// @param _token The token to split
  /// @return _sellerAmount The amount paid to the seller
  /// @return _platformAmount The amount paid to the platform
  function release(IERC20 _token) external returns (uint256 _sellerAmount, uint256 _platformAmount);

  /// @notice The amounts release would pay now, rounded in favor of the seller
  /// @param _token The token to split
  /// @return _sellerAmount The amount the seller would get
  /// @return _platformAmount The amount the platform would get
  function pending(IERC20 _token) external view returns (uint256 _sellerAmount, uint256 _platformAmount);

  /// @notice The API seller, paid the balance minus the platform share
  /// @return _seller The seller
  function SELLER() external view returns (address _seller);

  /// @notice The platform, paid its share of every balance
  /// @return _platform The platform
  function PLATFORM() external view returns (address _platform);

  /// @notice The platform share in basis points of 10_000
  /// @return _platformBps The platform share
  function PLATFORM_BPS() external view returns (uint16 _platformBps);
}
