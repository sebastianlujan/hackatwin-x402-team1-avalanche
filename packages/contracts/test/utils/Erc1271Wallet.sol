// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC1271 } from '@openzeppelin/contracts/interfaces/IERC1271.sol';

/// @notice A contract wallet that approves only the digests it was told to approve
contract Erc1271Wallet is IERC1271 {
  mapping(bytes32 _digest => bool _approved) internal _approved;

  function approve(bytes32 _digest) external {
    _approved[_digest] = true;
  }

  function isValidSignature(bytes32 _digest, bytes calldata) external view returns (bytes4 _magic) {
    _magic = _approved[_digest] ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
  }
}
