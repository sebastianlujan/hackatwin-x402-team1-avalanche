// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitRegistry {
  modifier whenResolvingAChainIDToAKey() {
    _;
  }

  function test_GivenTheChainIDIsInARegistryFile() external whenResolvingAChainIDToAKey {
    // it returns the key
  }

  function test_GivenTheChainIDIsInNoRegistryFile() external whenResolvingAChainIDToAKey {
    // it reverts with UnknownChainId
  }

  modifier whenReadingAnAddressEntry() {
    _;
  }

  function test_GivenTheEntryExists() external whenReadingAnAddressEntry {
    // it returns the address from the JSON
  }

  function test_GivenTheEntryOrTheFileIsAbsent() external whenReadingAnAddressEntry {
    // it reverts with EntryNotFound naming both
  }

  modifier whenParsingTheCCIPSelector() {
    _;
  }

  function test_GivenADecimalStringWithinUint64() external whenParsingTheCCIPSelector {
    // it returns the value
  }

  function test_GivenANonNumericOrEmptyOrOversizedString() external whenParsingTheCCIPSelector {
    // it reverts with InvalidSelector
  }

  function test_GivenTheRegistryHasNoSelector() external whenParsingTheCCIPSelector {
    // it reverts with EntryNotFound
  }

  function test_WhenTheProjectGrantsFileAccess() external {
    // it allows no write to the registry directory
  }
}
