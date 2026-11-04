// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentHubDispatch {
  modifier whenAnyoneDispatchesAPayment() {
    _;
  }

  function test_GivenAPendingCrossChainPaymentBeforeItsDeadline() external whenAnyoneDispatchesAPayment {
    // it sets Dispatched, hands exactly the escrow to the messenger and leaves a zero allowance
  }

  function test_GivenAPendingCrossChainPaymentAtItsDeadline() external whenAnyoneDispatchesAPayment {
    // it dispatches
  }

  function test_GivenAPaymentThatIsNotPending() external whenAnyoneDispatchesAPayment {
    // it reverts with PaymentHub_InvalidTransition
  }

  function test_GivenALocalPayment() external whenAnyoneDispatchesAPayment {
    // it reverts with PaymentHub_WrongLaneKind
  }

  function test_GivenACrossChainPaymentAfterItsDeadline() external whenAnyoneDispatchesAPayment {
    // it reverts with PaymentHub_DeadlinePassed
  }

  function test_GivenAMessengerWhoseSendReverts() external whenAnyoneDispatchesAPayment {
    // it reverts, keeps the payment pending and refundable after the deadline
  }

  function test_GivenAMessengerThatPullsLessThanTheEscrow() external whenAnyoneDispatchesAPayment {
    // it reverts with PaymentHub_AllowanceNotConsumed and keeps the payment pending
  }

  function test_GivenADispatchedPaymentPastItsDeadline() external whenAnyoneDispatchesAPayment {
    // it rejects a refund with PaymentHub_InvalidTransition
  }
}
