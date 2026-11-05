// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';

/// @title IMessenger
/// @notice Plug-in that carries an escrowed payment to another chain
interface IMessenger {
  /// @notice Pull the approved amount from the hub and send it to the lane destination
  /// @param _id The lane id
  /// @param _paymentId The payment id
  /// @param _lane The lane params
  /// @param _amount The escrowed amount, approved to the messenger by the hub
  function send(Id _id, bytes32 _paymentId, IPaymentHub.LaneParams calldata _lane, uint256 _amount) external;
}
