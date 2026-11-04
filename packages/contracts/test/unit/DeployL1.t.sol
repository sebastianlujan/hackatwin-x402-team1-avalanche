// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable2Step } from '@openzeppelin/contracts/access/Ownable2Step.sol';
import { Test } from 'forge-std/Test.sol';
import { Vm } from 'forge-std/Vm.sol';

import { SettlementReceiver } from 'src/SettlementReceiver.sol';
import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';

import { Deploy } from 'script/Deploy.sol';
import { DeployFuji } from 'script/DeployFuji.s.sol';
import { DeployL1 } from 'script/DeployL1.s.sol';
import { Registry } from 'script/lib/Registry.sol';

contract UnitDeployL1 is Test {
  string internal constant _REGISTRY = './test/fixtures/registry';
  string internal constant _PARAMS = './test/fixtures/params';
  string internal constant _RECORDS = './test/fixtures/deployments';
  string internal constant _DEPLOYMENTS = '../chains/deployments';

  address internal constant _DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
  address internal constant _NEW_OWNER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
  address internal constant _PREDICTED = 0x5FbDB2315678afecb367f032d93F642f64180aa3;

  DeployL1 internal _script;

  function setUp() public {
    _script = new DeployL1();
    vm.chainId(100_001);
  }

  modifier whenLoadingTheL1Inputs() {
    _;
  }

  function test_GivenTheRealRegistryThatHasNoL1ChainIDYet() external whenLoadingTheL1Inputs {
    // it reverts with EntryNotFound naming the L1 key and chainId
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'twinpay-l1', 'chainId'));
    _script.load('../chains/registry', './script/params', _DEPLOYMENTS);
  }

  function test_GivenFixturesWithEveryFactAndParameter() external whenLoadingTheL1Inputs {
    // it resolves facts from the registry and choices from params and the Fuji record
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, _PARAMS, _RECORDS);
    assertEq(_in.transferrer, 0x3333333333333333333333333333333333333333);
    assertEq(_in.sourceBlockchainId, bytes32(uint256(0xaa) * (type(uint256).max / 0xff)));
    assertEq(_in.originTransferrer, 0x1111111111111111111111111111111111111111);
    assertEq(_in.deployer, _DEPLOYER);
    assertEq(_in.owner, _DEPLOYER);
    assertEq(_in.receiverNonce, 0);
    assertEq(_in.merchants.length, 0);
    assertEq(_in.fuji.messenger, 0x6666666666666666666666666666666666666666);
    assertEq(_in.fuji.predictedReceiver, _PREDICTED);
  }

  function test_GivenTheChainIDIsTheAvalancheMainnet() external whenLoadingTheL1Inputs {
    // it reverts with UnsupportedChain 43114
    vm.chainId(43_114);
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_UnsupportedChain.selector, 43_114));
    _script.load(_REGISTRY, _PARAMS, _RECORDS);
  }

  function test_GivenNoFujiRecord() external whenLoadingTheL1Inputs {
    // it reverts with ParamNotFound naming the record
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_ParamNotFound.selector, 'fuji', 'record'));
    _script.load(_REGISTRY, _PARAMS, './test/fixtures/deployments-none');
  }

  modifier whenDeployingTheReceiver() {
    _;
  }

  function test_GivenTheFujiDeployResultAndFixtureInputs() external whenDeployingTheReceiver {
    // it deploys a receiver at the predicted address wired to the messenger
    vm.chainId(43_113);
    DeployFuji fuji = new DeployFuji();
    DeployFuji.Deployed memory _fuji = fuji.deploy(fuji.load(_REGISTRY, _PARAMS));
    vm.chainId(100_001);
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, _PARAMS, _RECORDS);
    _in.fuji = DeployL1.FujiRecord(address(_fuji.messenger), _fuji.predictedReceiver);
    SettlementReceiver _receiver = _script.deploy(_in).receiver;
    assertEq(address(_receiver), _fuji.predictedReceiver);
    assertEq(_fuji.messenger.RECEIVER(), address(_receiver));
    assertEq(_receiver.ORIGIN_SENDER(), address(_fuji.messenger));
    assertEq(_receiver.TRANSFERRER(), 0x3333333333333333333333333333333333333333);
    assertEq(_receiver.TOKEN(), 0x3333333333333333333333333333333333333333);
    assertEq(_receiver.ORIGIN_TRANSFERRER(), 0x1111111111111111111111111111111111111111);
    assertEq(_receiver.SOURCE_BLOCKCHAIN_ID(), bytes32(uint256(0xaa) * (type(uint256).max / 0xff)));
    assertEq(_receiver.owner(), _DEPLOYER);
  }

  function test_GivenAReceiverDeployerNonceThatMoved() external whenDeployingTheReceiver {
    // it reverts with NonceMismatch before any deployment
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, _PARAMS, _RECORDS);
    vm.setNonce(_DEPLOYER, 3);
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_NonceMismatch.selector, 0, 3));
    _script.deploy(_in);
    assertEq(vm.getNonce(_DEPLOYER), 3);
  }

  function test_GivenAFujiRecordWithAnotherPredictedReceiver() external whenDeployingTheReceiver {
    // it reverts with AddressMismatch before any deployment
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, _PARAMS, _RECORDS);
    _in.fuji.predictedReceiver = address(0xdead);
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_AddressMismatch.selector, address(0xdead), _PREDICTED));
    _script.deploy(_in);
    assertEq(vm.getNonce(_DEPLOYER), 0);
  }

  function test_GivenNoMerchantInParams() external whenDeployingTheReceiver {
    // it makes no allowlist call
    vm.recordLogs();
    DeployL1.Deployed memory _out = _script.deploy(_script.load(_REGISTRY, _PARAMS, _RECORDS));
    assertEq(_merchantsSet(address(_out.receiver)).length, 0);
    assertEq(_out.merchantsConfigured, 0);
  }

  function test_GivenMerchantsInParams() external whenDeployingTheReceiver {
    // it allows each merchant on the receiver
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, './test/fixtures/params-merchant', _RECORDS);
    assertEq(_in.merchants.length, 2);
    vm.recordLogs();
    DeployL1.Deployed memory _out = _script.deploy(_in);
    assertEq(_out.merchantsConfigured, 2);
    address[] memory _set = _merchantsSet(address(_out.receiver));
    assertEq(_set.length, 2);
    assertEq(_set[0], 0x7777777777777777777777777777777777777777);
    assertEq(_set[1], 0x8888888888888888888888888888888888888888);
  }

  function test_GivenAnOwnerOtherThanTheDeployer() external whenDeployingTheReceiver {
    // it applies the merchants as the deployer and leaves the owner as pending owner
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, './test/fixtures/params-merchant', _RECORDS);
    _in.owner = _NEW_OWNER;
    vm.recordLogs();
    DeployL1.Deployed memory _out = _script.deploy(_in);
    assertEq(Ownable2Step(address(_out.receiver)).owner(), _DEPLOYER);
    assertEq(Ownable2Step(address(_out.receiver)).pendingOwner(), _NEW_OWNER);
    assertEq(_merchantsSet(address(_out.receiver)).length, 2);
    vm.prank(_NEW_OWNER);
    Ownable2Step(address(_out.receiver)).acceptOwnership();
    assertEq(Ownable2Step(address(_out.receiver)).owner(), _NEW_OWNER);
  }

  function test_GivenAnOwnerEqualToTheDeployer() external whenDeployingTheReceiver {
    // it leaves no pending owner
    DeployL1.Deployed memory _out = _script.deploy(_script.load(_REGISTRY, _PARAMS, _RECORDS));
    assertEq(Ownable2Step(address(_out.receiver)).owner(), _DEPLOYER);
    assertEq(Ownable2Step(address(_out.receiver)).pendingOwner(), address(0));
  }

  modifier whenRecordingTheDeployment() {
    _;
  }

  function test_GivenADryRun() external whenRecordingTheDeployment {
    // it writes no file
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, _PARAMS, _RECORDS);
    _script.record(_in, _script.deploy(_in), _DEPLOYMENTS);
    assertFalse(vm.exists(string.concat(_DEPLOYMENTS, '/twinpay-l1.json')));
  }

  function test_GivenTheDeployedReceiver() external whenRecordingTheDeployment {
    // it serializes the chain ID the deployer and the receiver
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, _PARAMS, _RECORDS);
    DeployL1.Deployed memory _out = _script.deploy(_in);
    string memory _json = _script.serialize(_in, _out);
    assertEq(vm.parseJsonUint(_json, '.chainId'), 100_001);
    assertEq(vm.parseJsonAddress(_json, '.deployer'), _DEPLOYER);
    assertEq(vm.parseJsonAddress(_json, '.receiver'), address(_out.receiver));
  }

  function test_GivenAnOwnerOtherThanTheDeployer_WhenRecordingTheDeployment() external whenRecordingTheDeployment {
    // it serializes the pending owner
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, _PARAMS, _RECORDS);
    _in.owner = _NEW_OWNER;
    string memory _json = _script.serialize(_in, _script.deploy(_in));
    assertEq(vm.parseJsonAddress(_json, '.pendingOwner'), _NEW_OWNER);
  }

  function test_GivenAnOwnerEqualToTheDeployer_WhenRecordingTheDeployment() external whenRecordingTheDeployment {
    // it serializes no pending owner
    DeployL1.Inputs memory _in = _script.load(_REGISTRY, _PARAMS, _RECORDS);
    string memory _json = _script.serialize(_in, _script.deploy(_in));
    assertEq(vm.parseJsonAddress(_json, '.pendingOwner'), address(0));
  }

  function _merchantsSet(address _emitter) internal returns (address[] memory _merchants) {
    Vm.Log[] memory _logs = vm.getRecordedLogs();
    address[] memory _found = new address[](_logs.length);
    uint256 _count;
    for (uint256 _i; _i < _logs.length; ++_i) {
      if (_logs[_i].emitter == _emitter && _logs[_i].topics[0] == ISettlementReceiver.MerchantSet.selector) {
        _found[_count++] = address(uint160(uint256(_logs[_i].topics[1])));
      }
    }
    _merchants = new address[](_count);
    for (uint256 _j; _j < _count; ++_j) {
      _merchants[_j] = _found[_j];
    }
  }
}
