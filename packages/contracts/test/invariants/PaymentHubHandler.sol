// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { PaymentHub } from 'src/PaymentHub.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { PaymentStateLib } from 'src/libraries/PaymentStateLib.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';

/// @notice Drives the hub through every action with ghost accounting and never reverts
contract PaymentHubHandler is Test {
  struct Lane {
    Id id;
    MockERC20 token;
    address merchant;
    bool cross;
  }

  struct Ghost {
    uint256 lane;
    bytes32 paymentId;
    uint256 amount;
    uint256 deadline;
    IPaymentHub.Status status;
  }

  enum Want {
    Live,
    Pending,
    Expired,
    Terminal
  }

  uint256 internal constant _MAX_AMOUNT = 1000;

  PaymentHub public hub;
  address public messenger;
  MockERC20[2] public tokens;
  address[2] public merchants = [makeAddr('merchant0'), makeAddr('merchant1')];
  address[3] public payers = [makeAddr('payer0'), makeAddr('payer1'), makeAddr('payer2')];
  Lane[] internal _lanes;
  Ghost[] internal _ghosts;

  mapping(address token => uint256 amount) public ghostEscrow;
  mapping(address token => uint256 amount) public ghostCredit;
  mapping(address token => uint256 amount) public ghostSent;
  mapping(address token => mapping(address merchant => uint256 amount)) public ghostCreditOf;
  mapping(address token => uint256 count) public paysByToken;
  mapping(uint256 lane => uint256 count) public paysByLane;

  uint256 public payCalls;
  uint256 public settleCalls;
  uint256 public dispatchCalls;
  uint256 public refundCalls;
  uint256 public withdrawCalls;
  uint256 public warpCalls;
  uint256 public retryCalls;

  constructor(PaymentHub _hub, address _messenger) {
    hub = _hub;
    messenger = _messenger;
    for (uint256 _t; _t < 2; ++_t) {
      tokens[_t] = new MockERC20();
      for (uint256 _p; _p < payers.length; ++_p) {
        vm.prank(payers[_p]);
        tokens[_t].approve(address(_hub), type(uint256).max);
      }
      for (uint256 _m; _m < 2; ++_m) {
        _addLane(tokens[_t], merchants[_m], false);
        _addLane(tokens[_t], merchants[_m], true);
      }
    }
  }

  function ghostCount() external view returns (uint256 _count) {
    _count = _ghosts.length;
  }

  function ghostAt(uint256 _i) external view returns (Ghost memory _ghost) {
    _ghost = _ghosts[_i];
  }

  function laneId(uint256 _i) external view returns (Id _id) {
    _id = _lanes[_i].id;
  }

  function pay(uint256 _laneSeed, uint256 _amountSeed, uint256 _windowSeed) external {
    _pay(_laneSeed % _lanes.length, bound(_amountSeed, 1, _MAX_AMOUNT), bound(_windowSeed, 1, 2 days));
  }

  function settle(uint256 _seed) external {
    _settle(_pendingOrNew(false, _seed));
  }

  function dispatch(uint256 _seed) external {
    _dispatch(_pendingOrNew(true, _seed));
  }

  function refund(uint256 _seed) external {
    (bool _found, uint256 _i) = _find(_seed, Want.Expired, false);
    if (!_found) {
      (_found, _i) = _find(_seed, Want.Pending, false);
      if (!_found) _i = _newPending(_seed, false, 1);
      if (block.timestamp <= _ghosts[_i].deadline) vm.warp(_ghosts[_i].deadline + 1);
    }
    _refund(_i);
  }

  function withdraw(uint256 _seed) external {
    for (uint256 _n; _n < 4; ++_n) {
      uint256 _k = (_seed % 4 + _n) % 4;
      MockERC20 _token = tokens[_k / 2];
      address _merchant = merchants[_k % 2];
      if (ghostCreditOf[address(_token)][_merchant] != 0) return _withdraw(_token, _merchant);
    }
    _settle(_newPending(_seed, false, 1 hours));
    Lane storage _lane = _lanes[_ghosts[_ghosts.length - 1].lane];
    _withdraw(_lane.token, _lane.merchant);
  }

  function warp(uint256 _delta) external {
    ++warpCalls;
    vm.warp(block.timestamp + bound(_delta, 1, 3 days));
  }

  function retry(uint256 _seed, uint256 _op) external {
    (bool _found, uint256 _i) = _find(_seed, Want.Terminal, false);
    if (!_found) {
      _i = _newPending(_seed, false, 1 hours);
      _settle(_i);
    }
    Ghost storage _ghost = _ghosts[_i];
    Lane storage _lane = _lanes[_ghost.lane];
    bytes4[3] memory _selectors = [hub.settle.selector, hub.dispatch.selector, hub.refund.selector];
    (bool _ok,) = address(hub).call(abi.encodeWithSelector(_selectors[_op % 3], _lane.id, _ghost.paymentId));
    assertFalse(_ok, 'terminal payment moved');
    ++retryCalls;
  }

  function _addLane(MockERC20 _token, address _merchant, bool _cross) internal {
    IPaymentHub.LaneParams memory _p = IPaymentHub.LaneParams({
      token: address(_token),
      merchant: _merchant,
      messenger: _cross ? messenger : address(0),
      destination: _cross ? keccak256('destination') : bytes32(0)
    });
    _lanes.push(Lane(hub.createLane(_p), _token, _merchant, _cross));
  }

  function _pay(uint256 _laneIndex, uint256 _amount, uint256 _window) internal returns (uint256 _i) {
    Lane storage _lane = _lanes[_laneIndex];
    address _payer = payers[(_amount + _window) % payers.length];
    _lane.token.mint(_payer, _amount);
    uint256 _deadline = block.timestamp + _window;
    vm.prank(_payer);
    bytes32 _paymentId = hub.pay(_lane.id, _payer, _amount, _deadline);
    _ghosts.push(Ghost(_laneIndex, _paymentId, _amount, _deadline, IPaymentHub.Status.Pending));
    ghostEscrow[address(_lane.token)] += _amount;
    ++paysByToken[address(_lane.token)];
    ++paysByLane[_laneIndex];
    ++payCalls;
    return _ghosts.length - 1;
  }

  function _settle(uint256 _i) internal {
    Ghost storage _ghost = _ghosts[_i];
    Lane storage _lane = _lanes[_ghost.lane];
    hub.settle(_lane.id, _ghost.paymentId);
    _move(_ghost, IPaymentHub.Status.Settled);
    ghostEscrow[address(_lane.token)] -= _ghost.amount;
    ghostCredit[address(_lane.token)] += _ghost.amount;
    ghostCreditOf[address(_lane.token)][_lane.merchant] += _ghost.amount;
    ++settleCalls;
  }

  function _dispatch(uint256 _i) internal {
    Ghost storage _ghost = _ghosts[_i];
    Lane storage _lane = _lanes[_ghost.lane];
    hub.dispatch(_lane.id, _ghost.paymentId);
    _move(_ghost, IPaymentHub.Status.Dispatched);
    ghostEscrow[address(_lane.token)] -= _ghost.amount;
    ghostSent[address(_lane.token)] += _ghost.amount;
    ++dispatchCalls;
  }

  function _refund(uint256 _i) internal {
    Ghost storage _ghost = _ghosts[_i];
    Lane storage _lane = _lanes[_ghost.lane];
    hub.refund(_lane.id, _ghost.paymentId);
    _move(_ghost, IPaymentHub.Status.Refunded);
    ghostEscrow[address(_lane.token)] -= _ghost.amount;
    ++refundCalls;
  }

  function _withdraw(MockERC20 _token, address _merchant) internal {
    uint256 _credit = ghostCreditOf[address(_token)][_merchant];
    uint256 _before = _token.balanceOf(_merchant);
    vm.prank(_merchant);
    hub.withdraw(address(_token));
    assertEq(_token.balanceOf(_merchant), _before + _credit, 'withdrawn amount');
    ghostCreditOf[address(_token)][_merchant] = 0;
    ghostCredit[address(_token)] -= _credit;
    ++withdrawCalls;
  }

  function _move(Ghost storage _ghost, IPaymentHub.Status _to) internal {
    assertTrue(PaymentStateLib.canTransition(_ghost.status, _to), 'edge not in table');
    assertEq(uint8(hub.statusOf(_lanes[_ghost.lane].id, _ghost.paymentId)), uint8(_to), 'status after action');
    _ghost.status = _to;
  }

  function _pendingOrNew(bool _cross, uint256 _seed) internal returns (uint256 _i) {
    bool _found;
    (_found, _i) = _find(_seed, Want.Live, _cross);
    if (!_found) _i = _newPending(_seed, _cross, 1 hours);
  }

  function _newPending(uint256 _seed, bool _cross, uint256 _window) internal returns (uint256 _i) {
    _i = _pay((_seed % 4) * 2 + (_cross ? 1 : 0), bound(_seed, 1, _MAX_AMOUNT), _window);
  }

  // Scans from a rotating start so every payment is reachable
  function _find(uint256 _seed, Want _want, bool _cross) internal view returns (bool, uint256) {
    uint256 _n = _ghosts.length;
    for (uint256 _k; _k < _n; ++_k) {
      uint256 _i = (_seed % _n + _k) % _n;
      Ghost storage _g = _ghosts[_i];
      bool _pending = _g.status == IPaymentHub.Status.Pending;
      bool _late = block.timestamp > _g.deadline;
      if (_want == Want.Terminal && !_pending) return (true, _i);
      if (_want == Want.Pending && _pending) return (true, _i);
      if (_want == Want.Expired && _pending && _late) return (true, _i);
      if (_want == Want.Live && _pending && !_late && _lanes[_g.lane].cross == _cross) return (true, _i);
    }
    return (false, 0);
  }
}
