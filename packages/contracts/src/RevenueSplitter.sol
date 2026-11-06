// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import { IRevenueSplitter } from 'src/interfaces/IRevenueSplitter.sol';

/// @title RevenueSplitter
/// @notice Receives x402 payments as their payTo address and splits them between the seller and the platform
contract RevenueSplitter is IRevenueSplitter {
  using SafeERC20 for IERC20;

  /// @notice The basis points of a whole balance
  uint256 internal constant _BPS = 10_000;

  /// @inheritdoc IRevenueSplitter
  address public immutable SELLER;

  /// @inheritdoc IRevenueSplitter
  address public immutable PLATFORM;

  /// @inheritdoc IRevenueSplitter
  uint16 public immutable PLATFORM_BPS;

  /// @param _seller The API seller
  /// @param _platform The platform
  /// @param _platformBps The platform share in basis points of 10_000
  constructor(address _seller, address _platform, uint16 _platformBps) {
    if (_seller == address(0) || _platform == address(0)) revert RevenueSplitter_ZeroAddress();
    if (_platformBps > _BPS) revert RevenueSplitter_InvalidPlatformBps(_platformBps);
    SELLER = _seller;
    PLATFORM = _platform;
    PLATFORM_BPS = _platformBps;
  }

  /// @inheritdoc IRevenueSplitter
  function release(IERC20 _token) external returns (uint256 _sellerAmount, uint256 _platformAmount) {
    uint256 _balance = _token.balanceOf(address(this));
    if (_balance == 0) revert RevenueSplitter_ZeroBalance();
    (_sellerAmount, _platformAmount) = _split(_balance);
    _token.safeTransfer(SELLER, _sellerAmount);
    _token.safeTransfer(PLATFORM, _platformAmount);
    emit Released(address(_token), _sellerAmount, _platformAmount);
  }

  /// @inheritdoc IRevenueSplitter
  function pending(IERC20 _token) external view returns (uint256 _sellerAmount, uint256 _platformAmount) {
    (_sellerAmount, _platformAmount) = _split(_token.balanceOf(address(this)));
  }

  /// @notice Split a balance, rounding the platform share down so the seller gets the remainder
  /// @param _balance The balance to split
  /// @return _sellerAmount The seller amount
  /// @return _platformAmount The platform amount
  function _split(uint256 _balance) internal view returns (uint256 _sellerAmount, uint256 _platformAmount) {
    _platformAmount = _balance * PLATFORM_BPS / _BPS;
    _sellerAmount = _balance - _platformAmount;
  }
}
