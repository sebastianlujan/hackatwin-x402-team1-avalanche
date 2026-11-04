// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { PaymentHub } from 'src/PaymentHub.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { FeeOnTransferToken } from 'test/utils/FeeOnTransferToken.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract UnitPaymentHubPay is Test {
  address internal _payer = makeAddr('payer');
  address internal _broker = makeAddr('broker');
  address internal _merchant = makeAddr('merchant');
  uint256 internal _deadline;

  PaymentHubHarness internal _hub;
  MockERC20 internal _token;
  Id internal _lane;

  function setUp() external {
    vm.warp(1_000_000);
    _deadline = block.timestamp + 1 hours;
    _hub = new PaymentHubHarness(address(this));
    _token = new MockERC20();
    _lane = _createLane(address(_token));
    _fund(_payer, address(_token), 1000);
  }

  modifier whenAPaymentIsEscrowed() {
    _;
  }

  function test_GivenThePayerPaysForItself() external whenAPaymentIsEscrowed {
    // it escrows the amount and consumes no budget
    _hub.exposed_setBudget(_payer, _payer, address(_token), 5);

    vm.prank(_payer);
    bytes32 _paymentId = _hub.pay(_lane, _payer, 100, _deadline);

    PaymentHub.Payment memory _payment = _hub.exposed_payment(_lane, _paymentId);
    assertEq(_payment.payer, _payer);
    assertEq(_payment.amount, 100);
    assertEq(_payment.deadline, _deadline);
    assertEq(uint8(_payment.status), uint8(IPaymentHub.Status.Pending));
    assertEq(_token.balanceOf(address(_hub)), 100);
    assertEq(_token.balanceOf(_payer), 900);
    assertEq(_hub.exposed_budget(_payer, _payer, address(_token)), 5);
  }

  function test_GivenAnAuthorizedBrokerWithEnoughBudget() external whenAPaymentIsEscrowed {
    // it escrows the amount, drops the budget and emits one StatusChanged
    _hub.exposed_setBudget(_payer, _broker, address(_token), 150);
    bytes32 _expectedId = keccak256(abi.encode(block.chainid, address(_hub), uint256(1)));

    vm.expectEmit(true, true, false, true, address(_hub));
    emit IPaymentHub.StatusChanged(_lane, _expectedId, IPaymentHub.Status.None, IPaymentHub.Status.Pending);
    vm.prank(_broker);
    bytes32 _paymentId = _hub.pay(_lane, _payer, 100, _deadline);

    assertEq(_paymentId, _expectedId);
    assertEq(uint8(_hub.statusOf(_lane, _paymentId)), uint8(IPaymentHub.Status.Pending));
    assertEq(_hub.exposed_payment(_lane, _paymentId).amount, 100);
    assertEq(_hub.exposed_budget(_payer, _broker, address(_token)), 50);
    assertEq(_token.balanceOf(address(_hub)), 100);
  }

  function test_GivenAnAmountAboveTheRemainingBudget() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_BudgetExceeded and moves no tokens
    _hub.exposed_setBudget(_payer, _broker, address(_token), 10);

    vm.expectRevert(abi.encodeWithSelector(IPaymentHub.PaymentHub_BudgetExceeded.selector, 10, 11));
    vm.prank(_broker);
    _hub.pay(_lane, _payer, 11, _deadline);

    assertEq(_token.balanceOf(address(_hub)), 0);
    assertEq(_token.balanceOf(_payer), 1000);
    assertEq(_hub.exposed_budget(_payer, _broker, address(_token)), 10);
  }

  function test_GivenABudgetThatWasAlreadySpentInFull() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_Unauthorized
    _hub.exposed_setBudget(_payer, _broker, address(_token), 10);
    vm.prank(_broker);
    _hub.pay(_lane, _payer, 10, _deadline);
    assertEq(_hub.exposed_budget(_payer, _broker, address(_token)), 0);

    vm.expectRevert(abi.encodeWithSelector(IPaymentHub.PaymentHub_Unauthorized.selector, _broker));
    vm.prank(_broker);
    _hub.pay(_lane, _payer, 1, _deadline);
  }

  function test_GivenACallerWithoutAnAuthorization() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_Unauthorized
    vm.expectRevert(abi.encodeWithSelector(IPaymentHub.PaymentHub_Unauthorized.selector, _broker));
    vm.prank(_broker);
    _hub.pay(_lane, _payer, 10, _deadline);
    assertEq(_token.balanceOf(address(_hub)), 0);
  }

  function test_GivenAnUnknownLane() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_LaneNotFound
    Id _unknown = Id.wrap(keccak256('unknown'));
    vm.expectRevert(abi.encodeWithSelector(IPaymentHub.PaymentHub_LaneNotFound.selector, _unknown));
    vm.prank(_payer);
    _hub.pay(_unknown, _payer, 10, _deadline);
  }

  function test_GivenAZeroAmount() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_ZeroAmount
    vm.expectRevert(IPaymentHub.PaymentHub_ZeroAmount.selector);
    vm.prank(_payer);
    _hub.pay(_lane, _payer, 0, _deadline);
  }

  function test_GivenADeadlineThatIsNotInTheFuture() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_InvalidDeadline
    vm.expectRevert(IPaymentHub.PaymentHub_InvalidDeadline.selector);
    vm.prank(_payer);
    _hub.pay(_lane, _payer, 10, block.timestamp);

    vm.prank(_payer);
    _hub.pay(_lane, _payer, 10, block.timestamp + 1);
  }

  function test_GivenAFeeOnTransferToken() external whenAPaymentIsEscrowed {
    // it records the delivered delta as the escrow
    FeeOnTransferToken _fee = new FeeOnTransferToken(1000);
    Id _feeLane = _createLane(address(_fee));
    _fund(_payer, address(_fee), 1000);

    vm.prank(_payer);
    bytes32 _paymentId = _hub.pay(_feeLane, _payer, 100, _deadline);

    assertEq(_fee.balanceOf(address(_hub)), 90);
    assertEq(_hub.exposed_payment(_feeLane, _paymentId).amount, 90);
  }

  function test_GivenATokenThatDeliversNothing() external whenAPaymentIsEscrowed {
    // it reverts with PaymentHub_ZeroAmount
    FeeOnTransferToken _fee = new FeeOnTransferToken(10_000);
    Id _feeLane = _createLane(address(_fee));
    _fund(_payer, address(_fee), 1000);

    vm.expectRevert(IPaymentHub.PaymentHub_ZeroAmount.selector);
    vm.prank(_payer);
    _hub.pay(_feeLane, _payer, 100, _deadline);
  }

  function test_GivenTwoPayments() external whenAPaymentIsEscrowed {
    // it returns distinct payment ids
    vm.startPrank(_payer);
    bytes32 _first = _hub.pay(_lane, _payer, 10, _deadline);
    bytes32 _second = _hub.pay(_lane, _payer, 10, _deadline);
    vm.stopPrank();

    assertTrue(_first != _second);
    assertEq(_second, keccak256(abi.encode(block.chainid, address(_hub), uint256(2))));
    assertEq(_token.balanceOf(address(_hub)), 20);
  }

  function test_GivenAPaymentThatIsNotNone() external whenAPaymentIsEscrowed {
    // it rejects the None to Pending transition
    bytes32 _paymentId = keccak256('payment');
    for (uint256 _status = 1; _status <= uint256(IPaymentHub.Status.Refunded); ++_status) {
      _hub.exposed_setStatus(_lane, _paymentId, IPaymentHub.Status(_status));
      vm.expectRevert(
        abi.encodeWithSelector(
          IPaymentHub.PaymentHub_InvalidTransition.selector, IPaymentHub.Status(_status), IPaymentHub.Status.Pending
        )
      );
      _hub.exposed_transition(_lane, _paymentId, IPaymentHub.Status.None, IPaymentHub.Status.Pending);
    }
  }

  function _createLane(address _laneToken) internal returns (Id _id) {
    _id = _hub.createLane(
      IPaymentHub.LaneParams({ token: _laneToken, merchant: _merchant, messenger: address(0), destination: bytes32(0) })
    );
  }

  function _fund(address _to, address _fundedToken, uint256 _amount) internal {
    MockERC20(_fundedToken).mint(_to, _amount);
    vm.prank(_to);
    MockERC20(_fundedToken).approve(address(_hub), type(uint256).max);
  }
}
