// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title IPaymentCallback
/// @notice Optional hook a merchant contract implements to learn about a settled payment
interface IPaymentCallback {
  /// @notice Called after the payment was credited to the merchant
  /// @param _paymentId The settled payment
  /// @param _token The payment token
  /// @param _amount The credited amount
  function onPaymentSettled(bytes32 _paymentId, address _token, uint256 _amount) external;
}
