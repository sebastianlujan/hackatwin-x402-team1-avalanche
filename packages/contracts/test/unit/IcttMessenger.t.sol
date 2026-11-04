// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitIcttMessenger {
  modifier whenDeployingTheMessenger() {
    _;
  }

  function test_GivenValidInputs() external whenDeployingTheMessenger {
    // it exposes every configured value
  }

  function test_GivenAGasLimitThatIsZeroOrARecipientLimitNotBelowTheRequiredLimit() external whenDeployingTheMessenger {
    // it reverts with IcttMessenger_InvalidGasLimits
  }

  function test_GivenAZeroAddressInAnyAddressInput() external whenDeployingTheMessenger {
    // it reverts with IcttMessenger_ZeroAddress
  }

  function test_GivenAZeroDestinationBlockchainId() external whenDeployingTheMessenger {
    // it reverts with IcttMessenger_ZeroBlockchainId
  }
}
