// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeCast } from '@openzeppelin/contracts/utils/math/SafeCast.sol';
import { Test } from 'forge-std/Test.sol';

import { RevenueSplitter } from 'src/RevenueSplitter.sol';

import { Deploy } from 'script/Deploy.sol';
import { DeployRevenueSplitter } from 'script/DeployRevenueSplitter.s.sol';

contract UnitDeployRevenueSplitter is Test {
  string internal constant _KEY = 'fuji-revenue-splitter';
  string internal constant _REGISTRY = './test/fixtures/registry';
  string internal constant _PARAMS = './test/fixtures/params';
  string internal constant _DEPLOYMENTS = '../chains/deployments';

  address internal constant _DEPLOYER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
  address internal constant _SELLER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
  address internal constant _PLATFORM = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

  DeployRevenueSplitter internal _script;

  function setUp() public {
    _script = new DeployRevenueSplitter();
    vm.chainId(43_113);
  }

  modifier whenLoadingTheInputs() {
    _;
  }

  function test_GivenAParamsFileWithEveryParameter() external whenLoadingTheInputs {
    // it reads the deployer the seller the platform and the share
    DeployRevenueSplitter.Inputs memory _in = _script.load(_REGISTRY, _PARAMS);
    assertEq(_in.deployer, _DEPLOYER);
    assertEq(_in.seller, _SELLER);
    assertEq(_in.platform, _PLATFORM);
    assertEq(_in.platformBps, 1000);
  }

  function test_GivenAParamsFileWithoutAParameter() external whenLoadingTheInputs {
    // it reverts with ParamNotFound naming the key and the entry
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_ParamNotFound.selector, _KEY, 'platform'));
    _script.load(_REGISTRY, './test/fixtures/params-missing');
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_ParamNotFound.selector, _KEY, 'file'));
    _script.load(_REGISTRY, './test/fixtures/params-none');
  }

  function test_GivenTheChainIDIsTheAvalancheMainnet() external whenLoadingTheInputs {
    // it reverts with UnsupportedChain 43114
    vm.chainId(43_114);
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_UnsupportedChain.selector, 43_114));
    _script.load(_REGISTRY, _PARAMS);
  }

  modifier whenDeploying() {
    _;
  }

  function test_GivenLoadedInputs() external whenDeploying {
    // it deploys a splitter with the params as the deployer
    RevenueSplitter _splitter = _script.deploy(_script.load(_REGISTRY, _PARAMS));
    assertEq(_splitter.SELLER(), _SELLER);
    assertEq(_splitter.PLATFORM(), _PLATFORM);
    assertEq(_splitter.PLATFORM_BPS(), 1000);
    assertEq(address(_splitter), vm.computeCreateAddress(_DEPLOYER, vm.getNonce(_DEPLOYER) - 1));
  }

  function test_GivenAShareThatDoesNotFitInSixteenBits() external whenDeploying {
    // it reverts instead of truncating the share
    DeployRevenueSplitter.Inputs memory _in = _script.load(_REGISTRY, _PARAMS);
    _in.platformBps = 65_536 + 1000;
    vm.expectRevert(abi.encodeWithSelector(SafeCast.SafeCastOverflowedUintDowncast.selector, 16, _in.platformBps));
    _script.deploy(_in);
  }

  modifier whenRecordingTheDeployment() {
    _;
  }

  function test_GivenADryRun() external whenRecordingTheDeployment {
    // it writes no file
    DeployRevenueSplitter.Inputs memory _in = _script.load(_REGISTRY, _PARAMS);
    _script.record(_in, _script.deploy(_in), _DEPLOYMENTS);
    assertFalse(vm.exists(string.concat(_DEPLOYMENTS, '/', _KEY, '.json')));
  }

  function test_GivenTheDeployedSplitter() external whenRecordingTheDeployment {
    // it serializes the chain ID the deployer the splitter and its split
    DeployRevenueSplitter.Inputs memory _in = _script.load(_REGISTRY, _PARAMS);
    RevenueSplitter _splitter = _script.deploy(_in);
    string memory _json = _script.serialize(_in, _splitter);
    assertEq(vm.parseJsonUint(_json, '.chainId'), 43_113);
    assertEq(vm.parseJsonAddress(_json, '.deployer'), _DEPLOYER);
    assertEq(vm.parseJsonAddress(_json, '.splitter'), address(_splitter));
    assertEq(vm.parseJsonAddress(_json, '.seller'), _SELLER);
    assertEq(vm.parseJsonAddress(_json, '.platform'), _PLATFORM);
    assertEq(vm.parseJsonUint(_json, '.platformBps'), 1000);
  }

  modifier whenDryRunningOnAFujiFork() {
    _;
  }

  function test_GivenTheForkFlagIsSet() external whenDryRunningOnAFujiFork {
    // it deploys a splitter that splits real Fuji USDC
    if (!vm.envOr('FUJI_FORK', false)) vm.skip(true);
    string memory _real = vm.readFile('../chains/registry/fuji.json');
    IERC20 _usdc = IERC20(vm.parseJsonAddress(_real, '.contracts.usdc.address'));
    vm.makePersistent(address(_script));
    vm.createSelectFork(vm.parseJsonString(_real, '.rpc.public'));
    RevenueSplitter _splitter = _script.deploy(_script.load(_REGISTRY, _PARAMS));
    uint256 _sellerBefore = _usdc.balanceOf(_SELLER);
    uint256 _platformBefore = _usdc.balanceOf(_PLATFORM);
    deal(address(_usdc), address(_splitter), 1_000_000);
    _splitter.release(_usdc);
    assertEq(_usdc.balanceOf(_SELLER) - _sellerBefore, 900_000);
    assertEq(_usdc.balanceOf(_PLATFORM) - _platformBefore, 100_000);
    assertEq(_usdc.balanceOf(address(_splitter)), 0);
  }
}
