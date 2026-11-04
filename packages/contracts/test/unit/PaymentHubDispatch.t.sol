// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { MockMessenger } from 'test/utils/MockMessenger.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract UnitPaymentHubDispatch is Test {
  bytes32 internal constant _DESTINATION = keccak256('destination');

  address internal _payer = makeAddr('payer');
  address internal _merchant = makeAddr('merchant');
  address internal _anyone = makeAddr('anyone');
  uint256 internal _deadline;

  PaymentHubHarness internal _hub;
  MockERC20 internal _token;
  MockMessenger internal _messenger;
  Id internal _cross;
  Id internal _local;
  bytes32 internal _crossPayment;
  bytes32 internal _localPayment;

  function setUp() external {
    vm.warp(1_000_000);
    _deadline = block.timestamp + 1 hours;
    _hub = new PaymentHubHarness(address(this));
    _token = new MockERC20();
    _messenger = new MockMessenger();
    _hub.enableMessenger(address(_messenger));
    _cross = _hub.createLane(_params(address(_messenger), _DESTINATION));
    _local = _hub.createLane(_params(address(0), bytes32(0)));
    _token.mint(_payer, 1000);
    vm.startPrank(_payer);
    _token.approve(address(_hub), type(uint256).max);
    _crossPayment = _hub.pay(_cross, _payer, 100, _deadline);
    _localPayment = _hub.pay(_local, _payer, 40, _deadline);
    vm.stopPrank();
  }

  modifier whenAnyoneDispatchesAPayment() {
    _;
  }

  function test_GivenAPendingCrossChainPaymentBeforeItsDeadline() external whenAnyoneDispatchesAPayment {
    // it sets Dispatched, hands exactly the escrow to the messenger and leaves a zero allowance
    vm.expectEmit(true, true, false, true, address(_hub));
    emit IPaymentHub.StatusChanged(_cross, _crossPayment, IPaymentHub.Status.Pending, IPaymentHub.Status.Dispatched);
    vm.prank(_anyone);
    _hub.dispatch(_cross, _crossPayment);

    assertEq(uint8(_hub.statusOf(_cross, _crossPayment)), uint8(IPaymentHub.Status.Dispatched));
    assertEq(_token.balanceOf(address(_messenger)), 100);
    assertEq(_token.balanceOf(address(_hub)), 40);
    assertEq(_token.allowance(address(_hub), address(_messenger)), 0);
    assertEq(_hub.exposed_payment(_cross, _crossPayment).amount, 0);
    assertEq(Id.unwrap(_messenger.lastId()), Id.unwrap(_cross));
    assertEq(_messenger.lastPaymentId(), _crossPayment);
    assertEq(_messenger.lastToken(), address(_token));
    assertEq(_messenger.lastMerchant(), _merchant);
    assertEq(_messenger.lastDestination(), _DESTINATION);
    assertEq(_messenger.lastAmount(), 100);
  }

  function test_GivenAPendingCrossChainPaymentAtItsDeadline() external whenAnyoneDispatchesAPayment {
    // it dispatches
    vm.warp(_deadline);
    vm.expectEmit(true, true, false, true, address(_hub));
    emit IPaymentHub.StatusChanged(_cross, _crossPayment, IPaymentHub.Status.Pending, IPaymentHub.Status.Dispatched);
    _hub.dispatch(_cross, _crossPayment);
    assertEq(_token.balanceOf(address(_messenger)), 100);
  }

  function test_GivenAPaymentThatIsNotPending() external whenAnyoneDispatchesAPayment {
    // it reverts with PaymentHub_InvalidTransition
    IPaymentHub.Status[4] memory _statuses = [
      IPaymentHub.Status.None, IPaymentHub.Status.Settled, IPaymentHub.Status.Dispatched, IPaymentHub.Status.Refunded
    ];
    for (uint256 _i; _i < _statuses.length; ++_i) {
      _hub.exposed_setStatus(_cross, _crossPayment, _statuses[_i]);
      vm.expectRevert(
        abi.encodeWithSelector(
          IPaymentHub.PaymentHub_InvalidTransition.selector, _statuses[_i], IPaymentHub.Status.Dispatched
        )
      );
      _hub.dispatch(_cross, _crossPayment);
    }
    assertEq(_token.balanceOf(address(_messenger)), 0);
  }

  function test_GivenALocalPayment() external whenAnyoneDispatchesAPayment {
    // it reverts with PaymentHub_WrongLaneKind
    vm.expectRevert(IPaymentHub.PaymentHub_WrongLaneKind.selector);
    _hub.dispatch(_local, _localPayment);
    assertEq(uint8(_hub.statusOf(_local, _localPayment)), uint8(IPaymentHub.Status.Pending));
  }

  function test_GivenACrossChainPaymentAfterItsDeadline() external whenAnyoneDispatchesAPayment {
    // it reverts with PaymentHub_DeadlinePassed
    vm.warp(_deadline + 1);
    vm.expectRevert(IPaymentHub.PaymentHub_DeadlinePassed.selector);
    _hub.dispatch(_cross, _crossPayment);
    assertEq(uint8(_hub.statusOf(_cross, _crossPayment)), uint8(IPaymentHub.Status.Pending));
  }

  function test_GivenAMessengerWhoseSendReverts() external whenAnyoneDispatchesAPayment {
    // it reverts, keeps the payment pending and refundable after the deadline
    _messenger.setMode(MockMessenger.Mode.Revert);
    vm.expectRevert('send failed');
    _hub.dispatch(_cross, _crossPayment);
    assertEq(uint8(_hub.statusOf(_cross, _crossPayment)), uint8(IPaymentHub.Status.Pending));
    assertEq(_token.allowance(address(_hub), address(_messenger)), 0);

    vm.warp(_deadline + 1);
    _hub.refund(_cross, _crossPayment);
    assertEq(_token.balanceOf(_payer), 1000 - 40);
  }

  function test_GivenAMessengerThatPullsLessThanTheEscrow() external whenAnyoneDispatchesAPayment {
    // it reverts with PaymentHub_AllowanceNotConsumed and keeps the payment pending
    _messenger.setMode(MockMessenger.Mode.PullShort);
    vm.expectRevert(abi.encodeWithSelector(IPaymentHub.PaymentHub_AllowanceNotConsumed.selector, 1));
    _hub.dispatch(_cross, _crossPayment);
    assertEq(uint8(_hub.statusOf(_cross, _crossPayment)), uint8(IPaymentHub.Status.Pending));
    assertEq(_token.balanceOf(address(_messenger)), 0);
  }

  function test_GivenADispatchedPaymentPastItsDeadline() external whenAnyoneDispatchesAPayment {
    // it rejects a refund with PaymentHub_InvalidTransition
    _hub.dispatch(_cross, _crossPayment);
    vm.warp(_deadline + 1);
    vm.expectRevert(
      abi.encodeWithSelector(
        IPaymentHub.PaymentHub_InvalidTransition.selector, IPaymentHub.Status.Dispatched, IPaymentHub.Status.Refunded
      )
    );
    _hub.refund(_cross, _crossPayment);
  }

  function _params(address _m, bytes32 _d) internal view returns (IPaymentHub.LaneParams memory _p) {
    _p = IPaymentHub.LaneParams({ token: address(_token), merchant: _merchant, messenger: _m, destination: _d });
  }
}
