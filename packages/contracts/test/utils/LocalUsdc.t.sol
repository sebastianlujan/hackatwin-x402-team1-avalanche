// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { LocalUsdc } from 'test/utils/LocalUsdc.sol';

contract UnitLocalUsdc is Test {
  LocalUsdc internal _usdc;

  function setUp() public {
    _usdc = new LocalUsdc();
  }

  function test_WhenReadingTheDecimals() external view {
    // it returns 6
    assertEq(_usdc.decimals(), 6);
  }

  modifier whenMinting() {
    _;
  }

  function test_GivenAnAmountForARecipient() external whenMinting {
    _usdc.mint(address(0xA11CE), 5_000_000);

    // it credits the recipient and the supply
    assertEq(_usdc.balanceOf(address(0xA11CE)), 5_000_000);
    assertEq(_usdc.totalSupply(), 5_000_000);
  }

  function test_GivenASecondMintToAnotherRecipient() external whenMinting {
    _usdc.mint(address(0xA11CE), 5_000_000);
    _usdc.mint(address(0xB0B), 1_250_000);

    // it credits each balance separately
    assertEq(_usdc.balanceOf(address(0xA11CE)), 5_000_000);
    assertEq(_usdc.balanceOf(address(0xB0B)), 1_250_000);
    assertEq(_usdc.totalSupply(), 6_250_000);
  }
}
