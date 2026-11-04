// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitSettlementReceiverOutcome {
  modifier whenTheOwnerManagesTheAllowlist() {
    _;
  }

  function test_GivenTheOwnerAllowlistsAMerchant() external whenTheOwnerManagesTheAllowlist {
    // it emits MerchantSet and the next payment for it settles
  }

  function test_GivenTheOwnerRemovesAMerchant() external whenTheOwnerManagesTheAllowlist {
    // it emits MerchantSet and the next payment for it is rejected
  }

  function test_GivenAZeroMerchant() external whenTheOwnerManagesTheAllowlist {
    // it reverts with SettlementReceiver_ZeroAddress
  }

  function test_GivenACallerThatIsNotTheOwner() external whenTheOwnerManagesTheAllowlist {
    // it reverts with OwnableUnauthorizedAccount
  }

  modifier whenAValidatedDeliveryArrives() {
    _;
  }

  function test_GivenAnAllowlistedMerchant() external whenAValidatedDeliveryArrives {
    // it pulls the amount and credits the merchant and emits Received then Settled
  }

  function test_GivenATokenPullThatReverts() external whenAValidatedDeliveryArrives {
    // it reverts and stores no status
  }

  function test_GivenAMerchantThatIsNotAllowlisted() external whenAValidatedDeliveryArrives {
    // it records Rejected and pulls nothing without reverting
  }

  function test_GivenARejectedPaymentDeliveredThroughTheTransferrer() external whenAValidatedDeliveryArrives {
    // it leaves the full amount with the fallback recipient and none in the receiver
  }
}
