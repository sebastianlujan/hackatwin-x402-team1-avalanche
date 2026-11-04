// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentHubSettle {
  modifier whenAnyoneSettlesAPayment() {
    _;
  }

  function test_GivenAPendingLocalPaymentBeforeItsDeadline() external whenAnyoneSettlesAPayment {
    // it sets Settled, credits the merchant, zeroes the escrow and emits one StatusChanged
  }

  function test_GivenAPendingLocalPaymentAtItsDeadline() external whenAnyoneSettlesAPayment {
    // it settles
  }

  function test_GivenAPaymentThatIsNotPending() external whenAnyoneSettlesAPayment {
    // it reverts with PaymentHub_InvalidTransition
  }

  function test_GivenACrossChainPayment() external whenAnyoneSettlesAPayment {
    // it reverts with PaymentHub_WrongLaneKind
  }

  function test_GivenALocalPaymentAfterItsDeadline() external whenAnyoneSettlesAPayment {
    // it reverts with PaymentHub_DeadlinePassed
  }
}
