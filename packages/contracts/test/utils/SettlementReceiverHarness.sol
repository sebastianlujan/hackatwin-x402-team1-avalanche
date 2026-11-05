// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { SettlementReceiver } from 'src/SettlementReceiver.sol';

/// @notice Exposes the status storage of the receiver for tests
contract SettlementReceiverHarness is SettlementReceiver {
  constructor(
    address _transferrer,
    bytes32 _sourceBlockchainId,
    address _originTransferrer,
    address _originSender,
    address _token
  )
    SettlementReceiver(_transferrer, _sourceBlockchainId, _originTransferrer, _originSender, _token)
  { }

  function exposed_setStatus(bytes32 _paymentId, Status _status) external {
    _statuses[_paymentId] = _status;
  }
}
