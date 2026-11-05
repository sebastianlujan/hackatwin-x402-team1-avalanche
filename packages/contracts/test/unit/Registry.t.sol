// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { Registry } from 'script/lib/Registry.sol';
import { RegistryHarness } from 'test/utils/RegistryHarness.sol';

contract UnitRegistry is Test {
  RegistryHarness internal _harness;

  function setUp() public {
    _harness = new RegistryHarness();
  }

  modifier whenResolvingAChainIDToAKey() {
    _;
  }

  function test_GivenTheChainIDIsInARegistryFile() external whenResolvingAChainIDToAKey {
    // it returns the key
    assertEq(_harness.keyOf(43_113), 'fuji');
    assertEq(_harness.keyOf(11_155_111), 'sepolia');
    assertEq(_harness.keyOf(43_114), 'cchain');
  }

  function test_GivenTheChainIDIsInNoRegistryFile() external whenResolvingAChainIDToAKey {
    // it reverts with UnknownChainId
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_UnknownChainId.selector, 1));
    _harness.keyOf(1);
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_UnknownChainId.selector, 0));
    _harness.keyOf(0);
  }

  modifier whenReadingAnAddressEntry() {
    _;
  }

  function test_GivenTheEntryExists() external whenReadingAnAddressEntry {
    // it returns the address from the JSON
    assertEq(_harness.addressOf('fuji', 'ccipRouter'), 0xF694E193200268f9a4868e4Aa017A0118C9a8177);
    assertEq(_harness.addressOf('fuji', 'usdc'), 0x5425890298aed601595a70AB815c96711a31Bc65);
  }

  function test_GivenTheEntryOrTheFileIsAbsent() external whenReadingAnAddressEntry {
    // it reverts with EntryNotFound naming both
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'twinpay-l1', 'receiver'));
    _harness.addressOf('twinpay-l1', 'receiver');
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'fuji', 'nothing'));
    _harness.addressOf('fuji', 'nothing');
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'fuji', 'file'));
    _harness.addressOfIn('./test/fixtures/none', 'fuji', 'usdc');
  }

  modifier whenParsingTheCCIPSelector() {
    _;
  }

  function test_GivenADecimalStringWithinUint64() external whenParsingTheCCIPSelector {
    // it returns the value
    assertEq(_harness.selectorOf('fuji'), 14_767_482_510_784_806_043);
    assertEq(_harness.selectorOf('sepolia'), 16_015_286_601_757_825_753);
    assertEq(_harness.parseSelector('k', '0'), 0);
    assertEq(_harness.parseSelector('k', '18446744073709551615'), type(uint64).max);
  }

  function test_GivenANonNumericOrEmptyOrOversizedString() external whenParsingTheCCIPSelector {
    // it reverts with InvalidSelector
    string[5] memory _bad = ['', '12a4', '-1', '18446744073709551616', '000000000000000000001'];
    for (uint256 _i; _i < _bad.length; ++_i) {
      vm.expectRevert(abi.encodeWithSelector(Registry.Registry_InvalidSelector.selector, 'k'));
      _harness.parseSelector('k', _bad[_i]);
    }
  }

  function test_GivenTheRegistryHasNoSelector() external whenParsingTheCCIPSelector {
    // it reverts with EntryNotFound
    vm.expectRevert(
      abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'twinpay-l1', 'ccip.chainSelector')
    );
    _harness.selectorOf('twinpay-l1');
  }

  function test_WhenTheProjectGrantsFileAccess() external {
    // it allows no write to the registry directory
    vm.expectRevert();
    _harness.tryWrite('../chains/registry/probe.json');
    vm.expectRevert();
    _harness.tryWrite('../chains/registry/fuji.json');
  }
}
