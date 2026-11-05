// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { CCIPLocalRouter } from '@chainlink/local/src/ccip/CCIPLocalRouter.sol';

import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';
import { SimulatorFixture } from 'test/utils/SimulatorFixture.sol';

contract IntegrationBrokerSimulator is SimulatorFixture {
  function setUp() external {
    _deploySimulator();
  }

  modifier whenTheSimulatorRouterDeliversAMessage() {
    _;
  }

  function test_GivenASenderThatIsNotAllowlistedOrMalformedData() external whenTheSimulatorRouterDeliversAMessage {
    // it fails with the outer ReceiverError wrapping the inner error and changes no hub state
    address _stranger = makeAddr('stranger');
    bytes memory _notAllowed =
      abi.encodeWithSelector(IPaymentBroker.PaymentBroker_SourceNotAllowed.selector, _selector, _stranger);
    vm.expectRevert(abi.encodeWithSelector(CCIPLocalRouter.ReceiverError.selector, _notAllowed));
    _send(_stranger, _valid(_payerP));

    bytes memory _invalid = abi.encodeWithSelector(IPaymentBroker.PaymentBroker_InvalidPayload.selector);
    vm.expectRevert(abi.encodeWithSelector(CCIPLocalRouter.ReceiverError.selector, _invalid));
    _send(_agent, hex'00');

    assertEq(uint8(_hub.statusOf(_lane, _paymentId(1))), uint8(IPaymentHub.Status.None));
    assertEq(_token.balanceOf(address(_hub)), 0);
    assertEq(_token.balanceOf(_payerP), _BALANCE);
  }

  function test_GivenAMessageThatWasAlreadyProcessed() external whenTheSimulatorRouterDeliversAMessage {
    // it fails with PaymentBroker_MessageAlreadyProcessed when the router replays it
    bytes memory _payload = _valid(_payerP);
    bytes32 _id = _send(_agent, _payload);

    (bool _ok, bytes memory _error) = _replay(_id, _agent, _payload);
    assertFalse(_ok);
    assertEq(_error, abi.encodeWithSelector(IPaymentBroker.PaymentBroker_MessageAlreadyProcessed.selector, _id));
    assertEq(uint8(_hub.statusOf(_lane, _paymentId(2))), uint8(IPaymentHub.Status.None));
    assertEq(_token.balanceOf(address(_messenger)), 100);
  }

  function test_GivenAnAllowedSenderWithAFundedBudget() external whenTheSimulatorRouterDeliversAMessage {
    // it moves the payment from None to Pending to Dispatched and records Accepted
    assertEq(uint8(_hub.statusOf(_lane, _paymentId(1))), uint8(IPaymentHub.Status.None));
    vm.expectEmit(false, true, false, true, address(_broker));
    emit IPaymentBroker.MessageAccepted(bytes32(0), _lane, _paymentId(1));
    bytes32 _id = _send(_agent, _valid(_payerP));

    assertEq(uint8(_broker.statusOf(_id)), uint8(IPaymentBroker.Status.Accepted));
    assertEq(uint8(_hub.statusOf(_lane, _paymentId(1))), uint8(IPaymentHub.Status.Dispatched));
    assertEq(_token.balanceOf(address(_broker)), 0);
    assertEq(_token.balanceOf(_payerP), _BALANCE - 100);
    assertEq(_token.balanceOf(address(_messenger)), 100);
  }
}
