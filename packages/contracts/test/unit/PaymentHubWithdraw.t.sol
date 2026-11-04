// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentHubWithdraw {
  modifier whenAMerchantWithdraws() {
    _;
  }

  function test_GivenACreditedBalance() external whenAMerchantWithdraws {
    // it zeroes the credit, pays the merchant and emits Withdrawn
  }

  function test_GivenASecondWithdrawal() external whenAMerchantWithdraws {
    // it reverts with PaymentHub_ZeroAmount
  }

  function test_GivenNothingCredited() external whenAMerchantWithdraws {
    // it reverts with PaymentHub_ZeroAmount
  }

  function test_GivenCreditsInTwoTokens() external whenAMerchantWithdraws {
    // it pays only the requested token
  }
}
