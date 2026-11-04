// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';
import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { PaymentStateLib } from 'src/libraries/PaymentStateLib.sol';

contract UnitPaymentStateLib is Test {
  uint256 internal constant _HUB_STATUSES = 5;
  uint256 internal constant _RECEIVER_STATUSES = 4;

  modifier whenCheckingTheHubTable() {
    _;
  }

  function test_GivenThePairIsOneOfTheFourEdges() external whenCheckingTheHubTable {
    // it allows the transition
    assertTrue(PaymentStateLib.canTransition(IPaymentHub.Status.None, IPaymentHub.Status.Pending));
    assertTrue(PaymentStateLib.canTransition(IPaymentHub.Status.Pending, IPaymentHub.Status.Settled));
    assertTrue(PaymentStateLib.canTransition(IPaymentHub.Status.Pending, IPaymentHub.Status.Dispatched));
    assertTrue(PaymentStateLib.canTransition(IPaymentHub.Status.Pending, IPaymentHub.Status.Refunded));
  }

  function test_GivenAnyOtherOfThe25Pairs() external whenCheckingTheHubTable {
    // it rejects the transition
    uint256 _allowed;
    for (uint256 _from; _from < _HUB_STATUSES; ++_from) {
      for (uint256 _to; _to < _HUB_STATUSES; ++_to) {
        bool _expected = _isHubEdge(_from, _to);
        assertEq(PaymentStateLib.canTransition(IPaymentHub.Status(_from), IPaymentHub.Status(_to)), _expected);
        if (_expected) ++_allowed;
      }
    }
    assertEq(_allowed, 4);
  }

  function test_GivenFuzzedPairsWithinTheEnumRange(uint8 _from, uint8 _to) external whenCheckingTheHubTable {
    // it allows only the four edges
    uint256 _f = bound(_from, 0, _HUB_STATUSES - 1);
    uint256 _t = bound(_to, 0, _HUB_STATUSES - 1);
    assertEq(PaymentStateLib.canTransition(IPaymentHub.Status(_f), IPaymentHub.Status(_t)), _isHubEdge(_f, _t));
  }

  modifier whenCheckingTheReceiverTable() {
    _;
  }

  function test_GivenThePairIsOneOfTheThreeEdges() external whenCheckingTheReceiverTable {
    // it allows the transition
    assertTrue(PaymentStateLib.canTransition(ISettlementReceiver.Status.None, ISettlementReceiver.Status.Received));
    assertTrue(PaymentStateLib.canTransition(ISettlementReceiver.Status.Received, ISettlementReceiver.Status.Settled));
    assertTrue(PaymentStateLib.canTransition(ISettlementReceiver.Status.Received, ISettlementReceiver.Status.Rejected));
  }

  function test_GivenAnyOtherOfThe16Pairs() external whenCheckingTheReceiverTable {
    // it rejects the transition
    uint256 _allowed;
    for (uint256 _from; _from < _RECEIVER_STATUSES; ++_from) {
      for (uint256 _to; _to < _RECEIVER_STATUSES; ++_to) {
        bool _expected = _from == 0 ? _to == 1 : _from == 1 && (_to == 2 || _to == 3);
        assertEq(
          PaymentStateLib.canTransition(ISettlementReceiver.Status(_from), ISettlementReceiver.Status(_to)), _expected
        );
        if (_expected) ++_allowed;
      }
    }
    assertEq(_allowed, 3);
  }

  function _isHubEdge(uint256 _from, uint256 _to) internal pure returns (bool _edge) {
    _edge = (_from == 0 && _to == 1) || (_from == 1 && _to >= 2 && _to <= 4);
  }
}
