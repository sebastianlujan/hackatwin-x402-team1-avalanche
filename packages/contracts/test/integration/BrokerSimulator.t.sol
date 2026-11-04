// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract IntegrationBrokerSimulator {
  modifier whenTheSimulatorRouterDeliversAMessage() {
    _;
  }

  function test_GivenASenderThatIsNotAllowlistedOrMalformedData() external whenTheSimulatorRouterDeliversAMessage {
    // it fails with the outer ReceiverError wrapping the inner error and changes no hub state
  }

  function test_GivenAMessageThatWasAlreadyProcessed() external whenTheSimulatorRouterDeliversAMessage {
    // it fails with PaymentBroker_MessageAlreadyProcessed when the router replays it
  }

  function test_GivenAnAllowedSenderWithAFundedBudget() external whenTheSimulatorRouterDeliversAMessage {
    // it moves the payment from None to Pending to Dispatched and records Accepted
  }
}
