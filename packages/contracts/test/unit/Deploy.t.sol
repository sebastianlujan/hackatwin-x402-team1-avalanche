// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { Deploy } from 'script/Deploy.sol';
import { DeployHarness } from 'test/utils/DeployHarness.sol';
import { RegistryHarness } from 'test/utils/RegistryHarness.sol';

contract UnitDeploy is Test {
  string internal constant _REGISTRY = './test/fixtures/registry';
  string internal constant _PARAMS = './test/fixtures/params';
  string internal constant _DEPLOYMENTS = '../chains/deployments';

  DeployHarness internal _harness;

  function setUp() public {
    _harness = new DeployHarness();
  }

  modifier whenCheckingTheChain() {
    _;
  }

  function test_GivenTheChainIDMatchesTheRegistryChainIDOfTheKey() external whenCheckingTheChain {
    // it passes
    vm.chainId(43_113);
    _harness.requireChain(_REGISTRY, 'fuji');
    vm.chainId(100_001);
    _harness.requireChain(_REGISTRY, 'twinpay-l1');
  }

  function test_GivenTheChainIDIsAnotherRegisteredChain() external whenCheckingTheChain {
    // it reverts with UnsupportedChain naming the chain ID
    vm.chainId(11_155_111);
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_UnsupportedChain.selector, 11_155_111));
    _harness.requireChain(_REGISTRY, 'fuji');
    vm.chainId(1);
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_UnsupportedChain.selector, 1));
    _harness.requireChain(_REGISTRY, 'twinpay-l1');
  }

  function test_GivenTheChainIDIsTheAvalancheMainnet() external whenCheckingTheChain {
    // it reverts with UnsupportedChain 43114
    vm.chainId(43_114);
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_UnsupportedChain.selector, 43_114));
    _harness.requireChain('../chains/registry', 'fuji');
  }

  modifier whenReadingParameters() {
    _;
  }

  function test_GivenAParamsFileWithTheEntry() external whenReadingParameters {
    // it returns the address and the number
    string memory _json = _harness.readParams(_PARAMS, 'fuji');
    assertEq(_harness.paramAddress(_json, 'fuji', 'owner'), 0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
    assertEq(_harness.paramAddress(_json, 'fuji', 'fallbackRecipient'), 0x90F79bf6EB2c4f870365E785982E1f101E93b906);
    assertEq(_harness.paramUint(_json, 'fuji', 'requiredGasLimit'), 500_000);
    assertEq(_harness.paramUint(_json, 'fuji', 'receiverDeployerNonce'), 0);
  }

  function test_GivenAParamsFileWithoutTheEntry() external whenReadingParameters {
    // it reverts with ParamNotFound naming the key and the entry
    string memory _json = _harness.readParams('./test/fixtures/params-missing', 'fuji');
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_ParamNotFound.selector, 'fuji', 'fallbackRecipient'));
    _harness.paramAddress(_json, 'fuji', 'fallbackRecipient');
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_ParamNotFound.selector, 'fuji', 'unknownNumber'));
    _harness.paramUint(_json, 'fuji', 'unknownNumber');
  }

  function test_GivenNoParamsFile() external whenReadingParameters {
    // it reverts with ParamNotFound naming the file
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_ParamNotFound.selector, 'fuji', 'file'));
    _harness.readParams('./test/fixtures/params-none', 'fuji');
  }

  modifier whenWritingTheDeploymentRecord() {
    _;
  }

  function test_GivenAContextThatIsNotABroadcast() external whenWritingTheDeploymentRecord {
    // it writes no file
    assertFalse(vm.exists(string.concat(_DEPLOYMENTS, '/probe.json')));
    _harness.writeRecord(_DEPLOYMENTS, 'probe', '{"chainId":43113}');
    assertFalse(vm.exists(string.concat(_DEPLOYMENTS, '/probe.json')));
  }

  function test_GivenTheProjectFilePermissions() external whenWritingTheDeploymentRecord {
    // it grants write only to the deployments directory
    RegistryHarness _files = new RegistryHarness();
    string[4] memory _refused =
      ['../chains/registry/probe.json', './script/params/probe.json', './test/fixtures/probe.json', './src/probe.json'];
    for (uint256 _i; _i < _refused.length; ++_i) {
      vm.expectRevert();
      _files.tryWrite(_refused[_i]);
    }
    string memory _probe = string.concat(_DEPLOYMENTS, '/probe.json');
    _files.tryWrite(_probe);
    assertTrue(vm.exists(_probe));
    vm.removeFile(_probe);
    assertFalse(vm.exists(_probe));
  }
}
