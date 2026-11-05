// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable2Step } from '@openzeppelin/contracts/access/Ownable2Step.sol';
import { Script } from 'forge-std/Script.sol';
import { VmSafe } from 'forge-std/Vm.sol';

import { Registry } from 'script/lib/Registry.sol';

/// @title Deploy
/// @notice Shared inputs, chain gate and record gate of the deploy scripts; sends nothing by itself
abstract contract Deploy is Script {
  string private constant _DEFAULT_PARAMS_DIR = './script/params';
  string private constant _DEFAULT_DEPLOYMENTS_DIR = '../chains/deployments';

  /// @notice The chain is not the one registered for this script
  error Deploy_UnsupportedChain(uint256 _chainId);
  /// @notice A deploy parameter or the params file is missing
  error Deploy_ParamNotFound(string _key, string _entry);
  /// @notice The receiver deployer nonce moved from the params nonce
  error Deploy_NonceMismatch(uint256 _expected, uint256 _actual);
  /// @notice A deployed or recorded address differs from the prediction
  error Deploy_AddressMismatch(address _expected, address _actual);

  /// @notice The params directory, overridable with DEPLOY_PARAMS_DIR
  function _paramsDir() internal view returns (string memory _dir) {
    _dir = vm.envOr('DEPLOY_PARAMS_DIR', _DEFAULT_PARAMS_DIR);
  }

  /// @notice The deployments directory, overridable with DEPLOY_DEPLOYMENTS_DIR
  function _deploymentsDir() internal view returns (string memory _dir) {
    _dir = vm.envOr('DEPLOY_DEPLOYMENTS_DIR', _DEFAULT_DEPLOYMENTS_DIR);
  }

  /// @notice Revert unless the running chain is the registry chain ID of the key
  function _requireChain(string memory _registryDir, string memory _key) internal {
    if (block.chainid != Registry.chainIdOf(_registryDir, _key)) revert Deploy_UnsupportedChain(block.chainid);
  }

  /// @notice Read the params file of a chain key
  function _readParams(string memory _dir, string memory _key) internal returns (string memory _json) {
    string memory _path = string.concat(_dir, '/', _key, '.json');
    if (!vm.exists(_path)) revert Deploy_ParamNotFound(_key, 'file');
    _json = vm.readFile(_path);
  }

  /// @notice Read an address parameter
  function _paramAddress(
    string memory _json,
    string memory _key,
    string memory _entry
  )
    internal
    view
    returns (address _value)
  {
    _requireParam(_json, _key, _entry);
    _value = vm.parseJsonAddress(_json, string.concat('.', _entry));
  }

  /// @notice Read a number parameter
  function _paramUint(
    string memory _json,
    string memory _key,
    string memory _entry
  )
    internal
    view
    returns (uint256 _value)
  {
    _requireParam(_json, _key, _entry);
    _value = vm.parseJsonUint(_json, string.concat('.', _entry));
  }

  /// @notice Offer ownership of a contract to the owner, a no-op when the owner is the deployer
  function _offerOwnership(address _target, address _deployer, address _owner) internal {
    if (_owner != _deployer) Ownable2Step(_target).transferOwnership(_owner);
  }

  /// @notice The pending owner of a contract, zero when none
  function _pendingOwnerOf(address _target) internal view returns (address _pending) {
    _pending = Ownable2Step(_target).pendingOwner();
  }

  /// @notice Write the deployment record, only in the script broadcast context
  function _writeRecord(string memory _dir, string memory _key, string memory _json) internal {
    if (!vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) return;
    vm.createDir(_dir, true);
    vm.writeJson(_json, string.concat(_dir, '/', _key, '.json'));
  }

  function _requireParam(string memory _json, string memory _key, string memory _entry) private view {
    if (!vm.keyExistsJson(_json, string.concat('.', _entry))) revert Deploy_ParamNotFound(_key, _entry);
  }
}
