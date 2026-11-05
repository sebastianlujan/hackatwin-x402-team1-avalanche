// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { console } from 'forge-std/console.sol';

import { IcttMessenger } from 'src/IcttMessenger.sol';
import { PaymentBroker } from 'src/PaymentBroker.sol';
import { PaymentHub } from 'src/PaymentHub.sol';

import { IERC20TokenTransferrer } from 'src/interfaces/external/icm/IERC20TokenTransferrer.sol';

import { Deploy } from 'script/Deploy.sol';
import { Registry } from 'script/lib/Registry.sol';

/// @title DeployFuji
/// @notice Dry-run deploy of the hub, messenger and broker on Fuji; sign with a keystore through --account
contract DeployFuji is Deploy {
  string private constant _KEY = 'fuji';
  string private constant _L1 = 'twinpay-l1';

  /// @notice A broker allowlist pair with the selector resolved from the registry
  struct Pair {
    uint64 selector;
    address sender;
    address payer;
  }

  /// @notice A broker allowlist pair as written in params (fields in JSON key order)
  struct PairParam {
    string chain;
    address payer;
    address sender;
  }

  /// @notice Registry facts and params for one deployment
  struct Inputs {
    address router;
    address token;
    address transferrer;
    address l1Transferrer;
    bytes32 l1BlockchainId;
    address deployer;
    address owner;
    address fallbackRecipient;
    uint256 requiredGasLimit;
    uint256 recipientGasLimit;
    address receiverDeployer;
    uint256 receiverNonce;
    Pair[] pairs;
  }

  /// @notice The deployed contracts and the predicted L1 receiver
  struct Deployed {
    PaymentHub hub;
    PaymentBroker broker;
    IcttMessenger messenger;
    address predictedReceiver;
    uint256 pairsConfigured;
  }

  /// @notice Dry-run entry point; reads the directories from the environment
  function run() external {
    string memory _registryDir = Registry.registryDir();
    Inputs memory _in = load(_registryDir, _paramsDir());
    record(_in, deploy(_in), _deploymentsDir());
  }

  /// @notice Read the registry facts and params, aborting before any transaction
  function load(string memory _registryDir, string memory _paramsDir_) public returns (Inputs memory _in) {
    _requireChain(_registryDir, _KEY);
    _in.router = Registry.addressOf(_registryDir, _KEY, 'ccipRouter');
    _in.token = Registry.addressOf(_registryDir, _KEY, 'usdc');
    _in.transferrer = Registry.icmAddressOf(_registryDir, _KEY, 'usdcTokenHome');
    _in.l1Transferrer = Registry.icmAddressOf(_registryDir, _L1, 'usdcTokenRemote');
    _in.l1BlockchainId = Registry.blockchainIdOf(_registryDir, _L1);

    string memory _params = _readParams(_paramsDir_, _KEY);
    _in.deployer = _paramAddress(_params, _KEY, 'deployer');
    _in.owner = _paramAddress(_params, _KEY, 'owner');
    _in.fallbackRecipient = _paramAddress(_params, _KEY, 'fallbackRecipient');
    _in.requiredGasLimit = _paramUint(_params, _KEY, 'requiredGasLimit');
    _in.recipientGasLimit = _paramUint(_params, _KEY, 'recipientGasLimit');
    _in.receiverDeployer = _paramAddress(_params, _KEY, 'receiverDeployer');
    _in.receiverNonce = _paramUint(_params, _KEY, 'receiverDeployerNonce');
    _in.pairs = _pairs(_registryDir, _params);
  }

  /// @notice Deploy and configure the Fuji contracts from the inputs
  function deploy(Inputs memory _in) public returns (Deployed memory _out) {
    _out.predictedReceiver = vm.computeCreateAddress(_in.receiverDeployer, _in.receiverNonce);
    vm.startBroadcast(_in.deployer);
    _out.hub = new PaymentHub(_in.owner);
    _out.messenger = new IcttMessenger(
      address(_out.hub),
      IERC20TokenTransferrer(_in.transferrer),
      _in.token,
      _in.l1BlockchainId,
      _in.l1Transferrer,
      _out.predictedReceiver,
      _in.requiredGasLimit,
      _in.recipientGasLimit,
      _in.fallbackRecipient
    );
    _out.hub.enableMessenger(address(_out.messenger));
    _out.broker = new PaymentBroker(_in.router, address(_out.hub), _in.owner);
    for (uint256 _i; _i < _in.pairs.length; ++_i) {
      _out.broker.setAllowedSender(_in.pairs[_i].selector, _in.pairs[_i].sender, _in.pairs[_i].payer);
    }
    vm.stopBroadcast();
    _out.pairsConfigured = _in.pairs.length;
    if (_out.pairsConfigured == 0) console.log('No broker pair in params: allowlist not configured');
  }

  /// @notice Write the Fuji record, only in the broadcast context
  function record(Inputs memory _in, Deployed memory _out, string memory _dir) public {
    _writeRecord(_dir, _KEY, serialize(_in, _out));
  }

  /// @notice The Fuji deployment record as JSON
  function serialize(Inputs memory _in, Deployed memory _out) public returns (string memory _json) {
    string memory _obj = 'fuji';
    vm.serializeUint(_obj, 'chainId', block.chainid);
    vm.serializeAddress(_obj, 'deployer', _in.deployer);
    vm.serializeAddress(_obj, 'hub', address(_out.hub));
    vm.serializeAddress(_obj, 'broker', address(_out.broker));
    vm.serializeAddress(_obj, 'messenger', address(_out.messenger));
    vm.serializeAddress(_obj, 'receiverDeployer', _in.receiverDeployer);
    vm.serializeUint(_obj, 'receiverDeployerNonce', _in.receiverNonce);
    _json = vm.serializeAddress(_obj, 'predictedReceiver', _out.predictedReceiver);
  }

  function _pairs(string memory _registryDir, string memory _params) private returns (Pair[] memory _list) {
    if (!vm.keyExistsJson(_params, '.brokerPairs')) return _list;
    PairParam[] memory _raw = abi.decode(vm.parseJson(_params, '.brokerPairs'), (PairParam[]));
    _list = new Pair[](_raw.length);
    for (uint256 _i; _i < _raw.length; ++_i) {
      _list[_i] = Pair(Registry.selectorOf(_registryDir, _raw[_i].chain), _raw[_i].sender, _raw[_i].payer);
    }
  }
}
