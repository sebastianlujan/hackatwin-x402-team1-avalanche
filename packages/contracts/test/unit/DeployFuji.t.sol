// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';
import { Vm } from 'forge-std/Vm.sol';

import { IcttMessenger } from 'src/IcttMessenger.sol';
import { PaymentBroker } from 'src/PaymentBroker.sol';
import { PaymentHub } from 'src/PaymentHub.sol';

import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';

import { Deploy } from 'script/Deploy.sol';
import { DeployFuji } from 'script/DeployFuji.s.sol';
import { Registry } from 'script/lib/Registry.sol';

contract UnitDeployFuji is Test {
  string internal constant _REGISTRY = './test/fixtures/registry';
  string internal constant _PARAMS = './test/fixtures/params';
  string internal constant _DEPLOYMENTS = '../chains/deployments';

  address internal constant _OWNER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
  address internal constant _RECEIVER_DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

  DeployFuji internal _script;

  function setUp() public {
    _script = new DeployFuji();
    vm.chainId(43_113);
  }

  modifier whenLoadingTheFujiInputs() {
    _;
  }

  function test_GivenFixturesWithEveryFactAndParameter() external whenLoadingTheFujiInputs {
    // it resolves facts from the registry and choices from params
    DeployFuji.Inputs memory _in = _script.load(_REGISTRY, _PARAMS);
    assertEq(_in.router, 0xF694E193200268f9a4868e4Aa017A0118C9a8177);
    assertEq(_in.token, 0x5425890298aed601595a70AB815c96711a31Bc65);
    assertEq(_in.transferrer, 0x1111111111111111111111111111111111111111);
    assertEq(_in.l1Transferrer, 0x3333333333333333333333333333333333333333);
    assertEq(_in.l1BlockchainId, bytes32(0x2222222222222222222222222222222222222222222222222222222222222222));
    assertEq(_in.deployer, _OWNER);
    assertEq(_in.owner, _OWNER);
    assertEq(_in.fallbackRecipient, 0x90F79bf6EB2c4f870365E785982E1f101E93b906);
    assertEq(_in.requiredGasLimit, 500_000);
    assertEq(_in.recipientGasLimit, 300_000);
    assertEq(_in.receiverDeployer, _RECEIVER_DEPLOYER);
    assertEq(_in.pairs.length, 0);
  }

  function test_GivenARegistryWithoutAnEntry() external whenLoadingTheFujiInputs {
    // it reverts with EntryNotFound naming the key and the entry
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'fuji', 'icm.usdcTokenHome'));
    _script.load('./test/fixtures/registry-partial', _PARAMS);
    vm.expectRevert(abi.encodeWithSelector(Registry.Registry_EntryNotFound.selector, 'fuji', 'file'));
    _script.load('./test/fixtures/registry-none', _PARAMS);
  }

  function test_GivenAParamsFileWithoutAParameter() external whenLoadingTheFujiInputs {
    // it reverts with ParamNotFound naming the key and the entry
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_ParamNotFound.selector, 'fuji', 'fallbackRecipient'));
    _script.load(_REGISTRY, './test/fixtures/params-missing');
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_ParamNotFound.selector, 'fuji', 'file'));
    _script.load(_REGISTRY, './test/fixtures/params-none');
  }

  function test_GivenTheChainIDIsTheAvalancheMainnet() external whenLoadingTheFujiInputs {
    // it reverts with UnsupportedChain 43114
    vm.chainId(43_114);
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_UnsupportedChain.selector, 43_114));
    _script.load(_REGISTRY, _PARAMS);
    vm.expectRevert(abi.encodeWithSelector(Deploy.Deploy_UnsupportedChain.selector, 43_114));
    _script.load('../chains/registry', './script/params');
  }

  function test_GivenTheCommittedFujiParams() external whenLoadingTheFujiInputs {
    // it holds gas limits the messenger accepts and no wallet
    string memory _json = vm.readFile('./script/params/fuji.json');
    assertEq(vm.parseJsonUint(_json, '.requiredGasLimit'), 500_000);
    assertEq(vm.parseJsonUint(_json, '.recipientGasLimit'), 300_000);
    assertFalse(vm.keyExistsJson(_json, '.deployer'));
  }

  modifier whenDeploying() {
    _;
  }

  function test_GivenLoadedInputs() external whenDeploying {
    // it deploys a hub a messenger and a broker wired to the registry facts
    vm.recordLogs();
    DeployFuji.Deployed memory _out = _script.deploy(_script.load(_REGISTRY, _PARAMS));
    assertEq(PaymentHub(address(_out.hub)).owner(), _OWNER);
    assertEq(PaymentBroker(address(_out.broker)).owner(), _OWNER);
    assertEq(address(PaymentBroker(address(_out.broker)).HUB()), address(_out.hub));
    assertEq(PaymentBroker(address(_out.broker)).getRouter(), 0xF694E193200268f9a4868e4Aa017A0118C9a8177);
    IcttMessenger _messenger = IcttMessenger(address(_out.messenger));
    assertEq(_messenger.HUB(), address(_out.hub));
    assertEq(_messenger.TOKEN(), 0x5425890298aed601595a70AB815c96711a31Bc65);
    assertEq(address(_messenger.TRANSFERRER()), 0x1111111111111111111111111111111111111111);
    assertEq(_messenger.DESTINATION_TRANSFERRER(), 0x3333333333333333333333333333333333333333);
    assertEq(
      _messenger.DESTINATION_BLOCKCHAIN_ID(),
      bytes32(0x2222222222222222222222222222222222222222222222222222222222222222)
    );
    assertEq(_messenger.FALLBACK_RECIPIENT(), 0x90F79bf6EB2c4f870365E785982E1f101E93b906);
    assertEq(_messenger.REQUIRED_GAS_LIMIT(), 500_000);
    assertEq(_messenger.RECIPIENT_GAS_LIMIT(), 300_000);
    assertEq(_countLogs(address(_out.hub), IPaymentHub.MessengerEnabled.selector), 1);
  }

  function test_GivenAReceiverDeployerAndNonce() external whenDeploying {
    // it gives the messenger the predicted receiver address
    DeployFuji.Deployed memory _out = _script.deploy(_script.load(_REGISTRY, _PARAMS));
    assertEq(_out.predictedReceiver, vm.computeCreateAddress(_RECEIVER_DEPLOYER, 0));
    assertEq(IcttMessenger(address(_out.messenger)).RECEIVER(), _out.predictedReceiver);
    DeployFuji.Inputs memory _in = _script.load(_REGISTRY, _PARAMS);
    _in.receiverNonce = 7;
    _out = _script.deploy(_in);
    assertEq(IcttMessenger(address(_out.messenger)).RECEIVER(), vm.computeCreateAddress(_RECEIVER_DEPLOYER, 7));
  }

  function test_GivenNoBrokerPairInParams() external whenDeploying {
    // it makes no allowlist call
    vm.recordLogs();
    DeployFuji.Deployed memory _out = _script.deploy(_script.load(_REGISTRY, _PARAMS));
    assertEq(_countLogs(address(_out.broker), IPaymentBroker.AllowedSenderSet.selector), 0);
    assertEq(_out.pairsConfigured, 0);
  }

  function test_GivenABrokerPairInParams() external whenDeploying {
    // it allows the sender with the selector read from the registry
    DeployFuji.Inputs memory _in = _script.load(_REGISTRY, './test/fixtures/params-pair');
    assertEq(_in.pairs.length, 1);
    vm.recordLogs();
    DeployFuji.Deployed memory _out = _script.deploy(_in);
    assertEq(_out.pairsConfigured, 1);
    assertEq(_countLogs(address(_out.broker), IPaymentBroker.AllowedSenderSet.selector), 1);
    assertEq(
      IPaymentBroker(address(_out.broker))
        .payerOf(16_015_286_601_757_825_753, 0x4444444444444444444444444444444444444444),
      0x5555555555555555555555555555555555555555
    );
  }

  modifier whenRecordingTheDeployment() {
    _;
  }

  function test_GivenADryRun() external whenRecordingTheDeployment {
    // it writes no file
    DeployFuji.Inputs memory _in = _script.load(_REGISTRY, _PARAMS);
    _script.record(_in, _script.deploy(_in), _DEPLOYMENTS);
    assertFalse(vm.exists(string.concat(_DEPLOYMENTS, '/fuji.json')));
  }

  function test_GivenTheDeployedAddresses() external whenRecordingTheDeployment {
    // it serializes the chain ID the deployer and every address
    DeployFuji.Inputs memory _in = _script.load(_REGISTRY, _PARAMS);
    DeployFuji.Deployed memory _out = _script.deploy(_in);
    string memory _json = _script.serialize(_in, _out);
    assertEq(vm.parseJsonUint(_json, '.chainId'), 43_113);
    assertEq(vm.parseJsonAddress(_json, '.deployer'), _OWNER);
    assertEq(vm.parseJsonAddress(_json, '.hub'), address(_out.hub));
    assertEq(vm.parseJsonAddress(_json, '.broker'), address(_out.broker));
    assertEq(vm.parseJsonAddress(_json, '.messenger'), address(_out.messenger));
    assertEq(vm.parseJsonAddress(_json, '.receiverDeployer'), _RECEIVER_DEPLOYER);
    assertEq(vm.parseJsonUint(_json, '.receiverDeployerNonce'), 0);
    assertEq(vm.parseJsonAddress(_json, '.predictedReceiver'), _out.predictedReceiver);
  }

  modifier whenDryRunningOnAFujiFork() {
    _;
  }

  function test_GivenTheForkFlagIsSet() external whenDryRunningOnAFujiFork {
    // it deploys against the real router and USDC
    if (!vm.envOr('FUJI_FORK', false)) vm.skip(true);
    string memory _real = vm.readFile('../chains/registry/fuji.json');
    vm.makePersistent(address(_script));
    vm.createSelectFork(vm.parseJsonString(_real, '.rpc.public'));
    DeployFuji.Inputs memory _in = _script.load(_REGISTRY, _PARAMS);
    DeployFuji.Deployed memory _out = _script.deploy(_in);
    assertEq(block.chainid, 43_113);
    assertGt(_in.router.code.length, 0);
    assertEq(PaymentBroker(address(_out.broker)).getRouter(), _in.router);
  }

  function _countLogs(address _emitter, bytes32 _topic) internal returns (uint256 _count) {
    Vm.Log[] memory _logs = vm.getRecordedLogs();
    for (uint256 _i; _i < _logs.length; ++_i) {
      if (_logs[_i].emitter == _emitter && _logs[_i].topics[0] == _topic) ++_count;
    }
  }
}
