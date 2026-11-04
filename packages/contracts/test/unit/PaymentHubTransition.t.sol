// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test, Vm } from 'forge-std/Test.sol';

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { PaymentStateLib } from 'src/libraries/PaymentStateLib.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract UnitPaymentHubTransition is Test {
  Id internal _id = Id.wrap(keccak256('lane'));
  bytes32 internal _paymentId = keccak256('payment');
  uint256 internal constant _STATUSES = 5;

  PaymentHubHarness internal _hub;

  function setUp() external {
    _hub = new PaymentHubHarness(address(this));
  }

  modifier whenATransitionIsRequested() {
    _;
  }

  function test_GivenTheStoredStatusEqualsTheFromStatusAndTheEdgeIsInTheTable() external whenATransitionIsRequested {
    // it writes the status and emits exactly one StatusChanged
    vm.recordLogs();
    _hub.exposed_transition(_id, _paymentId, IPaymentHub.Status.None, IPaymentHub.Status.Pending);
    Vm.Log[] memory _logs = vm.getRecordedLogs();
    assertEq(_logs.length, 1);
    assertEq(_logs[0].topics[0], IPaymentHub.StatusChanged.selector);
    assertEq(_logs[0].topics[1], Id.unwrap(_id));
    assertEq(_logs[0].topics[2], _paymentId);
    assertEq(abi.encode(IPaymentHub.Status.None, IPaymentHub.Status.Pending), _logs[0].data);
    assertEq(uint8(_hub.statusOf(_id, _paymentId)), uint8(IPaymentHub.Status.Pending));

    _hub.exposed_transition(_id, _paymentId, IPaymentHub.Status.Pending, IPaymentHub.Status.Refunded);
    assertEq(uint8(_hub.statusOf(_id, _paymentId)), uint8(IPaymentHub.Status.Refunded));
  }

  function test_GivenTheStoredStatusDiffersFromTheFromStatus() external whenATransitionIsRequested {
    // it reverts with PaymentHub_InvalidTransition and emits nothing
    for (uint256 _stored; _stored < _STATUSES; ++_stored) {
      if (_stored == uint256(IPaymentHub.Status.None)) continue;
      _hub.exposed_setStatus(_id, _paymentId, IPaymentHub.Status(_stored));
      vm.recordLogs();
      vm.expectRevert(
        abi.encodeWithSelector(
          IPaymentHub.PaymentHub_InvalidTransition.selector, IPaymentHub.Status(_stored), IPaymentHub.Status.Pending
        )
      );
      _hub.exposed_transition(_id, _paymentId, IPaymentHub.Status.None, IPaymentHub.Status.Pending);
      assertEq(vm.getRecordedLogs().length, 0);
      assertEq(uint8(_hub.statusOf(_id, _paymentId)), uint8(_stored));
    }
  }

  function test_GivenTheEdgeIsNotInTheTable() external whenATransitionIsRequested {
    // it reverts with PaymentHub_InvalidTransition
    for (uint256 _from; _from < _STATUSES; ++_from) {
      for (uint256 _to; _to < _STATUSES; ++_to) {
        IPaymentHub.Status _f = IPaymentHub.Status(_from);
        IPaymentHub.Status _t = IPaymentHub.Status(_to);
        if (PaymentStateLib.canTransition(_f, _t)) continue;
        _hub.exposed_setStatus(_id, _paymentId, _f);
        vm.expectRevert(abi.encodeWithSelector(IPaymentHub.PaymentHub_InvalidTransition.selector, _f, _t));
        _hub.exposed_transition(_id, _paymentId, _f, _t);
      }
    }
  }

  function test_WhenAnUnknownPaymentIsRead() external view {
    // it reads as None
    assertEq(uint8(_hub.statusOf(_id, _paymentId)), uint8(IPaymentHub.Status.None));
    assertEq(uint8(_hub.statusOf(Id.wrap(bytes32(uint256(1))), bytes32(uint256(2)))), uint8(IPaymentHub.Status.None));
  }
}
