// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';

/// @title LaneParamsLib
/// @notice Derives the lane id from its params
library LaneParamsLib {
  /// @notice The lane id, the keccak256 of the abi-encoded params
  /// @param _params The lane params
  /// @return _id The lane id
  function id(IPaymentHub.LaneParams memory _params) internal pure returns (Id _id) {
    _id = Id.wrap(keccak256(abi.encode(_params)));
  }
}
