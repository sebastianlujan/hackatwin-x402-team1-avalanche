// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Client } from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';

import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';
import { BrokerFixture } from 'test/utils/BrokerFixture.sol';

contract UnitPaymentBrokerMessage is BrokerFixture {
  bytes32 internal constant _ID1 = keccak256('id1');
  bytes32 internal constant _ID2 = keccak256('id2');

  function setUp() external {
    _deployBroker();
    _broker.setAllowedSender(_SELECTOR_A, _senderX, _payerP);
    _broker.setAllowedSender(_SELECTOR_B, _senderY, _payerQ);
  }

  modifier whenAnAllowedMessageIsDelivered() {
    _;
  }

  function test_GivenAPayloadPayerThatMatchesThePair() external whenAnAllowedMessageIsDelivered {
    // it calls pay on the hub for that payer with the payload values
    vm.expectCall(address(_hub), abi.encodeCall(IPaymentHub.pay, (_lane, _payerP, 100, _deadline)));
    _deliver(_message(_ID1, _SELECTOR_A, _senderX, _valid(_payerP)));
    vm.expectCall(address(_hub), abi.encodeCall(IPaymentHub.pay, (_lane, _payerQ, 7, _deadline + 1)));
    _deliver(_message(_ID2, _SELECTOR_B, _senderY, _data(_lane, _payerQ, 7, _deadline + 1)));

    assertEq(_token.balanceOf(_payerP), _BALANCE - 100);
    assertEq(_token.balanceOf(_payerQ), _BALANCE - 7);
    assertEq(_hub.exposed_budget(_payerP, address(_broker), address(_token)), _BUDGET - 100);
    assertEq(_hub.exposed_budget(_payerQ, address(_broker), address(_token)), _BUDGET - 7);
  }

  function test_GivenAPayloadPayerThatIsBoundToAnotherPair() external whenAnAllowedMessageIsDelivered {
    // it records Rejected with the payer mismatch reason and calls nothing on the hub
    vm.expectCall(address(_hub), abi.encodeWithSelector(IPaymentHub.pay.selector), 0);
    vm.expectEmit(true, false, false, true, address(_broker));
    emit IPaymentBroker.MessageRejected(_ID1, IPaymentBroker.PaymentBroker_PayerMismatch.selector);
    _deliver(_message(_ID1, _SELECTOR_A, _senderX, _valid(_payerQ)));
    _deliver(_message(_ID2, _SELECTOR_B, _senderY, _valid(_payerP)));

    assertEq(uint8(_broker.statusOf(_ID1)), uint8(IPaymentBroker.Status.Rejected));
    assertEq(uint8(_broker.statusOf(_ID2)), uint8(IPaymentBroker.Status.Rejected));
    assertEq(_token.balanceOf(_payerQ), _BALANCE);
    assertEq(_token.balanceOf(_payerP), _BALANCE);
    assertEq(_hub.exposed_budget(_payerQ, address(_broker), address(_token)), _BUDGET);
    assertEq(_hub.exposed_budget(_payerP, address(_broker), address(_token)), _BUDGET);
  }

  function test_GivenAReboundPairAndAMessageRejectedForAMismatch() external whenAnAllowedMessageIsDelivered {
    // it reverts with PaymentBroker_MessageAlreadyProcessed
    Client.Any2EVMMessage memory _foreign = _message(_ID1, _SELECTOR_A, _senderX, _valid(_payerQ));
    _deliver(_foreign);
    _broker.setAllowedSender(_SELECTOR_A, _senderX, _payerQ);

    vm.expectRevert(abi.encodeWithSelector(IPaymentBroker.PaymentBroker_MessageAlreadyProcessed.selector, _ID1));
    _deliver(_foreign);
    assertEq(uint8(_broker.statusOf(_ID1)), uint8(IPaymentBroker.Status.Rejected));
    assertEq(_hub.exposed_budget(_payerQ, address(_broker), address(_token)), _BUDGET);

    _deliver(_message(_ID2, _SELECTOR_A, _senderX, _valid(_payerQ)));
    assertEq(uint8(_broker.statusOf(_ID2)), uint8(IPaymentBroker.Status.Accepted));
  }

  function test_GivenAProcessedMessageID() external whenAnAllowedMessageIsDelivered {
    // it reverts with PaymentBroker_MessageAlreadyProcessed before the token and size checks
    Client.Any2EVMMessage memory _original = _message(_ID1, _SELECTOR_A, _senderX, _valid(_payerP));
    _deliver(_original);
    bytes memory _expected = abi.encodeWithSelector(IPaymentBroker.PaymentBroker_MessageAlreadyProcessed.selector, _ID1);

    vm.expectRevert(_expected);
    _deliver(_original);
    _original.destTokenAmounts = new Client.EVMTokenAmount[](1);
    vm.expectRevert(_expected);
    _deliver(_original);
    _original.data = hex'00';
    vm.expectRevert(_expected);
    _deliver(_original);

    assertEq(_token.balanceOf(_payerP), _BALANCE - 100);
    assertEq(_token.balanceOf(address(_messenger)), 100);

    _broker.setAllowedSender(_SELECTOR_A, _senderX, address(0));
    vm.expectRevert(
      abi.encodeWithSelector(IPaymentBroker.PaymentBroker_SourceNotAllowed.selector, _SELECTOR_A, _senderX)
    );
    _deliver(_original);
  }

  function test_GivenTwoDifferentMessageIDs() external whenAnAllowedMessageIsDelivered {
    // it keeps one status for each
    _deliver(_message(_ID1, _SELECTOR_A, _senderX, _valid(_payerP)));
    _deliver(_message(_ID2, _SELECTOR_A, _senderX, _valid(_payerQ)));

    assertEq(uint8(_broker.statusOf(_ID1)), uint8(IPaymentBroker.Status.Accepted));
    assertEq(uint8(_broker.statusOf(_ID2)), uint8(IPaymentBroker.Status.Rejected));
    assertEq(uint8(_broker.statusOf(keccak256('unknown'))), uint8(IPaymentBroker.Status.None));
  }

  function test_GivenAPayerWordWithDirtyHighBits() external whenAnAllowedMessageIsDelivered {
    // it reverts with PaymentBroker_InvalidPayload
    uint256[2] memory _dirty = [uint256(uint160(_payerP)) | (1 << 160), uint256(uint160(_payerP)) | (1 << 255)];
    for (uint256 _i; _i < 2; ++_i) {
      vm.expectRevert(IPaymentBroker.PaymentBroker_InvalidPayload.selector);
      _deliver(_message(_ID1, _SELECTOR_A, _senderX, abi.encode(_lane, _dirty[_i], 100, _deadline)));
    }
    assertEq(uint8(_broker.statusOf(_ID1)), uint8(IPaymentBroker.Status.None));
  }

  function test_GivenAnAcceptedMessage() external whenAnAllowedMessageIsDelivered {
    // it emits MessageAccepted and moves the payment to Dispatched with no tokens held
    vm.expectEmit(true, true, false, true, address(_broker));
    emit IPaymentBroker.MessageAccepted(_ID1, _lane, _paymentId(1));
    _deliver(_message(_ID1, _SELECTOR_A, _senderX, _valid(_payerP)));
    _deliver(_message(_ID2, _SELECTOR_B, _senderY, _valid(_payerQ)));

    assertEq(uint8(_broker.statusOf(_ID1)), uint8(IPaymentBroker.Status.Accepted));
    assertEq(uint8(_hub.statusOf(_lane, _paymentId(1))), uint8(IPaymentHub.Status.Dispatched));
    assertEq(uint8(_hub.statusOf(_lane, _paymentId(2))), uint8(IPaymentHub.Status.Dispatched));
    assertEq(_token.balanceOf(address(_broker)), 0);
    assertEq(_token.balanceOf(address(_messenger)), 200);
  }
}
