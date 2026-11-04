// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentHubPay {
  modifier whenAPaymentIsEscrowed() {
    _;
  }

  function test_GivenThePayerPaysForItself() external whenAPaymentIsEscrowed {
    // it escrows the amount and consumes no budget
  }

  function test_GivenAnAuthorizedBrokerWithEnoughBudget() external whenAPaymentIsEscrowed {
    // it escrows the amount, drops the budget and emits one StatusChanged
  }

  function test_GivenAnAmountAboveTheRemainingBudget() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_BudgetExceeded and moves no tokens
  }

  function test_GivenABudgetThatWasAlreadySpentInFull() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_Unauthorized
  }

  function test_GivenACallerWithoutAnAuthorization() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_Unauthorized
  }

  function test_GivenAnUnknownLane() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_LaneNotFound
  }

  function test_GivenAZeroAmount() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_ZeroAmount
  }

  function test_GivenADeadlineThatIsNotInTheFuture() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_InvalidDeadline
  }

  function test_GivenAFee_on_transferToken() external whenAPaymentIsEscrowed {
    // it records the delivered delta as the escrow
  }

  function test_GivenATokenThatDeliversNothing() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_ZeroAmount
  }

  function test_GivenTwoPayments() external whenAPaymentIsEscrowed {
    // it returns distinct payment ids
  }

  function test_GivenAPaymentThatIsNotNone() external whenAPaymentIsEscrowed {
    // it rejects the None to Pending transition
  }
}
