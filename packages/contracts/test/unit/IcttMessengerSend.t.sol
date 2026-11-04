// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitIcttMessengerSend {
  modifier whenTheHubSendsAPayment() {
    _;
  }

  function test_GivenACallerThatIsNotTheHub() external whenTheHubSendsAPayment {
    // it reverts with IcttMessenger_OnlyHub
  }

  function test_GivenALaneDestinationThatIsNotConfigured() external whenTheHubSendsAPayment {
    // it reverts with IcttMessenger_DestinationMismatch
  }

  function test_GivenALaneTokenThatIsNotTheBoundToken() external whenTheHubSendsAPayment {
    // it reverts with IcttMessenger_TokenMismatch
  }

  function test_GivenAZeroAmount() external whenTheHubSendsAPayment {
    // it reverts with IcttMessenger_ZeroAmount
  }

  function test_GivenAValidPayment() external whenTheHubSendsAPayment {
    // it passes the configured values and the payment to sendAndCall
    // it approves exactly the amount and leaves no balance or allowance
    // it emits one PaymentSent
  }

  function test_GivenATransferrerThatReverts() external whenTheHubSendsAPayment {
    // it reverts and leaves no tokens in the messenger
  }
}
