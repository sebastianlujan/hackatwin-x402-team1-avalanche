// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract GasPaymentBroker {
  modifier whenTheBrokerHotPathsRunOnFreshState() {
    _;
  }

  function test_GivenAnAcceptedMessage() external whenTheBrokerHotPathsRunOnFreshState {
    // it accepts and the gas lands in the snapshot
    // it fits the documented gas limit
  }

  function test_GivenARejectedMessage() external whenTheBrokerHotPathsRunOnFreshState {
    // it rejects and the gas lands in the snapshot
  }
}
