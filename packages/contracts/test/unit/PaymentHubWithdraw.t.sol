// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract UnitPaymentHubWithdraw is Test {
  address internal _payer = makeAddr('payer');
  address internal _merchant = makeAddr('merchant');

  PaymentHubHarness internal _hub;
  MockERC20 internal _tokenA;
  MockERC20 internal _tokenB;

  function setUp() external {
    vm.warp(1_000_000);
    _hub = new PaymentHubHarness(address(this));
    _tokenA = new MockERC20();
    _tokenB = new MockERC20();
    _settle(_tokenA, 5);
  }

  modifier whenAMerchantWithdraws() {
    _;
  }

  function test_GivenACreditedBalance() external whenAMerchantWithdraws {
    // it zeroes the credit, pays the merchant and emits Withdrawn
    vm.expectEmit(true, true, false, true, address(_hub));
    emit IPaymentHub.Withdrawn(address(_tokenA), _merchant, 5);
    vm.prank(_merchant);
    _hub.withdraw(address(_tokenA));

    assertEq(_tokenA.balanceOf(_merchant), 5);
    assertEq(_tokenA.balanceOf(address(_hub)), 0);
    assertEq(_hub.exposed_credit(address(_tokenA), _merchant), 0);
  }

  function test_GivenASecondWithdrawal() external whenAMerchantWithdraws {
    // it reverts with PaymentHub_ZeroAmount
    vm.startPrank(_merchant);
    _hub.withdraw(address(_tokenA));
    vm.expectRevert(IPaymentHub.PaymentHub_ZeroAmount.selector);
    _hub.withdraw(address(_tokenA));
    vm.stopPrank();
    assertEq(_tokenA.balanceOf(_merchant), 5);
  }

  function test_GivenNothingCredited() external whenAMerchantWithdraws {
    // it reverts with PaymentHub_ZeroAmount
    vm.expectRevert(IPaymentHub.PaymentHub_ZeroAmount.selector);
    vm.prank(makeAddr('stranger'));
    _hub.withdraw(address(_tokenA));
  }

  function test_GivenCreditsInTwoTokens() external whenAMerchantWithdraws {
    // it pays only the requested token
    _settle(_tokenB, 8);

    vm.prank(_merchant);
    _hub.withdraw(address(_tokenB));

    assertEq(_tokenB.balanceOf(_merchant), 8);
    assertEq(_tokenA.balanceOf(_merchant), 0);
    assertEq(_hub.exposed_credit(address(_tokenA), _merchant), 5);
    assertEq(_hub.exposed_credit(address(_tokenB), _merchant), 0);
  }

  function _settle(MockERC20 _token, uint256 _amount) internal {
    Id _lane = _hub.createLane(
      IPaymentHub.LaneParams({
        token: address(_token), merchant: _merchant, messenger: address(0), destination: bytes32(0)
      })
    );
    _token.mint(_payer, _amount);
    vm.startPrank(_payer);
    _token.approve(address(_hub), _amount);
    bytes32 _paymentId = _hub.pay(_lane, _payer, _amount, block.timestamp + 1 hours);
    vm.stopPrank();
    _hub.settle(_lane, _paymentId);
  }
}
