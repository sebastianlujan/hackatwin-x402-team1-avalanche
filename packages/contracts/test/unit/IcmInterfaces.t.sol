// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitIcmInterfaces {
  modifier whenCheckingThePinnedSelectors() {
    _;
  }

  function test_GivenTheReceiveTokensFunction() external whenCheckingThePinnedSelectors {
    // it matches the literal selector
  }

  function test_GivenTheSendAndCallFunction() external whenCheckingThePinnedSelectors {
    // it matches the literal selector
  }

  modifier whenCheckingTheStructLayout() {
    _;
  }

  function test_GivenTheCanonicalTupleTypeString() external whenCheckingTheStructLayout {
    // it reproduces the interface selector
  }

  function test_GivenTwoFieldsSwapped() external whenCheckingTheStructLayout {
    // it no longer reproduces the interface selector
  }

  function test_WhenEncodingACall() external {
    // it decodes every field with the pinned layout
  }
}
