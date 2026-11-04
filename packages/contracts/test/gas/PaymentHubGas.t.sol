// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract GasPaymentHub {
  modifier whenTheHubHotPathsRunOnFreshState() {
    _;
  }

  function test_GivenAFirstPaymentOnALocalLane() external whenTheHubHotPathsRunOnFreshState {
    // it pays and the gas lands in the snapshot
  }

  function test_GivenAFirstPaymentOnACrossChainLane() external whenTheHubHotPathsRunOnFreshState {
    // it pays and the gas lands in the snapshot
  }

  function test_GivenAPendingLocalPayment() external whenTheHubHotPathsRunOnFreshState {
    // it settles and the gas lands in the snapshot
  }

  function test_GivenAPendingCrossChainPayment() external whenTheHubHotPathsRunOnFreshState {
    // it dispatches and the gas lands in the snapshot
  }

  function test_GivenAnExpiredPendingPayment() external whenTheHubHotPathsRunOnFreshState {
    // it refunds and the gas lands in the snapshot
  }

  function test_GivenACreditedMerchant() external whenTheHubHotPathsRunOnFreshState {
    // it withdraws and the gas lands in the snapshot
  }
}
