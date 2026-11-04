// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { Ownable2Step } from '@openzeppelin/contracts/access/Ownable2Step.sol';
import { IERC20 as IERC20Oz48 } from '@openzeppelin/contracts@4.8.3/token/ERC20/IERC20.sol';
import { IERC20 as IERC20Oz53 } from '@openzeppelin/contracts@5.3.0/token/ERC20/IERC20.sol';

import { CCIPReceiver } from '@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol';
import { AggregatorV3Interface } from '@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol';
import { CCIPLocalSimulator } from '@chainlink/local/src/ccip/CCIPLocalSimulator.sol';

contract ProbeTest is Test {
  function test_CompilerIsCancunByDefault() public {
    // A transient store only compiles for cancun or later.
    uint256 _value;
    assembly {
      tstore(0, 42)
      _value := tload(0)
    }
    assertEq(_value, 42);
  }

  function test_EveryDependencyAndAliasResolves() public pure {
    assertEq(type(Ownable2Step).name, 'Ownable2Step');
    assertEq(type(IERC20Oz53).name, 'IERC20');
    assertEq(type(IERC20Oz48).name, 'IERC20');
    assertEq(type(CCIPReceiver).name, 'CCIPReceiver');
    assertEq(type(AggregatorV3Interface).name, 'AggregatorV3Interface');
    assertEq(type(CCIPLocalSimulator).name, 'CCIPLocalSimulator');
    assertEq(type(Test).name, 'Test');
  }
}
