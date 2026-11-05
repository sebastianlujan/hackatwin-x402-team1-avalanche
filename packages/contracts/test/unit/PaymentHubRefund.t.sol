// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract UnitPaymentHubRefund is Test {
  address internal _payer = makeAddr('payer');
  address internal _broker = makeAddr('broker');
  address internal _merchant = makeAddr('merchant');
  address internal _anyone = makeAddr('anyone');
  uint256 internal _deadline;

  PaymentHubHarness internal _hub;
  MockERC20 internal _token;
  Id internal _lane;
  bytes32 internal _paymentId;

  function setUp() external {
    vm.warp(1_000_000);
    _deadline = block.timestamp + 1 hours;
    _hub = new PaymentHubHarness(address(this));
    _token = new MockERC20();
    _lane = _hub.createLane(
      IPaymentHub.LaneParams({
        token: address(_token), merchant: _merchant, messenger: address(0), destination: bytes32(0)
      })
    );
    _token.mint(_payer, 1000);
    vm.prank(_payer);
    _token.approve(address(_hub), type(uint256).max);
    _hub.exposed_setBudget(_payer, _broker, address(_token), 300);
    vm.prank(_broker);
    _paymentId = _hub.pay(_lane, _payer, 100, _deadline);
  }

  modifier whenAnyoneRefundsAPayment() {
    _;
  }

  function test_GivenAPendingPaymentPastItsDeadline() external whenAnyoneRefundsAPayment {
    // it returns the escrow to the payer, sets Refunded and leaves the budget unchanged
    vm.warp(_deadline + 1);

    vm.expectEmit(true, true, false, true, address(_hub));
    emit IPaymentHub.StatusChanged(_lane, _paymentId, IPaymentHub.Status.Pending, IPaymentHub.Status.Refunded);
    vm.prank(_anyone);
    _hub.refund(_lane, _paymentId);

    assertEq(uint8(_hub.statusOf(_lane, _paymentId)), uint8(IPaymentHub.Status.Refunded));
    assertEq(_token.balanceOf(_payer), 1000);
    assertEq(_token.balanceOf(_anyone), 0);
    assertEq(_token.balanceOf(address(_hub)), 0);
    assertEq(_hub.exposed_budget(_payer, _broker, address(_token)), 200);
  }

  function test_GivenAPendingPaymentAtItsDeadline() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_DeadlineNotReached
    vm.warp(_deadline);
    vm.expectRevert(IPaymentHub.PaymentHub_DeadlineNotReached.selector);
    _hub.refund(_lane, _paymentId);

    vm.warp(_deadline + 1);
    _hub.refund(_lane, _paymentId);
    assertEq(uint8(_hub.statusOf(_lane, _paymentId)), uint8(IPaymentHub.Status.Refunded));
  }

  function test_GivenAPendingPaymentBeforeItsDeadline() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_DeadlineNotReached
    vm.expectRevert(IPaymentHub.PaymentHub_DeadlineNotReached.selector);
    _hub.refund(_lane, _paymentId);
    assertEq(uint8(_hub.statusOf(_lane, _paymentId)), uint8(IPaymentHub.Status.Pending));
    assertEq(_token.balanceOf(address(_hub)), 100);
  }

  function test_GivenAPaymentThatIsNotPending() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_InvalidTransition
    vm.warp(_deadline + 1 days);
    IPaymentHub.Status[4] memory _statuses = [
      IPaymentHub.Status.None, IPaymentHub.Status.Settled, IPaymentHub.Status.Dispatched, IPaymentHub.Status.Refunded
    ];
    for (uint256 _i; _i < _statuses.length; ++_i) {
      _hub.exposed_setStatus(_lane, _paymentId, _statuses[_i]);
      vm.expectRevert(
        abi.encodeWithSelector(
          IPaymentHub.PaymentHub_InvalidTransition.selector, _statuses[_i], IPaymentHub.Status.Refunded
        )
      );
      _hub.refund(_lane, _paymentId);
    }
    assertEq(_token.balanceOf(_payer), 900);
  }

  function test_GivenAPaymentThatWasAlreadyRefunded() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_InvalidTransition and pays nothing twice
    vm.warp(_deadline + 1);
    _hub.refund(_lane, _paymentId);

    vm.expectRevert(
      abi.encodeWithSelector(
        IPaymentHub.PaymentHub_InvalidTransition.selector, IPaymentHub.Status.Refunded, IPaymentHub.Status.Refunded
      )
    );
    _hub.refund(_lane, _paymentId);
    assertEq(_token.balanceOf(_payer), 1000);
  }

  function test_GivenAPaymentUnderAnotherLaneId() external whenAnyoneRefundsAPayment {
    // it reverts with PaymentHub_InvalidTransition from None
    vm.warp(_deadline + 1);
    Id _other = Id.wrap(keccak256('other lane'));
    vm.expectRevert(
      abi.encodeWithSelector(
        IPaymentHub.PaymentHub_InvalidTransition.selector, IPaymentHub.Status.None, IPaymentHub.Status.Refunded
      )
    );
    _hub.refund(_other, _paymentId);
    assertEq(_token.balanceOf(address(_hub)), 100);
  }
}
