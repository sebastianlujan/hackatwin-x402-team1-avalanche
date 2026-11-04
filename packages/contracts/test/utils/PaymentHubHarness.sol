// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { PaymentHub } from 'src/PaymentHub.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';

/// @notice Exposes the internal write path and storage of the hub, and stubs the functions not built yet
contract PaymentHubHarness is PaymentHub {
  constructor(address _owner) PaymentHub(_owner) { }

  function exposed_transition(Id _id, bytes32 _paymentId, Status _from, Status _to) external {
    _transition(_id, _paymentId, _from, _to);
  }

  function exposed_setStatus(Id _id, bytes32 _paymentId, Status _status) external {
    _payments[_id][_paymentId].status = _status;
  }

  function exposed_lane(Id _id) external view returns (LaneParams memory _lane) {
    _lane = _lanes[_id];
  }

  function exposed_isMessengerEnabled(address _messenger) external view returns (bool _enabled) {
    _enabled = _messengerEnabled[_messenger];
  }

  function exposed_budget(
    address _authorizer,
    address _authorized,
    address _token
  )
    external
    view
    returns (uint256 _budget)
  {
    _budget = _budgets[_authorizer][_authorized][_token];
  }

  function pay(Id, address, uint256, uint256) external pure returns (bytes32) {
    revert();
  }

  function settle(Id, bytes32) external pure {
    revert();
  }

  function dispatch(Id, bytes32) external pure {
    revert();
  }

  function refund(Id, bytes32) external pure {
    revert();
  }

  function withdraw(address) external pure {
    revert();
  }
}
