// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title ISettlementReceiver
/// @notice Types of the settlement receiver on the L1; events, errors and functions arrive with the receiver
interface ISettlementReceiver {
  /// @notice Receiver payment states; None is the default for an unknown payment
  enum Status {
    None,
    Received,
    Settled,
    Rejected
  }
}
