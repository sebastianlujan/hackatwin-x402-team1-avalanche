// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { PaymentHub } from 'src/PaymentHub.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { MockMessenger } from 'test/utils/MockMessenger.sol';

contract GasPaymentHub is Test {
  bytes32 internal constant _DESTINATION = keccak256('destination');

  address internal _payer = makeAddr('payer');
  address internal _merchant = makeAddr('merchant');
  uint256 internal _deadline;

  PaymentHub internal _hub;
  MockERC20 internal _token;
  Id internal _local;
  Id internal _cross;
  bytes32 internal _localPayment;
  bytes32 internal _crossPayment;
  bytes32 internal _expiredPayment;

  function setUp() external {
    vm.warp(1_000_000);
    _deadline = block.timestamp + 1 hours;
    _hub = new PaymentHub(address(this));
    _token = new MockERC20();
    MockMessenger _messenger = new MockMessenger();
    _hub.enableMessenger(address(_messenger));
    _local = _hub.createLane(_params(address(0), bytes32(0)));
    _cross = _hub.createLane(_params(address(_messenger), _DESTINATION));
    _token.mint(_payer, 1000);
    vm.startPrank(_payer);
    _token.approve(address(_hub), type(uint256).max);
    _localPayment = _hub.pay(_local, _payer, 100, _deadline);
    _crossPayment = _hub.pay(_cross, _payer, 100, _deadline);
    _expiredPayment = _hub.pay(_local, _payer, 100, block.timestamp + 1);
    vm.stopPrank();
  }

  modifier whenTheHubHotPathsRunOnFreshState() {
    _;
  }

  function test_GivenAFirstPaymentOnALocalLane() external whenTheHubHotPathsRunOnFreshState {
    // it pays and the gas lands in the snapshot
    vm.prank(_payer);
    bytes32 _paymentId = _hub.pay(_local, _payer, 10, _deadline);
    assertEq(uint8(_hub.statusOf(_local, _paymentId)), uint8(IPaymentHub.Status.Pending));
  }

  function test_GivenAFirstPaymentOnACrossChainLane() external whenTheHubHotPathsRunOnFreshState {
    // it pays and the gas lands in the snapshot
    vm.prank(_payer);
    bytes32 _paymentId = _hub.pay(_cross, _payer, 10, _deadline);
    assertEq(uint8(_hub.statusOf(_cross, _paymentId)), uint8(IPaymentHub.Status.Pending));
  }

  function test_GivenAPendingLocalPayment() external whenTheHubHotPathsRunOnFreshState {
    // it settles and the gas lands in the snapshot
    _hub.settle(_local, _localPayment);
    assertEq(uint8(_hub.statusOf(_local, _localPayment)), uint8(IPaymentHub.Status.Settled));
  }

  function test_GivenAPendingCrossChainPayment() external whenTheHubHotPathsRunOnFreshState {
    // it dispatches and the gas lands in the snapshot
    _hub.dispatch(_cross, _crossPayment);
    assertEq(uint8(_hub.statusOf(_cross, _crossPayment)), uint8(IPaymentHub.Status.Dispatched));
  }

  function test_GivenAnExpiredPendingPayment() external whenTheHubHotPathsRunOnFreshState {
    // it refunds and the gas lands in the snapshot
    vm.warp(block.timestamp + 2);
    _hub.refund(_local, _expiredPayment);
    assertEq(uint8(_hub.statusOf(_local, _expiredPayment)), uint8(IPaymentHub.Status.Refunded));
  }

  function test_GivenACreditedMerchant() external whenTheHubHotPathsRunOnFreshState {
    // it withdraws and the gas lands in the snapshot
    _hub.settle(_local, _localPayment);
    vm.prank(_merchant);
    _hub.withdraw(address(_token));
    assertEq(_token.balanceOf(_merchant), 100);
  }

  function _params(address _m, bytes32 _d) internal view returns (IPaymentHub.LaneParams memory _p) {
    _p = IPaymentHub.LaneParams({ token: address(_token), merchant: _merchant, messenger: _m, destination: _d });
  }
}
