// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { LaneParamsLib } from 'src/libraries/LaneParamsLib.sol';

contract UnitLaneParamsLib is Test {
  modifier whenComputingALaneId() {
    _;
  }

  function test_GivenAnyParams() external whenComputingALaneId {
    // it equals the keccak of the encoded params
    IPaymentHub.LaneParams memory _params = _base();
    assertEq(Id.unwrap(LaneParamsLib.id(_params)), keccak256(abi.encode(_params)));
    _params.destination = bytes32(uint256(7));
    assertEq(Id.unwrap(LaneParamsLib.id(_params)), keccak256(abi.encode(_params)));
  }

  function test_GivenEqualParams() external whenComputingALaneId {
    // it returns equal ids
    assertEq(Id.unwrap(LaneParamsLib.id(_base())), Id.unwrap(LaneParamsLib.id(_base())));
  }

  function test_GivenParamsDifferingInOneField() external whenComputingALaneId {
    // it returns a different id
    bytes32 _baseId = Id.unwrap(LaneParamsLib.id(_base()));
    IPaymentHub.LaneParams memory _token = _base();
    _token.token = address(0xD1);
    IPaymentHub.LaneParams memory _merchant = _base();
    _merchant.merchant = address(0xD2);
    IPaymentHub.LaneParams memory _messenger = _base();
    _messenger.messenger = address(0xD3);
    IPaymentHub.LaneParams memory _destination = _base();
    _destination.destination = bytes32(uint256(0xD4));
    bytes32[4] memory _ids = [
      Id.unwrap(LaneParamsLib.id(_token)),
      Id.unwrap(LaneParamsLib.id(_merchant)),
      Id.unwrap(LaneParamsLib.id(_messenger)),
      Id.unwrap(LaneParamsLib.id(_destination))
    ];
    for (uint256 _i; _i < _ids.length; ++_i) {
      assertTrue(_ids[_i] != _baseId);
      for (uint256 _j = _i + 1; _j < _ids.length; ++_j) {
        assertTrue(_ids[_i] != _ids[_j]);
      }
    }
  }

  function _base() internal pure returns (IPaymentHub.LaneParams memory _params) {
    _params = IPaymentHub.LaneParams({
      token: address(0xA1), merchant: address(0xA2), messenger: address(0xA3), destination: bytes32(uint256(0xA4))
    });
  }
}
