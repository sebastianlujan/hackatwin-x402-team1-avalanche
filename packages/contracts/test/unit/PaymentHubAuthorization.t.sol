// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentHubAuthorization {
  modifier whenAnyoneSubmitsAnAuthorization() {
    _;
  }

  function test_GivenAValidEOASignatureBeforeTheDeadline() external whenAnyoneSubmitsAnAuthorization {
    // it sets the budget, increments the nonce and emits AuthorizationSet
  }

  function test_GivenAValidSignatureThatReplacesAnEarlierBudget() external whenAnyoneSubmitsAnAuthorization {
    // it replaces the budget with the new value
  }

  function test_GivenTheDeadlineEqualsTheCurrentTimestamp() external whenAnyoneSubmitsAnAuthorization {
    // it sets the budget
  }

  function test_GivenAContractWalletThatApprovesTheDigest() external whenAnyoneSubmitsAnAuthorization {
    // it sets the budget
  }

  function test_GivenAContractWalletThatRejectsTheDigest() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_InvalidSignature
  }

  function test_GivenASignatureByAnotherAccount() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_InvalidSignature
  }

  function test_GivenASignatureThatWasAlreadyUsed() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with InvalidAccountNonce and keeps the budget
  }

  function test_GivenANonceThatIsNotTheCurrentOne() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with InvalidAccountNonce
  }

  function test_GivenASignaturePastItsDeadline() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_SignatureExpired
  }

  function test_GivenASignatureForAnotherChainId() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_InvalidSignature
  }

  function test_GivenASignatureForAnotherHubAddress() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_InvalidSignature
  }
}
