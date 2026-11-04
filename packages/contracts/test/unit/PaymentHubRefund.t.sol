// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentHubRefund {
  modifier whenAnyoneRefundsAPayment() {
    _;
  }

  function test_GivenAPendingPaymentPastItsDeadline() external whenAnyoneRefundsAPayment {
    // it returns the escrow to the payer, sets Refunded and leaves the budget unchanged
  }

  function test_GivenAPendingPaymentAtItsDeadline() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_DeadlineNotReached
  }

  function test_GivenAPendingPaymentBeforeItsDeadline() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_DeadlineNotReached
  }

  function test_GivenAPaymentThatIsNotPending() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_InvalidTransition
  }

  function test_GivenAPaymentThatWasAlreadyRefunded() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_InvalidTransition and pays nothing twice
  }

  function test_GivenAPaymentUnderAnotherLaneId() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_InvalidTransition from None
  }
}
