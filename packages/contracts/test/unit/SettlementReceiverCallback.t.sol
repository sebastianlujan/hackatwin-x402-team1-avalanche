// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitSettlementReceiverCallback {
  modifier whenAPaymentSettlesToAMerchantContract() {
    _;
  }

  function test_GivenACallbackThatSucceeds() external whenAPaymentSettlesToAMerchantContract {
    // it receives the payment id token and amount and emits no CallbackFailed
  }

  function test_GivenACallbackThatRevertsOrBurnsAllGas() external whenAPaymentSettlesToAMerchantContract {
    // it settles and keeps the credit withdrawable and emits CallbackFailed
  }

  function test_GivenACallbackThatWithdrawsDuringTheCall() external whenAPaymentSettlesToAMerchantContract {
    // it blocks the reentrant withdraw and the delivery settles
  }

  function test_GivenTooLittleGasToFundTheFullCallback() external whenAPaymentSettlesToAMerchantContract {
    // it reverts with SettlementReceiver_InsufficientCallbackGas and the full amount reaches the fallback
  }
}
