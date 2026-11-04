// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitSettlementReceiverValidation {
  modifier whenTheTransferrerDeliversTokens() {
    _;
  }

  function test_GivenAllFiveSourceValuesMatch() external whenTheTransferrerDeliversTokens {
    // it continues to payload decoding
  }

  function test_GivenACallerOrSourceValueThatDiffersFromTheConfiguration() external whenTheTransferrerDeliversTokens {
    // it reverts with the named error and writes no status
  }

  function test_GivenSeveralWrongSourceValues() external whenTheTransferrerDeliversTokens {
    // it reverts with the first error in check order
  }

  function test_GivenABadSourceAndAMalformedPayload() external whenTheTransferrerDeliversTokens {
    // it returns the source error
  }

  function test_GivenAZeroAmount() external whenTheTransferrerDeliversTokens {
    // it reverts with SettlementReceiver_ZeroAmount
  }

  function test_GivenAPayloadThatIsNot64BytesOrHasADirtyMerchantWord() external whenTheTransferrerDeliversTokens {
    // it reverts with SettlementReceiver_InvalidPayload
  }

  function test_GivenAnUnusedPaymentId() external whenTheTransferrerDeliversTokens {
    // it emits StatusChanged from None to Received
  }

  function test_GivenAPaymentIdThatIsNotNone() external whenTheTransferrerDeliversTokens {
    // it reverts with SettlementReceiver_InvalidTransition
  }
}
