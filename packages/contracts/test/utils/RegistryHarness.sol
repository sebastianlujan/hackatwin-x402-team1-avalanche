// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Vm } from 'forge-std/Vm.sol';
import { Registry } from 'script/lib/Registry.sol';

/// @notice External wrapper so tests can assert reverts of the internal registry reader
contract RegistryHarness {
  Vm private constant _VM = Vm(address(uint160(uint256(keccak256('hevm cheat code')))));

  /// @notice Resolve a chain ID in the default registry
  function keyOf(uint256 _chainId) external returns (string memory _key) {
    _key = Registry.keyOf(_chainId);
  }

  /// @notice Read an address entry from the default registry
  function addressOf(string calldata _key, string calldata _entry) external returns (address _address) {
    _address = Registry.addressOf(_key, _entry);
  }

  /// @notice Read an address entry from an explicit directory
  function addressOfIn(
    string calldata _dir,
    string calldata _key,
    string calldata _entry
  )
    external
    returns (address _address)
  {
    _address = Registry.addressOf(_dir, _key, _entry);
  }

  /// @notice Read the CCIP selector from the default registry
  function selectorOf(string calldata _key) external returns (uint64 _selector) {
    _selector = Registry.selectorOf(_key);
  }

  /// @notice Try to write a file, which the project permissions must refuse for the registry
  function tryWrite(string calldata _path) external {
    _VM.writeFile(_path, 'x');
  }

  /// @notice Parse a raw selector string
  function parseSelector(string calldata _key, string calldata _raw) external pure returns (uint64 _selector) {
    _selector = Registry.parseSelector(_key, _raw);
  }
}
