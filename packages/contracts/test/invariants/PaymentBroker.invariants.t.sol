// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';
import { PaymentBrokerHandler } from 'test/invariants/PaymentBrokerHandler.sol';

contract InvariantPaymentBroker is Test {
  PaymentBrokerHandler internal _handler;

  function setUp() external {
    _handler = new PaymentBrokerHandler();
    targetContract(address(_handler));
    bytes4[] memory _selectors = new bytes4[](5);
    _selectors[0] = _handler.setPair.selector;
    _selectors[1] = _handler.grant.selector;
    _selectors[2] = _handler.setMode.selector;
    _selectors[3] = _handler.deliver.selector;
    _selectors[4] = _handler.replay.selector;
    targetSelector(FuzzSelector({ addr: address(_handler), selectors: _selectors }));
  }

  function invariant_EveryPaymentHasThePayerBoundAtDelivery() external view {
    uint256 _created;
    for (uint256 _i; _i < _handler.ghostCount(); ++_i) {
      (,, address _bound, bytes32 _paymentId) = _handler.ghostAt(_i);
      if (_paymentId == 0) continue;
      ++_created;
      assertEq(_handler.hub().exposed_payment(_handler.laneId(), _paymentId).payer, _bound, 'payer drifted');
    }
    assertEq(_created, _handler.paymentCount(), 'payment without a message');
    assertEq(
      uint8(_handler.hub().statusOf(_handler.laneId(), _handler.paymentIdAt(_handler.paymentCount() + 1))),
      uint8(IPaymentHub.Status.None),
      'extra payment'
    );
  }

  function invariant_MessageStatusesNeverChange() external view {
    for (uint256 _i; _i < _handler.ghostCount(); ++_i) {
      (bytes32 _id, IPaymentBroker.Status _status,, bytes32 _paymentId) = _handler.ghostAt(_i);
      assertEq(uint8(_handler.broker().statusOf(_id)), uint8(_status), 'status drifted');
      assertTrue(_status == IPaymentBroker.Status.Accepted || _paymentId == 0, 'rejected message paid');
    }
  }

  function invariant_BrokerHoldsNoTokens() external view {
    assertEq(_handler.token().balanceOf(address(_handler.broker())), 0);
    assertEq(address(_handler.broker()).balance, 0);
  }

  function invariant_PaidNeverExceedsGranted() external view {
    for (uint256 _i; _i < 3; ++_i) {
      address _payer = _handler.payers(_i);
      assertLe(_handler.paid(_payer), _handler.granted(_payer));
      assertEq(_handler.granted(_payer), _handler.paid(_payer) + _handler.remaining(_payer), 'budget leaked');
    }
  }

  function afterInvariant() external view {
    assertGt(_handler.setPairCalls(), 0, 'setPair never ran');
    assertGt(_handler.grantCalls(), 0, 'grant never ran');
    assertGt(_handler.acceptedCount(), 0, 'nothing accepted');
    assertGt(_handler.dispatchFailedCount(), 0, 'no dispatch failure');
    assertGt(_handler.hubRefusalCount(), 0, 'no hub refusal');
    assertGt(_handler.mismatchCount(), 0, 'no payer mismatch');
    assertGt(_handler.replayCount(), 0, 'replay never ran');
  }
}
