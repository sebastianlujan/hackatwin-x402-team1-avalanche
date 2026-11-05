// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPaymentCallback } from 'src/interfaces/IPaymentCallback.sol';

/// @title PaymentCallbackLib
/// @notice Gas-capped, failure-tolerant merchant callback that ignores return data
library PaymentCallbackLib {
  /// @notice The gas every callback receives
  uint256 internal constant CALLBACK_GAS = 100_000;

  /// @notice Gas kept for the code after the callback returns
  uint256 internal constant GAS_RESERVE = 30_000;

  /// @notice Whether the merchant has code and so is called at all
  /// @param _merchant The merchant
  /// @return _called True for a contract, false for an account without code
  function hasCallback(address _merchant) internal view returns (bool _called) {
    _called = _merchant.code.length != 0;
  }

  /// @notice Whether the remaining gas funds the full cap under the 63/64 rule plus the reserve
  /// @return _funded True when the callback can receive its full gas cap
  function canFund() internal view returns (bool _funded) {
    _funded = gasleft() >= CALLBACK_GAS * 64 / 63 + GAS_RESERVE;
  }

  /// @notice Call the merchant callback with the fixed gas cap
  /// @param _merchant The merchant contract
  /// @param _paymentId The settled payment
  /// @param _token The payment token
  /// @param _amount The credited amount
  /// @return _ok False when the callback reverted or ran out of gas
  function notify(address _merchant, bytes32 _paymentId, address _token, uint256 _amount) internal returns (bool _ok) {
    try IPaymentCallback(_merchant).onPaymentSettled{ gas: CALLBACK_GAS }(_paymentId, _token, _amount) {
      _ok = true;
    } catch { }
  }
}
