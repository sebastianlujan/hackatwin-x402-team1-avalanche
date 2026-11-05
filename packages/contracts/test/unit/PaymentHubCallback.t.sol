// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { PaymentCallbackLib } from 'src/libraries/PaymentCallbackLib.sol';
import { CallbackMerchant } from 'test/utils/CallbackMerchant.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract UnitPaymentHubCallback is Test {
  address internal _payer = makeAddr('payer');
  address internal _plainMerchant = makeAddr('plainMerchant');
  uint256 internal _deadline;

  PaymentHubHarness internal _hub;
  MockERC20 internal _token;
  CallbackMerchant internal _merchant;
  Id internal _lane;
  bytes32 internal _paymentId;

  function setUp() external {
    vm.warp(1_000_000);
    _deadline = block.timestamp + 1 hours;
    _hub = new PaymentHubHarness(address(this));
    _token = new MockERC20();
    _merchant = new CallbackMerchant();
    _lane = _hub.createLane(_params(address(_merchant)));
    _token.mint(_payer, 1000);
    vm.startPrank(_payer);
    _token.approve(address(_hub), type(uint256).max);
    _paymentId = _hub.pay(_lane, _payer, 100, _deadline);
    vm.stopPrank();
  }

  modifier whenAPaymentSettlesToAMerchantContract() {
    _;
  }

  function test_GivenACallbackThatSucceeds() external whenAPaymentSettlesToAMerchantContract {
    // it receives the payment id, token and amount and emits no CallbackFailed
    _merchant.configure(CallbackMerchant.Mode.Ok, _hub, _lane);

    vm.recordLogs();
    _hub.settle(_lane, _paymentId);

    assertEq(vm.getRecordedLogs().length, 1);
    assertEq(_merchant.lastPaymentId(), _paymentId);
    assertEq(_merchant.lastToken(), address(_token));
    assertEq(_merchant.lastAmount(), 100);
    assertEq(_hub.exposed_credit(address(_token), address(_merchant)), 100);
  }

  function test_GivenACallbackThatReverts() external whenAPaymentSettlesToAMerchantContract {
    // it settles, keeps the credit and emits CallbackFailed
    _merchant.configure(CallbackMerchant.Mode.Revert, _hub, _lane);

    vm.expectEmit(true, true, false, false, address(_hub));
    emit IPaymentHub.CallbackFailed(_paymentId, address(_merchant));
    _hub.settle(_lane, _paymentId);

    assertEq(uint8(_hub.statusOf(_lane, _paymentId)), uint8(IPaymentHub.Status.Settled));
    assertEq(_hub.exposed_credit(address(_token), address(_merchant)), 100);
  }

  function test_GivenACallbackThatBurnsAllGas() external whenAPaymentSettlesToAMerchantContract {
    // it settles, keeps the credit and emits CallbackFailed
    _merchant.configure(CallbackMerchant.Mode.BurnGas, _hub, _lane);

    vm.expectEmit(true, true, false, false, address(_hub));
    emit IPaymentHub.CallbackFailed(_paymentId, address(_merchant));
    _hub.settle(_lane, _paymentId);

    assertEq(uint8(_hub.statusOf(_lane, _paymentId)), uint8(IPaymentHub.Status.Settled));
    assertEq(_hub.exposed_credit(address(_token), address(_merchant)), 100);
  }

  function test_GivenTooLittleGasToFundTheFullCallback() external whenAPaymentSettlesToAMerchantContract {
    // it reverts with PaymentHub_InsufficientCallbackGas and the payment stays pending
    uint256 _baseline = _gasOfSettleWithoutCallback();
    _merchant.configure(CallbackMerchant.Mode.Ok, _hub, _lane);

    vm.expectRevert(IPaymentHub.PaymentHub_InsufficientCallbackGas.selector);
    _hub.settle{ gas: _baseline + PaymentCallbackLib.CALLBACK_GAS }(_lane, _paymentId);
    assertEq(uint8(_hub.statusOf(_lane, _paymentId)), uint8(IPaymentHub.Status.Pending));
    assertEq(_merchant.lastPaymentId(), bytes32(0));

    _hub.settle{ gas: _baseline + 2 * PaymentCallbackLib.CALLBACK_GAS }(_lane, _paymentId);
    assertEq(uint8(_hub.statusOf(_lane, _paymentId)), uint8(IPaymentHub.Status.Settled));
    assertEq(_merchant.lastPaymentId(), _paymentId);
  }

  function test_GivenACallbackThatReentersTheHub() external whenAPaymentSettlesToAMerchantContract {
    // it reverts every reentrant call and the outer settle succeeds
    _merchant.configure(CallbackMerchant.Mode.Reenter, _hub, _lane);

    _hub.settle(_lane, _paymentId);

    assertEq(uint8(_hub.statusOf(_lane, _paymentId)), uint8(IPaymentHub.Status.Settled));
    assertEq(_hub.exposed_credit(address(_token), address(_merchant)), 100);
    uint256 _guarded = _merchant.reentrantGuarded();
    assertEq(_guarded & 1, 1, 'pay');
    assertEq((_guarded >> 1) & 1, 1, 'settle');
    assertEq((_guarded >> 2) & 1, 1, 'dispatch');
    assertEq((_guarded >> 3) & 1, 1, 'refund');
    assertEq((_guarded >> 4) & 1, 1, 'withdraw');
  }

  function _gasOfSettleWithoutCallback() internal returns (uint256 _used) {
    Id _plainLane = _hub.createLane(_params(_plainMerchant));
    vm.prank(_payer);
    bytes32 _plainPayment = _hub.pay(_plainLane, _payer, 10, _deadline);
    uint256 _before = gasleft();
    _hub.settle(_plainLane, _plainPayment);
    _used = _before - gasleft();
  }

  function _params(address _to) internal view returns (IPaymentHub.LaneParams memory _p) {
    _p =
      IPaymentHub.LaneParams({ token: address(_token), merchant: _to, messenger: address(0), destination: bytes32(0) });
  }
}
