// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { PaymentHub } from 'src/PaymentHub.sol';
import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';
import { PaymentHubHandler } from 'test/invariants/PaymentHubHandler.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { MockMessenger } from 'test/utils/MockMessenger.sol';

contract InvariantPaymentHub is Test {
  PaymentHub internal _hub;
  PaymentHubHandler internal _handler;

  function setUp() external {
    vm.warp(1_000_000);
    _hub = new PaymentHub(address(this));
    MockMessenger _messenger = new MockMessenger();
    _hub.enableMessenger(address(_messenger));
    _handler = new PaymentHubHandler(_hub, address(_messenger));

    targetContract(address(_handler));
    bytes4[] memory _selectors = new bytes4[](7);
    _selectors[0] = _handler.pay.selector;
    _selectors[1] = _handler.settle.selector;
    _selectors[2] = _handler.dispatch.selector;
    _selectors[3] = _handler.refund.selector;
    _selectors[4] = _handler.withdraw.selector;
    _selectors[5] = _handler.warp.selector;
    _selectors[6] = _handler.retry.selector;
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

  function afterInvariant() external view {
    assertGt(_handler.payCalls(), 0, 'pay never ran');
    assertGt(_handler.settleCalls(), 0, 'settle never ran');
    assertGt(_handler.dispatchCalls(), 0, 'dispatch never ran');
    assertGt(_handler.refundCalls(), 0, 'refund never ran');
    assertGt(_handler.withdrawCalls(), 0, 'withdraw never ran');
    assertGt(_handler.warpCalls(), 0, 'warp never ran');
    assertGt(_handler.retryCalls(), 0, 'retry never ran');
    assertGt(_handler.paysByToken(address(_handler.tokens(0))), 0, 'token 0 unused');
    assertGt(_handler.paysByToken(address(_handler.tokens(1))), 0, 'token 1 unused');
  }
}
