// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract UnitPaymentBrokerRefusal {
  modifier whenAnAllowedMessageReachesTheHub() {
    _;
  }

  function test_GivenAHubThatRefusesThePayment() external whenAnAllowedMessageReachesTheHub {
    // it records Rejected with the hub error selector and creates no payment
  }

  function test_GivenARejectedMessageAndAToppedUpBudget() external whenAnAllowedMessageReachesTheHub {
    // it reverts with PaymentBroker_MessageAlreadyProcessed
  }

  function test_GivenAMessengerThatReverts() external whenAnAllowedMessageReachesTheHub {
    // it records Accepted and emits DispatchFailed with the payment pending
  }

  function test_GivenAPaymentLeftPendingByAFailedDispatch() external whenAnAllowedMessageReachesTheHub {
    // it can be dispatched by anyone before its deadline and refunded after it
  }

  modifier whenTheGasLeftIsLow() {
    _;
  }

  function test_GivenLessThanMIN_RELAY_GASAtTheHubCall() external whenTheGasLeftIsLow {
    // it reverts with PaymentBroker_InsufficientGas and records no status
  }

  function test_GivenTheSameMessageRedeliveredWithEnoughGas() external whenTheGasLeftIsLow {
    // it is processed
  }
}
