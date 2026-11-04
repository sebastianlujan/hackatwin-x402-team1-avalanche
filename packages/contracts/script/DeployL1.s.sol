// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { console } from 'forge-std/console.sol';

import { SettlementReceiver } from 'src/SettlementReceiver.sol';

import { Deploy } from 'script/Deploy.sol';
import { Registry } from 'script/lib/Registry.sol';

/// @title DeployL1
/// @notice Dry-run deploy of the settlement receiver on the L1; sign with a keystore through --account
contract DeployL1 is Deploy {
  string private constant _KEY = 'twinpay-l1';
  string private constant _FUJI = 'fuji';

  /// @notice The Fuji facts the receiver needs from the Fuji record
  struct FujiRecord {
    address messenger;
    address predictedReceiver;
  }

  /// @notice Registry facts, params and the Fuji record for one deployment
  struct Inputs {
    address transferrer;
    bytes32 sourceBlockchainId;
    address originTransferrer;
    address deployer;
    address owner;
    uint256 receiverNonce;
    address[] merchants;
    FujiRecord fuji;
  }

  /// @notice The deployed receiver
  struct Deployed {
    SettlementReceiver receiver;
    uint256 merchantsConfigured;
  }

  /// @notice Dry-run entry point; reads the directories from the environment
  function run() external {
    Inputs memory _in = load(Registry.registryDir(), _paramsDir(), _deploymentsDir());
    record(_in, deploy(_in), _deploymentsDir());
  }

  /// @notice Read the registry facts, params and Fuji record, aborting before any transaction
  function load(
    string memory _registryDir,
    string memory _paramsDir_,
    string memory _recordsDir
  )
    public
    returns (Inputs memory _in)
  {
    _requireChain(_registryDir, _KEY);
    _in.transferrer = Registry.icmAddressOf(_registryDir, _KEY, 'usdcTokenRemote');
    _in.sourceBlockchainId = Registry.blockchainIdOf(_registryDir, _FUJI);
    _in.originTransferrer = Registry.icmAddressOf(_registryDir, _FUJI, 'usdcTokenHome');

    string memory _params = _readParams(_paramsDir_, _KEY);
    _in.deployer = _paramAddress(_params, _KEY, 'deployer');
    _in.owner = _paramAddress(_params, _KEY, 'owner');
    _in.receiverNonce = _paramUint(_params, _KEY, 'receiverDeployerNonce');
    if (vm.keyExistsJson(_params, '.merchants')) _in.merchants = vm.parseJsonAddressArray(_params, '.merchants');

    string memory _path = string.concat(_recordsDir, '/', _FUJI, '.json');
    if (!vm.exists(_path)) revert Deploy_ParamNotFound(_FUJI, 'record');
    string memory _record = vm.readFile(_path);
    _in.fuji =
      FujiRecord(_paramAddress(_record, _FUJI, 'messenger'), _paramAddress(_record, _FUJI, 'predictedReceiver'));
  }

  /// @notice Check the nonce and the prediction, deploy the receiver, then check its address
  function deploy(Inputs memory _in) public returns (Deployed memory _out) {
    uint256 _nonce = vm.getNonce(_in.deployer);
    if (_nonce != _in.receiverNonce) revert Deploy_NonceMismatch(_in.receiverNonce, _nonce);
    address _predicted = vm.computeCreateAddress(_in.deployer, _nonce);
    if (_predicted != _in.fuji.predictedReceiver) {
      revert Deploy_AddressMismatch(_in.fuji.predictedReceiver, _predicted);
    }

    vm.startBroadcast(_in.deployer);
    // The ICTT remote contract is its own ERC-20, so the token equals the transferrer
    _out.receiver = new SettlementReceiver(
      _in.transferrer, _in.sourceBlockchainId, _in.originTransferrer, _in.fuji.messenger, _in.transferrer, _in.owner
    );
    for (uint256 _i; _i < _in.merchants.length; ++_i) {
      _out.receiver.setMerchant(_in.merchants[_i], true);
    }
    vm.stopBroadcast();

    if (address(_out.receiver) != _predicted) revert Deploy_AddressMismatch(_predicted, address(_out.receiver));
    _out.merchantsConfigured = _in.merchants.length;
    if (_out.merchantsConfigured == 0) console.log('No merchant in params: allowlist not configured');
  }

  /// @notice Write the L1 record, only in the broadcast context
  function record(Inputs memory _in, Deployed memory _out, string memory _dir) public {
    _writeRecord(_dir, _KEY, serialize(_in, _out));
  }

  /// @notice The L1 deployment record as JSON
  function serialize(Inputs memory _in, Deployed memory _out) public returns (string memory _json) {
    string memory _obj = 'l1';
    vm.serializeUint(_obj, 'chainId', block.chainid);
    vm.serializeAddress(_obj, 'deployer', _in.deployer);
    _json = vm.serializeAddress(_obj, 'receiver', address(_out.receiver));
  }
}
