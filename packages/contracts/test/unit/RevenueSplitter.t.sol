// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { RevenueSplitter } from 'src/RevenueSplitter.sol';
import { IRevenueSplitter } from 'src/interfaces/IRevenueSplitter.sol';
import { LocalUsdc } from 'test/utils/LocalUsdc.sol';

contract UnitRevenueSplitter is Test {
  uint16 internal constant _PLATFORM_BPS = 1000;

  address internal _seller = makeAddr('seller');
  address internal _platform = makeAddr('platform');
  address internal _stranger = makeAddr('stranger');

  LocalUsdc internal _usdc;
  RevenueSplitter internal _splitter;

  function setUp() external {
    _usdc = new LocalUsdc();
    _splitter = new RevenueSplitter(_seller, _platform, _PLATFORM_BPS);
  }

  modifier whenDeployingTheSplitter() {
    _;
  }

  function test_GivenAZeroSeller() external whenDeployingTheSplitter {
    // it reverts with RevenueSplitter_ZeroAddress
    vm.expectRevert(IRevenueSplitter.RevenueSplitter_ZeroAddress.selector);
    new RevenueSplitter(address(0), _platform, _PLATFORM_BPS);
  }

  function test_GivenAZeroPlatform() external whenDeployingTheSplitter {
    // it reverts with RevenueSplitter_ZeroAddress
    vm.expectRevert(IRevenueSplitter.RevenueSplitter_ZeroAddress.selector);
    new RevenueSplitter(_seller, address(0), _PLATFORM_BPS);
  }

  function testFuzz_GivenAShareAboveTheWholeBalance(uint16 _bps) external whenDeployingTheSplitter {
    // it reverts with RevenueSplitter_InvalidPlatformBps
    _bps = uint16(bound(_bps, 10_001, type(uint16).max));
    vm.expectRevert(abi.encodeWithSelector(IRevenueSplitter.RevenueSplitter_InvalidPlatformBps.selector, _bps));
    new RevenueSplitter(_seller, _platform, _bps);
  }

  function test_GivenTheShareBounds() external whenDeployingTheSplitter {
    // it accepts zero and the whole balance
    assertEq(new RevenueSplitter(_seller, _platform, 0).PLATFORM_BPS(), 0);
    RevenueSplitter _whole = new RevenueSplitter(_seller, _platform, 10_000);
    assertEq(_whole.SELLER(), _seller);
    assertEq(_whole.PLATFORM(), _platform);
    assertEq(_whole.PLATFORM_BPS(), 10_000);
  }

  modifier whenReleasing() {
    _;
  }

  function test_GivenAZeroBalance() external whenReleasing {
    // it reverts with RevenueSplitter_ZeroBalance and pending is zero
    (uint256 _sellerAmount, uint256 _platformAmount) = _splitter.pending(_usdc);
    assertEq(_sellerAmount, 0);
    assertEq(_platformAmount, 0);
    vm.expectRevert(IRevenueSplitter.RevenueSplitter_ZeroBalance.selector);
    _splitter.release(_usdc);
  }

  function test_GivenABalance() external whenReleasing {
    // it pays the platform its share and the seller the rest and emits Released
    _usdc.mint(address(_splitter), 1_000_000);

    vm.expectEmit(true, false, false, true, address(_splitter));
    emit IRevenueSplitter.Released(address(_usdc), 900_000, 100_000);
    (uint256 _sellerAmount, uint256 _platformAmount) = _splitter.release(_usdc);

    assertEq(_sellerAmount, 900_000);
    assertEq(_platformAmount, 100_000);
    assertEq(_usdc.balanceOf(_seller), 900_000);
    assertEq(_usdc.balanceOf(_platform), 100_000);
    assertEq(_usdc.balanceOf(address(_splitter)), 0);
  }

  function test_GivenABalanceThatDoesNotSplitEvenly() external whenReleasing {
    // it rounds the platform share down so the seller gets the remainder
    _usdc.mint(address(_splitter), 9999);
    _splitter.release(_usdc);
    assertEq(_usdc.balanceOf(_platform), 999);
    assertEq(_usdc.balanceOf(_seller), 9000);

    RevenueSplitter _half = new RevenueSplitter(_seller, _platform, 5000);
    _usdc.mint(address(_half), 1);
    (uint256 _sellerAmount, uint256 _platformAmount) = _half.release(_usdc);
    assertEq(_sellerAmount, 1);
    assertEq(_platformAmount, 0);
  }

  function test_GivenAStranger() external whenReleasing {
    // it pays the seller and the platform, never the caller
    _usdc.mint(address(_splitter), 50);
    vm.prank(_stranger);
    _splitter.release(_usdc);
    assertEq(_usdc.balanceOf(_stranger), 0);
    assertEq(_usdc.balanceOf(_seller), 45);
    assertEq(_usdc.balanceOf(_platform), 5);
  }

  function test_GivenMoreFundsAfterARelease() external whenReleasing {
    // it splits only the new balance
    _usdc.mint(address(_splitter), 1000);
    _splitter.release(_usdc);
    vm.expectRevert(IRevenueSplitter.RevenueSplitter_ZeroBalance.selector);
    _splitter.release(_usdc);

    _usdc.mint(address(_splitter), 300);
    (uint256 _sellerAmount, uint256 _platformAmount) = _splitter.release(_usdc);
    assertEq(_sellerAmount, 270);
    assertEq(_platformAmount, 30);
    assertEq(_usdc.balanceOf(_seller), 1170);
    assertEq(_usdc.balanceOf(_platform), 130);
  }

  function test_GivenAShareOfZeroOrTheWholeBalance() external whenReleasing {
    // it pays everything to one party
    RevenueSplitter _none = new RevenueSplitter(_seller, _platform, 0);
    RevenueSplitter _all = new RevenueSplitter(_seller, _platform, 10_000);
    _usdc.mint(address(_none), 7);
    _usdc.mint(address(_all), 11);
    _none.release(_usdc);
    _all.release(_usdc);
    assertEq(_usdc.balanceOf(_seller), 7);
    assertEq(_usdc.balanceOf(_platform), 11);
  }

  function testFuzz_GivenAnyBalanceAndShare(uint256 _balance, uint16 _bps, address _caller) external whenReleasing {
    // it pays exactly what pending reported, rounds for the seller and empties the splitter
    _balance = bound(_balance, 1, type(uint256).max / 10_000);
    _bps = uint16(bound(_bps, 0, 10_000));
    RevenueSplitter _fuzzed = new RevenueSplitter(_seller, _platform, _bps);
    _usdc.mint(address(_fuzzed), _balance);

    (uint256 _pendingSeller, uint256 _pendingPlatform) = _fuzzed.pending(_usdc);
    vm.prank(_caller);
    (uint256 _sellerAmount, uint256 _platformAmount) = _fuzzed.release(_usdc);

    assertEq(_sellerAmount, _pendingSeller);
    assertEq(_platformAmount, _pendingPlatform);
    assertEq(_sellerAmount + _platformAmount, _balance);
    assertLe(_platformAmount * 10_000, _balance * _bps);
    assertGt((_platformAmount + 1) * 10_000, _balance * _bps);
    assertEq(_usdc.balanceOf(address(_fuzzed)), 0);
    assertEq(_usdc.balanceOf(_seller), _sellerAmount);
    assertEq(_usdc.balanceOf(_platform), _platformAmount);
  }
}
