// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentHubCallback {
  modifier whenAPaymentSettlesToAMerchantContract() {
    _;
  }

  function test_GivenACallbackThatSucceeds() external whenAPaymentSettlesToAMerchantContract {
    // it receives the payment id, token and amount and emits no CallbackFailed
  }

  function test_GivenACallbackThatReverts() external whenAPaymentSettlesToAMerchantContract {
    // it settles, keeps the credit and emits CallbackFailed
  }

  function test_GivenACallbackThatBurnsAllGas() external whenAPaymentSettlesToAMerchantContract {
    // it settles, keeps the credit and emits CallbackFailed
  }

  function test_GivenTooLittleGasToFundTheFullCallback() external whenAPaymentSettlesToAMerchantContract {
    // it reverts with PaymentHub_InsufficientCallbackGas and the payment stays pending
  }

  function test_GivenACallbackThatReentersTheHub() external whenAPaymentSettlesToAMerchantContract {
    // it reverts every reentrant call and the outer settle succeeds
  }
}
