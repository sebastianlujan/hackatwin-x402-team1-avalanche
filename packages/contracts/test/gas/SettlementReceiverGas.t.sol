// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract GasSettlementReceiver {
  modifier whenTheReceiverHotPathsRunOnFreshState() {
    _;
  }

  function test_GivenASettledDeliveryToAMerchantWithoutCode() external whenTheReceiverHotPathsRunOnFreshState {
    // it settles and the gas lands in the snapshot
  }

  function test_GivenASettledDeliveryToAMerchantWithASucceedingCallback()
    external
    whenTheReceiverHotPathsRunOnFreshState
  {
    // it settles and the gas lands in the snapshot
    // it fits the documented recipient gas limit
  }

  function test_GivenARejectedDelivery() external whenTheReceiverHotPathsRunOnFreshState {
    // it rejects and the gas lands in the snapshot
  }

  function test_GivenACreditedMerchant() external whenTheReceiverHotPathsRunOnFreshState {
    // it withdraws and the gas lands in the snapshot
  }
}
