// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test, Vm } from 'forge-std/Test.sol';

import { SettlementReceiver } from 'src/SettlementReceiver.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { PaymentCallbackLib } from 'src/libraries/PaymentCallbackLib.sol';
import { CallbackMerchant } from 'test/utils/CallbackMerchant.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { TestTokenTransferrer } from 'test/utils/TestTokenTransferrer.sol';

contract UnitSettlementReceiverCallback is Test {
  bytes32 internal constant _SOURCE = keccak256('fuji');
  bytes32 internal constant _PAYMENT = keccak256('payment');

  address internal _originTransferrer = makeAddr('originTransferrer');
  address internal _originSender = makeAddr('originSender');
  address internal _fallback = makeAddr('fallback');
  address internal _plain = makeAddr('plain');

  MockERC20 internal _token;
  TestTokenTransferrer internal _transferrer;
  SettlementReceiver internal _receiver;
  CallbackMerchant internal _merchant;

  function setUp() external {
    _token = new MockERC20();
    _transferrer = new TestTokenTransferrer(_token);
    _receiver = new SettlementReceiver(
      address(_transferrer), _SOURCE, _originTransferrer, _originSender, address(_token), address(this)
    );
    _merchant = new CallbackMerchant();
    _receiver.setMerchant(address(_merchant), true);
    _receiver.setMerchant(_plain, true);
    _token.mint(address(_transferrer), 1000);
  }

  modifier whenAPaymentSettlesToAMerchantContract() {
    _;
  }

  function test_GivenACallbackThatSucceeds() external whenAPaymentSettlesToAMerchantContract {
    // it receives the payment id token and amount and emits no CallbackFailed
    vm.recordLogs();
    _deliver(_PAYMENT, address(_merchant), 100, gasleft());

    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.Settled));
    assertEq(_merchant.lastPaymentId(), _PAYMENT);
    assertEq(_merchant.lastToken(), address(_token));
    assertEq(_merchant.lastAmount(), 100);
    assertEq(_failedCallbacks(), 0);
  }

  function test_GivenACallbackThatRevertsOrBurnsAllGas() external whenAPaymentSettlesToAMerchantContract {
    // it settles and keeps the credit withdrawable and emits CallbackFailed
    CallbackMerchant.Mode[2] memory _modes = [CallbackMerchant.Mode.Revert, CallbackMerchant.Mode.BurnGas];
    for (uint256 _i; _i < _modes.length; ++_i) {
      bytes32 _id = keccak256(abi.encode('failing', _i));
      _merchant.configure(_modes[_i], IPaymentHub(address(0)), Id.wrap(0));
      vm.recordLogs();
      _deliver(_id, address(_merchant), 100, gasleft());

      assertEq(uint8(_receiver.statusOf(_id)), uint8(ISettlementReceiver.Status.Settled));
      assertEq(_receiver.creditOf(address(_merchant)), 100 * (_i + 1));
      assertEq(_failedCallbacks(), 1);
    }
    vm.prank(address(_merchant));
    _receiver.withdraw();
    assertEq(_token.balanceOf(address(_merchant)), 200);
  }

  function test_GivenACallbackThatWithdrawsDuringTheCall() external whenAPaymentSettlesToAMerchantContract {
    // it blocks the reentrant withdraw and the delivery settles
    _merchant.configure(CallbackMerchant.Mode.WithdrawFromCaller, IPaymentHub(address(0)), Id.wrap(0));
    _deliver(_PAYMENT, address(_merchant), 100, gasleft());

    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.Settled));
    assertEq(_merchant.reentrantGuarded(), 1);
    assertEq(_receiver.creditOf(address(_merchant)), 100);
    assertEq(_token.balanceOf(address(_merchant)), 0);
  }

  function test_GivenTooLittleGasToFundTheFullCallback() external whenAPaymentSettlesToAMerchantContract {
    // it reverts with SettlementReceiver_InsufficientCallbackGas and the full amount reaches the fallback
    uint256 _before = gasleft();
    _deliver(keccak256('plain'), _plain, 10, gasleft());
    uint256 _baseline = _before - gasleft();

    uint256 _starved = _baseline + PaymentCallbackLib.CALLBACK_GAS;
    _deliver(_PAYMENT, address(_merchant), 100, _starved);
    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.None));
    assertEq(_token.balanceOf(_fallback), 100);
    assertEq(_token.balanceOf(address(_receiver)), 10);

    vm.prank(address(_transferrer));
    _token.approve(address(_receiver), 100);
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_InsufficientCallbackGas.selector);
    vm.prank(address(_transferrer));
    _receiver.receiveTokens{ gas: _starved }(
      _SOURCE, _originTransferrer, _originSender, address(_token), 100, abi.encode(_PAYMENT, address(_merchant))
    );

    _deliver(_PAYMENT, address(_merchant), 100, _baseline + 2 * PaymentCallbackLib.CALLBACK_GAS);
    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.Settled));
  }

  function _deliver(bytes32 _paymentId, address _to, uint256 _amount, uint256 _gas) internal {
    _transferrer.deliver{ gas: _gas }(
      _receiver, _SOURCE, _originTransferrer, _originSender, _amount, abi.encode(_paymentId, _to), _fallback
    );
  }

  function _failedCallbacks() internal returns (uint256 _count) {
    Vm.Log[] memory _logs = vm.getRecordedLogs();
    for (uint256 _i; _i < _logs.length; ++_i) {
      if (_logs[_i].emitter == address(_receiver) && _logs[_i].topics[0] == ISettlementReceiver.CallbackFailed.selector)
      {
        ++_count;
      }
    }
  }
}
