// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitSettlementReceiverWithdraw {
  modifier whenAMerchantWithdraws() {
    _;
  }

  function test_GivenACreditedMerchant() external whenAMerchantWithdraws {
    // it transfers the credit and zeroes it and emits Withdrawn
  }

  function test_GivenTwoCreditedMerchants() external whenAMerchantWithdraws {
    // it pays each only its own credit
  }

  function test_GivenACallerWithoutCredit() external whenAMerchantWithdraws {
    // it reverts with SettlementReceiver_ZeroAmount
  }
}
