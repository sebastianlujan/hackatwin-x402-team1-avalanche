// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Deploy } from 'script/Deploy.sol';

/// @notice External wrapper so tests can assert reverts of the internal deploy base helpers
contract DeployHarness is Deploy {
  /// @notice Check the chain against a registry directory
  function requireChain(string calldata _registryDir, string calldata _key) external {
    _requireChain(_registryDir, _key);
  }

  /// @notice Read a params file
  function readParams(string calldata _dir, string calldata _key) external returns (string memory _json) {
    _json = _readParams(_dir, _key);
  }

  /// @notice Write a deployment record
  function writeRecord(string calldata _dir, string calldata _key, string calldata _json) external {
    _writeRecord(_dir, _key, _json);
  }

  /// @notice Read an address parameter
  function paramAddress(
    string calldata _json,
    string calldata _key,
    string calldata _entry
  )
    external
    view
    returns (address _value)
  {
    _value = _paramAddress(_json, _key, _entry);
  }

  /// @notice Read a number parameter
  function paramUint(
    string calldata _json,
    string calldata _key,
    string calldata _entry
  )
    external
    view
    returns (uint256 _value)
  {
    _value = _paramUint(_json, _key, _entry);
  }
}
