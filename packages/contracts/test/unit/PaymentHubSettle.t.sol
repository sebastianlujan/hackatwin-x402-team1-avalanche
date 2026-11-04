// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract UnitPaymentHubSettle is Test {
  address internal _payer = makeAddr('payer');
  address internal _merchant = makeAddr('merchant');
  address internal _messenger = makeAddr('messenger');
  address internal _anyone = makeAddr('anyone');
  uint256 internal _deadline;

  PaymentHubHarness internal _hub;
  MockERC20 internal _token;
  Id internal _local;
  Id internal _cross;
  bytes32 internal _localPayment;
  bytes32 internal _crossPayment;

  function setUp() external {
    vm.warp(1_000_000);
    _deadline = block.timestamp + 1 hours;
    _hub = new PaymentHubHarness(address(this));
    _token = new MockERC20();
    _hub.enableMessenger(_messenger);
    _local = _hub.createLane(_laneParams(address(0), bytes32(0)));
    _cross = _hub.createLane(_laneParams(_messenger, keccak256('destination')));
    _token.mint(_payer, 1000);
    vm.startPrank(_payer);
    _token.approve(address(_hub), type(uint256).max);
    _localPayment = _hub.pay(_local, _payer, 100, _deadline);
    _crossPayment = _hub.pay(_cross, _payer, 60, _deadline);
    vm.stopPrank();
  }

  modifier whenAnyoneSettlesAPayment() {
    _;
  }

  function test_GivenAPendingLocalPaymentBeforeItsDeadline() external whenAnyoneSettlesAPayment {
    // it sets Settled, credits the merchant, zeroes the escrow and emits one StatusChanged
    vm.recordLogs();
    vm.prank(_anyone);
    _hub.settle(_local, _localPayment);

    assertEq(vm.getRecordedLogs().length, 1);
    assertEq(uint8(_hub.statusOf(_local, _localPayment)), uint8(IPaymentHub.Status.Settled));
    assertEq(_hub.exposed_credit(address(_token), _merchant), 100);
    assertEq(_hub.exposed_payment(_local, _localPayment).amount, 0);
    assertEq(_token.balanceOf(address(_hub)), 160);
  }

  function test_GivenAPendingLocalPaymentAtItsDeadline() external whenAnyoneSettlesAPayment {
    // it settles
    vm.warp(_deadline);
    vm.expectEmit(true, true, false, true, address(_hub));
    emit IPaymentHub.StatusChanged(_local, _localPayment, IPaymentHub.Status.Pending, IPaymentHub.Status.Settled);
    _hub.settle(_local, _localPayment);
    assertEq(_hub.exposed_credit(address(_token), _merchant), 100);
  }

  function test_GivenAPaymentThatIsNotPending() external whenAnyoneSettlesAPayment {
    // it reverts with PaymentHub_InvalidTransition
    IPaymentHub.Status[4] memory _statuses = [
      IPaymentHub.Status.None, IPaymentHub.Status.Settled, IPaymentHub.Status.Dispatched, IPaymentHub.Status.Refunded
    ];
    for (uint256 _i; _i < _statuses.length; ++_i) {
      _hub.exposed_setStatus(_local, _localPayment, _statuses[_i]);
      vm.expectRevert(
        abi.encodeWithSelector(
          IPaymentHub.PaymentHub_InvalidTransition.selector, _statuses[_i], IPaymentHub.Status.Settled
        )
      );
      _hub.settle(_local, _localPayment);
    }
    assertEq(_hub.exposed_credit(address(_token), _merchant), 0);
  }

  function test_GivenACrossChainPayment() external whenAnyoneSettlesAPayment {
    // it reverts with PaymentHub_WrongLaneKind
    vm.expectRevert(IPaymentHub.PaymentHub_WrongLaneKind.selector);
    _hub.settle(_cross, _crossPayment);
    assertEq(uint8(_hub.statusOf(_cross, _crossPayment)), uint8(IPaymentHub.Status.Pending));
  }

  function test_GivenALocalPaymentAfterItsDeadline() external whenAnyoneSettlesAPayment {
    // it reverts with PaymentHub_DeadlinePassed
    vm.warp(_deadline + 1);
    vm.expectRevert(IPaymentHub.PaymentHub_DeadlinePassed.selector);
    _hub.settle(_local, _localPayment);
    assertEq(uint8(_hub.statusOf(_local, _localPayment)), uint8(IPaymentHub.Status.Pending));
  }

  function _laneParams(address _m, bytes32 _d) internal view returns (IPaymentHub.LaneParams memory _params) {
    _params = IPaymentHub.LaneParams({ token: address(_token), merchant: _merchant, messenger: _m, destination: _d });
  }
}
