// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitLaneParamsLib {
  modifier whenComputingALaneId() {
    _;
  }

  function test_GivenAnyParams() external whenComputingALaneId {
    // it equals the keccak of the encoded params
  }

  function test_GivenEqualParams() external whenComputingALaneId {
    // it returns equal ids
  }

  function test_GivenParamsDifferingInOneField() external whenComputingALaneId {
    // it returns a different id
  }
}
