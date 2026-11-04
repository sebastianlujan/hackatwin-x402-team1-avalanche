// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract UnitPaymentBrokerEntry {
  modifier whenAMessageReachesTheBroker() {
    _;
  }

  function test_GivenACallerThatIsNotTheRouter() external whenAMessageReachesTheBroker {
    // it reverts with InvalidRouter
  }

  function test_GivenAnAllowedPair() external whenAMessageReachesTheBroker {
    // it processes the message
  }

  function test_GivenPairsThatAreNotMixed() external whenAMessageReachesTheBroker {
    // it reverts with PaymentBroker_SourceNotAllowed before any other check
  }

  function test_GivenARemovedPair() external whenAMessageReachesTheBroker {
    // it reverts with PaymentBroker_SourceNotAllowed
  }

  function test_GivenAMessageThatCarriesTokens() external whenAMessageReachesTheBroker {
    // it reverts with PaymentBroker_UnexpectedTokens
  }

  function test_GivenDataThatIsNot128Bytes() external whenAMessageReachesTheBroker {
    // it reverts with PaymentBroker_InvalidPayload
  }

  modifier whenTheOwnerConfiguresTheBroker() {
    _;
  }

  function test_GivenACallerThatIsNotTheOwner() external whenTheOwnerConfiguresTheBroker {
    // it reverts with OwnableUnauthorizedAccount
  }

  function test_GivenAZeroSender() external whenTheOwnerConfiguresTheBroker {
    // it reverts with PaymentBroker_ZeroAddress
  }

  function test_GivenANewPair() external whenTheOwnerConfiguresTheBroker {
    // it stores the payer and emits AllowedSenderSet
  }

  function test_GivenTheDefaultCcipConfig() external whenTheOwnerConfiguresTheBroker {
    // it keeps full finality and no custom CCVs
  }
}
