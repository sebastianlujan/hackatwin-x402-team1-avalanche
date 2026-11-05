// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { SettlementReceiverHandler } from 'test/invariants/SettlementReceiverHandler.sol';

contract InvariantSettlementReceiver is Test {
  SettlementReceiverHandler internal _handler;

  function setUp() external {
    _handler = new SettlementReceiverHandler();
    targetContract(address(_handler));
    bytes4[] memory _selectors = new bytes4[](5);
    _selectors[0] = _handler.setMerchant.selector;
    _selectors[1] = _handler.deliver.selector;
    _selectors[2] = _handler.deliverInvalid.selector;
    _selectors[3] = _handler.withdraw.selector;
    _selectors[4] = _handler.retry.selector;
    targetSelector(FuzzSelector({ addr: address(_handler), selectors: _selectors }));
  }

  function invariant_TerminalStatesAreAbsorbing() external view {
    ISettlementReceiver _receiver = _handler.receiver();
    for (uint256 _i; _i < _handler.ghostCount(); ++_i) {
      (bytes32 _id, ISettlementReceiver.Status _status) = _handler.ghostAt(_i);
      assertTrue(_status == ISettlementReceiver.Status.Settled || _status == ISettlementReceiver.Status.Rejected);
      assertEq(uint8(_receiver.statusOf(_id)), uint8(_status), 'status drifted');
    }
    for (uint256 _i; _i < _handler.failedCount(); ++_i) {
      assertEq(uint8(_receiver.statusOf(_handler.failedAt(_i))), uint8(ISettlementReceiver.Status.None), 'stored');
    }
  }

  function invariant_ReceiverBalanceEqualsUnwithdrawnCredits() external view {
    assertEq(_handler.token().balanceOf(address(_handler.receiver())), _handler.ghostCredit());
    for (uint256 _m; _m < 3; ++_m) {
      address _merchant = _handler.merchants(_m);
      assertEq(_handler.receiver().creditOf(_merchant), _handler.ghostCreditOf(_merchant));
    }
  }

  function invariant_RejectedAndFailedDeliveriesReachTheFallback() external view {
    assertEq(_handler.token().balanceOf(_handler.fallbackRecipient()), _handler.ghostSwept());
  }

  function afterInvariant() external view {
    assertGt(_handler.setMerchantCalls(), 0, 'setMerchant never ran');
    assertGt(_handler.settledCount(), 0, 'nothing settled');
    assertGt(_handler.rejectedCount(), 0, 'nothing rejected');
    assertGt(_handler.failedCount(), 0, 'no failed delivery');
    assertGt(_handler.withdrawCalls(), 0, 'withdraw never ran');
    assertGt(_handler.retryCalls(), 0, 'retry never ran');
    assertGt(_handler.callbackSettled(), 0, 'callback merchant never settled');
  }
}
