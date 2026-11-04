// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Client } from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';
import { Vm } from 'forge-std/Vm.sol';

import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { BrokerFixture } from 'test/utils/BrokerFixture.sol';
import { MockMessenger } from 'test/utils/MockMessenger.sol';

contract UnitPaymentBrokerRefusal is BrokerFixture {
  bytes32 internal constant _ID1 = keccak256('id1');
  bytes32 internal constant _ID2 = keccak256('id2');
  bytes4 internal constant _ERROR_STRING = 0x08c379a0;

  function setUp() external {
    _deployBroker();
    _broker.setAllowedSender(_SELECTOR_A, _senderX, _payerP);
    _broker.setAllowedSender(_SELECTOR_B, _senderY, _payerQ);
  }

  modifier whenAnAllowedMessageReachesTheHub() {
    _;
  }

  function test_GivenAHubThatRefusesThePayment() external whenAnAllowedMessageReachesTheHub {
    // it records Rejected with the hub error selector and creates no payment
    _hub.exposed_setBudget(_payerP, address(_broker), address(_token), 50);
    _hub.exposed_setBudget(_payerQ, address(_broker), address(_token), 0);
    bytes[5] memory _payloads = [
      _valid(_payerP),
      _valid(_payerQ),
      _data(Id.wrap(bytes32(uint256(1))), _payerP, 10, _deadline),
      _data(_lane, _payerP, 0, _deadline),
      _data(_lane, _payerP, 10, block.timestamp)
    ];
    bytes4[5] memory _reasons = [
      IPaymentHub.PaymentHub_BudgetExceeded.selector,
      IPaymentHub.PaymentHub_Unauthorized.selector,
      IPaymentHub.PaymentHub_LaneNotFound.selector,
      IPaymentHub.PaymentHub_ZeroAmount.selector,
      IPaymentHub.PaymentHub_InvalidDeadline.selector
    ];
    for (uint256 _i; _i < 5; ++_i) {
      bool _forQ = _i == 1;
      bytes32 _id = bytes32(_i + 1);
      vm.expectEmit(true, false, false, true, address(_broker));
      emit IPaymentBroker.MessageRejected(_id, _reasons[_i]);
      _deliver(_message(_id, _forQ ? _SELECTOR_B : _SELECTOR_A, _forQ ? _senderY : _senderX, _payloads[_i]));
      assertEq(uint8(_broker.statusOf(_id)), uint8(IPaymentBroker.Status.Rejected));
    }

    assertEq(uint8(_hub.statusOf(_lane, _paymentId(1))), uint8(IPaymentHub.Status.None));
    assertEq(_token.balanceOf(address(_hub)), 0);
    assertEq(_token.balanceOf(_payerP), _BALANCE);
    assertEq(_token.balanceOf(_payerQ), _BALANCE);
  }

  function test_GivenARejectedMessageAndAToppedUpBudget() external whenAnAllowedMessageReachesTheHub {
    // it reverts with PaymentBroker_MessageAlreadyProcessed
    _hub.exposed_setBudget(_payerP, address(_broker), address(_token), 50);
    Client.Any2EVMMessage memory _refused = _message(_ID1, _SELECTOR_A, _senderX, _valid(_payerP));
    _deliver(_refused);
    _hub.exposed_setBudget(_payerP, address(_broker), address(_token), _BUDGET);

    vm.expectRevert(abi.encodeWithSelector(IPaymentBroker.PaymentBroker_MessageAlreadyProcessed.selector, _ID1));
    _deliver(_refused);
    assertEq(uint8(_broker.statusOf(_ID1)), uint8(IPaymentBroker.Status.Rejected));
    assertEq(_token.balanceOf(_payerP), _BALANCE);

    _deliver(_message(_ID2, _SELECTOR_A, _senderX, _valid(_payerP)));
    assertEq(uint8(_broker.statusOf(_ID2)), uint8(IPaymentBroker.Status.Accepted));
  }

  function test_GivenAMessengerThatReverts() external whenAnAllowedMessageReachesTheHub {
    // it records Accepted and emits DispatchFailed with the payment pending
    _messenger.setMode(MockMessenger.Mode.Revert);
    vm.recordLogs();
    vm.expectEmit(true, false, false, true, address(_broker));
    emit IPaymentBroker.DispatchFailed(_ID1, _paymentId(1), _ERROR_STRING);
    _deliver(_message(_ID1, _SELECTOR_A, _senderX, _valid(_payerP)));

    uint256 _brokerLogs;
    Vm.Log[] memory _logs = vm.getRecordedLogs();
    for (uint256 _i; _i < _logs.length; ++_i) {
      if (_logs[_i].emitter == address(_broker)) ++_brokerLogs;
    }
    assertEq(_brokerLogs, 1, 'only DispatchFailed');
    assertEq(uint8(_broker.statusOf(_ID1)), uint8(IPaymentBroker.Status.Accepted));
    assertEq(uint8(_hub.statusOf(_lane, _paymentId(1))), uint8(IPaymentHub.Status.Pending));
    assertEq(_token.balanceOf(address(_hub)), 100);
    assertEq(_token.balanceOf(address(_broker)), 0);
  }

  function test_GivenAPaymentLeftPendingByAFailedDispatch() external whenAnAllowedMessageReachesTheHub {
    // it can be dispatched by anyone before its deadline and refunded after it
    _messenger.setMode(MockMessenger.Mode.Revert);
    _deliver(_message(_ID1, _SELECTOR_A, _senderX, _valid(_payerP)));
    _deliver(_message(_ID2, _SELECTOR_B, _senderY, _valid(_payerQ)));
    _messenger.setMode(MockMessenger.Mode.Pull);

    vm.prank(makeAddr('anyone'));
    _hub.dispatch(_lane, _paymentId(1));
    assertEq(uint8(_hub.statusOf(_lane, _paymentId(1))), uint8(IPaymentHub.Status.Dispatched));
    assertEq(_token.balanceOf(address(_messenger)), 100);

    vm.warp(_deadline + 1);
    _hub.refund(_lane, _paymentId(2));
    assertEq(uint8(_hub.statusOf(_lane, _paymentId(2))), uint8(IPaymentHub.Status.Refunded));
    assertEq(_token.balanceOf(_payerQ), _BALANCE);
  }

  modifier whenTheGasLeftIsLow() {
    _;
  }

  function test_GivenLessThanMIN_RELAY_GASAtTheHubCall() external whenTheGasLeftIsLow {
    // it reverts with PaymentBroker_InsufficientGas and records no status
    uint256 _floor = _broker.MIN_RELAY_GAS();
    Client.Any2EVMMessage memory _starved = _message(_ID1, _SELECTOR_A, _senderX, _valid(_payerP));
    vm.prank(_router);
    (bool _ok, bytes memory _revert) =
      address(_broker).call{ gas: _floor }(abi.encodeCall(_broker.ccipReceive, (_starved)));

    assertFalse(_ok);
    assertEq(bytes4(_revert), IPaymentBroker.PaymentBroker_InsufficientGas.selector);
    (uint256 _available, uint256 _required) = abi.decode(_slice(_revert), (uint256, uint256));
    assertLt(_available, _floor);
    assertEq(_required, _floor);
    assertEq(uint8(_broker.statusOf(_ID1)), uint8(IPaymentBroker.Status.None));
    assertEq(_token.balanceOf(_payerP), _BALANCE);
  }

  function test_GivenTheSameMessageRedeliveredWithEnoughGas() external whenTheGasLeftIsLow {
    // it is processed
    uint256 _floor = _broker.MIN_RELAY_GAS();
    Client.Any2EVMMessage memory _starved = _message(_ID1, _SELECTOR_A, _senderX, _valid(_payerP));
    vm.prank(_router);
    (bool _ok,) = address(_broker).call{ gas: _floor }(abi.encodeCall(_broker.ccipReceive, (_starved)));
    assertFalse(_ok);

    vm.prank(_router);
    _broker.ccipReceive{ gas: _floor * 2 }(_starved);
    assertEq(uint8(_broker.statusOf(_ID1)), uint8(IPaymentBroker.Status.Accepted));
    assertEq(_token.balanceOf(_payerP), _BALANCE - 100);
  }

  function _slice(bytes memory _revert) internal pure returns (bytes memory _args) {
    _args = new bytes(_revert.length - 4);
    for (uint256 _i; _i < _args.length; ++_i) {
      _args[_i] = _revert[_i + 4];
    }
  }
}
