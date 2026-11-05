// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';
import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';

/// @title PaymentStateLib
/// @notice Bitmask tables of the allowed status edges; bit (from * 8 + to) is set when the edge is allowed
library PaymentStateLib {
  /// @notice Hub edges: None to Pending, Pending to Settled, Dispatched or Refunded
  uint256 internal constant HUB_EDGES =
    (1 << (0 * 8 + 1)) | (1 << (1 * 8 + 2)) | (1 << (1 * 8 + 3)) | (1 << (1 * 8 + 4));

  /// @notice Receiver edges: None to Received, Received to Settled or Rejected
  uint256 internal constant RECEIVER_EDGES = (1 << (0 * 8 + 1)) | (1 << (1 * 8 + 2)) | (1 << (1 * 8 + 3));

  /// @notice Whether a hub payment may move from one status to another
  /// @param _from The current status
  /// @param _to The next status
  /// @return _allowed True when the edge is in the table
  function canTransition(IPaymentHub.Status _from, IPaymentHub.Status _to) internal pure returns (bool _allowed) {
    _allowed = _has(HUB_EDGES, uint256(_from), uint256(_to));
  }

  /// @notice Whether a receiver payment may move from one status to another
  /// @param _from The current status
  /// @param _to The next status
  /// @return _allowed True when the edge is in the table
  function canTransition(
    ISettlementReceiver.Status _from,
    ISettlementReceiver.Status _to
  )
    internal
    pure
    returns (bool _allowed)
  {
    _allowed = _has(RECEIVER_EDGES, uint256(_from), uint256(_to));
  }

  /// @notice Whether bit (from * 8 + to) is set
  /// @param _edges The edge table
  /// @param _from The current status
  /// @param _to The next status
  /// @return _set True when the bit is set
  function _has(uint256 _edges, uint256 _from, uint256 _to) private pure returns (bool _set) {
    _set = (_edges >> (_from * 8 + _to)) & 1 == 1;
  }
}
