// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';
import { PaymentStateLib } from 'src/libraries/PaymentStateLib.sol';
import { PaymentHubHandler } from 'test/invariants/PaymentHubHandler.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { MockMessenger } from 'test/utils/MockMessenger.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract InvariantPaymentHub is Test {
  PaymentHubHarness internal _hub;
  PaymentHubHandler internal _handler;

  function setUp() external {
    vm.warp(1_000_000);
    _hub = new PaymentHubHarness(address(this));
    MockMessenger _messenger = new MockMessenger();
    _hub.enableMessenger(address(_messenger));
    _handler = new PaymentHubHandler(_hub, address(_messenger));

    targetContract(address(_handler));
    bytes4[] memory _selectors = new bytes4[](10);
    _selectors[0] = _handler.pay.selector;
    _selectors[1] = _handler.settle.selector;
    _selectors[2] = _handler.dispatch.selector;
    _selectors[3] = _handler.refund.selector;
    _selectors[4] = _handler.withdraw.selector;
    _selectors[5] = _handler.warp.selector;
    _selectors[6] = _handler.retry.selector;
    _selectors[7] = _handler.authorize.selector;
    _selectors[8] = _handler.payVia.selector;
    _selectors[9] = _handler.race.selector;
    targetSelector(FuzzSelector({ addr: address(_handler), selectors: _selectors }));
  }

  function invariant_TerminalStatesAreAbsorbing() external view {
    for (uint256 _i; _i < _handler.ghostCount(); ++_i) {
      PaymentHubHandler.Ghost memory _ghost = _handler.ghostAt(_i);
      assertEq(uint8(_hub.statusOf(_handler.laneId(_ghost.lane), _ghost.paymentId)), uint8(_ghost.status), 'drifted');
    }
  }

  function invariant_HubBalanceIsEscrowPlusCredits() external view {
    for (uint256 _t; _t < 2; ++_t) {
      address _token = address(_handler.tokens(_t));
      assertEq(MockERC20(_token).balanceOf(address(_hub)), _handler.ghostEscrow(_token) + _handler.ghostCredit(_token));
      assertEq(MockERC20(_token).balanceOf(_handler.messenger()), _handler.ghostSent(_token));
    }
  }

  function invariant_OnlyTableEdgesAreObserved() external view {
    uint256 _observed;
    for (uint256 _from; _from < 5; ++_from) {
      for (uint256 _to; _to < 5; ++_to) {
        uint256 _count = _handler.edgeCount(_from, _to);
        _observed += _count;
        if (_count != 0) {
          assertTrue(
            PaymentStateLib.canTransition(IPaymentHub.Status(_from), IPaymentHub.Status(_to)), 'edge outside the table'
          );
        }
      }
    }
    assertEq(_handler.brokenChains(), 0, 'change did not continue the last status');
    assertEq(_observed, _handler.statusChanges());
    assertEq(
      _observed, _handler.payCalls() + _handler.settleCalls() + _handler.dispatchCalls() + _handler.refundCalls()
    );
  }

  function invariant_PaidAndRefundedAreExclusive() external view {
    assertEq(_handler.exclusionBreaks(), 0, 'a payment was paid out and refunded');
  }

  function invariant_BudgetOnlyChangesBySignatureOrDelegatePay() external view {
    for (uint256 _p; _p < 3; ++_p) {
      for (uint256 _b; _b < 2; ++_b) {
        for (uint256 _t; _t < 2; ++_t) {
          address _token = address(_handler.tokens(_t));
          assertEq(
            _hub.exposed_budget(_handler.payers(_p), _handler.brokers(_b), _token),
            _handler.ghostBudget(_handler.payers(_p), _handler.brokers(_b), _token),
            'budget moved outside authorize or delegate pay'
          );
        }
      }
    }
  }

  function afterInvariant() external view {
    assertGt(_handler.payCalls(), 0, 'pay never ran');
    assertGt(_handler.settleCalls(), 0, 'settle never ran');
    assertGt(_handler.dispatchCalls(), 0, 'dispatch never ran');
    assertGt(_handler.refundCalls(), 0, 'refund never ran');
    assertGt(_handler.withdrawCalls(), 0, 'withdraw never ran');
    assertGt(_handler.warpCalls(), 0, 'warp never ran');
    assertGt(_handler.retryCalls(), 0, 'retry never ran');
    assertGt(_handler.authorizeCalls(), 0, 'authorize never ran');
    assertGt(_handler.delegatePayCalls(), 0, 'delegate pay never ran');
    assertGt(_handler.raceCalls(), 0, 'race never ran');
    assertGt(_handler.paysByToken(address(_handler.tokens(0))), 0, 'token 0 unused');
    assertGt(_handler.paysByToken(address(_handler.tokens(1))), 0, 'token 1 unused');
  }
}
