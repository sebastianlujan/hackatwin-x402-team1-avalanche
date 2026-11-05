// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { Registry } from 'script/lib/Registry.sol';
import { RegistryHarness } from 'test/utils/RegistryHarness.sol';

contract UnitRegistryIcm is Test {
  string internal constant _FIXTURES = './test/fixtures/registry';

  RegistryHarness internal _harness;

  function setUp() public {
    _harness = new RegistryHarness();
  }

  modifier whenReadingTheChainIDOfAKey() {
    _;
  }

  function test_GivenTheEntryHasAChainID() external whenReadingTheChainIDOfAKey {
    // it returns it
    assertEq(_harness.chainIdOf(_FIXTURES, 'fuji'), 43_113);
    assertEq(_harness.chainIdOf(_FIXTURES, 'twinpay-l1'), 100_001);
    assertEq(_harness.chainIdOf('../chains/registry', 'cchain'), 43_114);
  }

  function test_GivenTheEntryHasNoChainID() external whenReadingTheChainIDOfAKey {
    // it reverts with EntryNotFound naming the key and chainId
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'twinpay-l1', 'chainId'));
    _harness.chainIdOf('../chains/registry', 'twinpay-l1');
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'nothing', 'file'));
    _harness.chainIdOf(_FIXTURES, 'nothing');
  }

  modifier whenReadingTheICMBlockchainID() {
    _;
  }

  function test_GivenTheEntryHasOne() external whenReadingTheICMBlockchainID {
    // it returns the bytes32
    assertEq(
      _harness.blockchainIdOf(_FIXTURES, 'twinpay-l1'),
      bytes32(0x2222222222222222222222222222222222222222222222222222222222222222)
    );
  }

  function test_GivenTheEntryHasNone() external whenReadingTheICMBlockchainID {
    // it reverts with EntryNotFound naming icm blockchainId
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'fuji', 'icm.blockchainId'));
    _harness.blockchainIdOf('./test/fixtures/registry-partial', 'fuji');
  }

  modifier whenReadingAnICMTransferrer() {
    _;
  }

  function test_GivenTheEntryHasTheTransferrer() external whenReadingAnICMTransferrer {
    // it returns the address
    assertEq(
      _harness.icmAddressOf(_FIXTURES, 'fuji', 'usdcTokenHome'), address(0x1111111111111111111111111111111111111111)
    );
    assertEq(
      _harness.icmAddressOf(_FIXTURES, 'twinpay-l1', 'usdcTokenRemote'),
      address(0x3333333333333333333333333333333333333333)
    );
  }

  function test_GivenTheEntryHasNone_WhenReadingAnICMTransferrer() external whenReadingAnICMTransferrer {
    // it reverts with EntryNotFound naming the transferrer
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'fuji', 'icm.usdcTokenRemote'));
    _harness.icmAddressOf(_FIXTURES, 'fuji', 'usdcTokenRemote');
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'twinpay-l1', 'icm.usdcTokenHome'));
    _harness.icmAddressOf('../chains/registry', 'twinpay-l1', 'usdcTokenHome');
  }

  function test_WhenReadingASelectorFromAnExplicitDirectory() external {
    // it returns the selector of that directory
    assertEq(_harness.selectorOfIn(_FIXTURES, 'sepolia'), 16_015_286_601_757_825_753);
    assertEq(_harness.selectorOfIn(_FIXTURES, 'fuji'), 14_767_482_510_784_806_043);
  }
}
