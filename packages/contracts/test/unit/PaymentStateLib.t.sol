// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentStateLib {
  modifier whenCheckingTheHubTable() {
    _;
  }

  function test_GivenThePairIsOneOfTheFourEdges() external whenCheckingTheHubTable {
    // it allows the transition
  }

  function test_GivenAnyOtherOfThe25Pairs() external whenCheckingTheHubTable {
    // it rejects the transition
  }

  function test_GivenFuzzedPairsWithinTheEnumRange() external whenCheckingTheHubTable {
    // it allows only the four edges
  }

  modifier whenCheckingTheReceiverTable() {
    _;
  }

  function test_GivenThePairIsOneOfTheThreeEdges() external whenCheckingTheReceiverTable {
    // it allows the transition
  }

  function test_GivenAnyOtherOfThe16Pairs() external whenCheckingTheReceiverTable {
    // it rejects the transition
  }
}
