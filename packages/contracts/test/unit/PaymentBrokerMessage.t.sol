// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract UnitPaymentBrokerMessage {
  modifier whenAnAllowedMessageIsDelivered() {
    _;
  }

  function test_GivenAPayloadPayerThatMatchesThePair() external whenAnAllowedMessageIsDelivered {
    // it calls pay on the hub for that payer with the payload values
  }

  function test_GivenAPayloadPayerThatIsBoundToAnotherPair() external whenAnAllowedMessageIsDelivered {
    // it records Rejected with the payer mismatch reason and calls nothing on the hub
  }

  function test_GivenAReboundPairAndAMessageRejectedForAMismatch() external whenAnAllowedMessageIsDelivered {
    // it reverts with PaymentBroker_MessageAlreadyProcessed
  }

  function test_GivenAProcessedMessageID() external whenAnAllowedMessageIsDelivered {
    // it reverts with PaymentBroker_MessageAlreadyProcessed before the token and size checks
  }

  function test_GivenTwoDifferentMessageIDs() external whenAnAllowedMessageIsDelivered {
    // it keeps one status for each
  }

  function test_GivenAPayerWordWithDirtyHighBits() external whenAnAllowedMessageIsDelivered {
    // it reverts with PaymentBroker_InvalidPayload
  }

  function test_GivenAnAcceptedMessage() external whenAnAllowedMessageIsDelivered {
    // it emits MessageAccepted and moves the payment to Dispatched with no tokens held
  }
}
