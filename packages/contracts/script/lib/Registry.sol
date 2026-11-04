// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Vm } from 'forge-std/Vm.sol';

/// @title Registry
/// @notice Reads the shared chain registry JSON (packages/chains/registry) from forge scripts and tests
library Registry {
  Vm private constant _VM = Vm(address(uint160(uint256(keccak256('hevm cheat code')))));

  string private constant _DEFAULT_DIR = '../chains/registry';
  uint256 private constant _MAX_SELECTOR_DIGITS = 20;

  /// @notice The chain ID is in no registry file
  error Registry_UnknownChainId(uint256 _chainId);
  /// @notice The file, entry or field is absent from the registry
  error Registry_EntryNotFound(string _key, string _entry);
  /// @notice The CCIP selector is not a decimal string within uint64
  error Registry_InvalidSelector(string _key);

  /// @notice Map a chain ID to its registry key
  function keyOf(uint256 _chainId) internal returns (string memory _key) {
    _key = keyOf(registryDir(), _chainId);
  }

  /// @notice Map a chain ID to its registry key, scanning one directory
  function keyOf(string memory _dir, uint256 _chainId) internal returns (string memory _key) {
    string[6] memory _known = ['fuji', 'sepolia', 'base', 'arbitrum', 'cchain', 'twinpay-l1'];
    for (uint256 _i; _i < _known.length; ++_i) {
      string memory _path = _file(_dir, _known[_i]);
      if (!_VM.exists(_path)) continue;
      string memory _json = _VM.readFile(_path);
      if (_VM.keyExistsJson(_json, '.chainId') && _VM.parseJsonUint(_json, '.chainId') == _chainId) {
        return _known[_i];
      }
    }
    revert Registry_UnknownChainId(_chainId);
  }

  /// @notice Read a contract address by key and entry name
  function addressOf(string memory _key, string memory _entry) internal returns (address _address) {
    _address = addressOf(registryDir(), _key, _entry);
  }

  /// @notice Read a contract address by key and entry name, from one directory
  function addressOf(string memory _dir, string memory _key, string memory _entry) internal returns (address _address) {
    string memory _json = _read(_dir, _key);
    string memory _path = string.concat('.contracts.', _entry, '.address');
    if (!_VM.keyExistsJson(_json, _path)) revert Registry_EntryNotFound(_key, _entry);
    _address = _VM.parseJsonAddress(_json, _path);
  }

  /// @notice Read the CCIP chain selector of a registry key
  function selectorOf(string memory _key) internal returns (uint64 _selector) {
    _selector = selectorOf(registryDir(), _key);
  }

  /// @notice Read the CCIP chain selector of a registry key, from one directory
  function selectorOf(string memory _dir, string memory _key) internal returns (uint64 _selector) {
    string memory _json = _read(_dir, _key);
    if (!_VM.keyExistsJson(_json, '.ccip.chainSelector')) revert Registry_EntryNotFound(_key, 'ccip.chainSelector');
    _selector = parseSelector(_key, _VM.parseJsonString(_json, '.ccip.chainSelector'));
  }

  /// @notice Read the chain ID of a registry key, from one directory
  function chainIdOf(string memory _dir, string memory _key) internal returns (uint256 _chainId) {
    string memory _json = _read(_dir, _key);
    if (!_VM.keyExistsJson(_json, '.chainId')) revert Registry_EntryNotFound(_key, 'chainId');
    _chainId = _VM.parseJsonUint(_json, '.chainId');
  }

  /// @notice Read the ICM blockchain ID of a registry key, from one directory
  function blockchainIdOf(string memory _dir, string memory _key) internal returns (bytes32 _id) {
    string memory _json = _read(_dir, _key);
    if (!_VM.keyExistsJson(_json, '.icm.blockchainId')) revert Registry_EntryNotFound(_key, 'icm.blockchainId');
    _id = _VM.parseJsonBytes32(_json, '.icm.blockchainId');
  }

  /// @notice Read an ICM address (such as a token transferrer) of a registry key, from one directory
  function icmAddressOf(
    string memory _dir,
    string memory _key,
    string memory _entry
  )
    internal
    returns (address _address)
  {
    string memory _json = _read(_dir, _key);
    string memory _path = string.concat('.icm.', _entry);
    if (!_VM.keyExistsJson(_json, _path)) revert Registry_EntryNotFound(_key, string.concat('icm.', _entry));
    _address = _VM.parseJsonAddress(_json, _path);
  }

  /// @notice The registry directory, overridable with CHAIN_REGISTRY_DIR
  function registryDir() internal view returns (string memory _dir) {
    _dir = _VM.envOr('CHAIN_REGISTRY_DIR', _DEFAULT_DIR);
  }

  /// @notice Parse a decimal selector string into a uint64
  function parseSelector(string memory _key, string memory _raw) internal pure returns (uint64 _selector) {
    bytes memory _digits = bytes(_raw);
    if (_digits.length == 0 || _digits.length > _MAX_SELECTOR_DIGITS) revert Registry_InvalidSelector(_key);
    for (uint256 _i; _i < _digits.length; ++_i) {
      if (_digits[_i] < '0' || _digits[_i] > '9') revert Registry_InvalidSelector(_key);
    }
    uint256 _value = _VM.parseUint(_raw);
    if (_value > type(uint64).max) revert Registry_InvalidSelector(_key);
    _selector = uint64(_value);
  }

  function _file(string memory _dir, string memory _key) private pure returns (string memory _path) {
    _path = string.concat(_dir, '/', _key, '.json');
  }

  function _read(string memory _dir, string memory _key) private returns (string memory _json) {
    string memory _path = _file(_dir, _key);
    if (!_VM.exists(_path)) revert Registry_EntryNotFound(_key, 'file');
    _json = _VM.readFile(_path);
  }
}
