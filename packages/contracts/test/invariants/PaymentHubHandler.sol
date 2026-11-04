// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';
import { Vm } from 'forge-std/Vm.sol';

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
  uint8 internal constant _EXIT_PAID = 1;
  uint8 internal constant _EXIT_REFUND = 2;
  bytes32 internal constant _TYPEHASH = keccak256(
    'Authorization(address authorizer,address authorized,address token,uint256 budget,uint256 nonce,uint256 deadline)'
  );
  bytes32 internal constant _DOMAIN_TYPEHASH =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');

  PaymentHub public hub;
  address public messenger;
  MockERC20[2] public tokens;
  address[2] public merchants = [makeAddr('merchant0'), makeAddr('merchant1')];
  address[3] public payers;
  uint256[3] internal _payerKeys;
  address[2] public brokers = [makeAddr('broker0'), makeAddr('broker1')];
  Lane[] internal _lanes;
  Ghost[] internal _ghosts;

  mapping(address token => uint256 amount) public ghostEscrow;
  mapping(address token => uint256 amount) public ghostCredit;
  mapping(address token => uint256 amount) public ghostSent;
  mapping(address token => mapping(address merchant => uint256 amount)) public ghostCreditOf;
  mapping(address token => uint256 count) public paysByToken;
  mapping(uint256 lane => uint256 count) public paysByLane;
  mapping(address payer => mapping(address broker => mapping(address token => uint256 budget))) public ghostBudget;
  mapping(bytes32 paymentId => IPaymentHub.Status status) internal _seen;
  mapping(bytes32 paymentId => uint8 mask) internal _exits;
  mapping(uint256 from => mapping(uint256 to => uint256 count)) public edgeCount;

  uint256 public payCalls;
  uint256 public settleCalls;
  uint256 public dispatchCalls;
  uint256 public refundCalls;
  uint256 public withdrawCalls;
  uint256 public warpCalls;
  uint256 public retryCalls;
  uint256 public authorizeCalls;
  uint256 public delegatePayCalls;
  uint256 public raceCalls;
  uint256 public statusChanges;
  uint256 public brokenChains;
  uint256 public exclusionBreaks;

  constructor(PaymentHub _hub, address _messenger) {
    hub = _hub;
    messenger = _messenger;
    vm.recordLogs();
    for (uint256 _p; _p < payers.length; ++_p) {
      (payers[_p], _payerKeys[_p]) = makeAddrAndKey(string.concat('payer', vm.toString(_p)));
    }
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
    bool _ok = _try(_selectors[_op % 3], _lane.id, _ghost.paymentId);
    assertFalse(_ok, 'terminal payment moved');
    ++retryCalls;
  }

  function authorize(uint256 _seed, uint256 _budgetSeed) external {
    _authorize(_seed % 3, (_seed / 3) % 2, (_seed / 6) % 2, bound(_budgetSeed, 0, 2 * _MAX_AMOUNT));
  }

  function payVia(uint256 _seed, uint256 _amountSeed, uint256 _windowSeed) external {
    uint256 _amount = bound(_amountSeed, 1, _MAX_AMOUNT);
    uint256 _p = _seed % 3;
    uint256 _b = (_seed / 3) % 2;
    uint256 _t = (_seed / 6) % 2;
    if (ghostBudget[payers[_p]][brokers[_b]][address(tokens[_t])] < _amount) _authorize(_p, _b, _t, _amount * 2);
    uint256 _lane = _t * 4 + ((_seed / 12) % 2) * 2 + (_seed / 24) % 2;
    _payFrom(_lane, payers[_p], brokers[_b], _amount, bound(_windowSeed, 1, 2 days));
    ghostBudget[payers[_p]][brokers[_b]][address(tokens[_t])] -= _amount;
    ++delegatePayCalls;
  }

  function race(uint256 _seed) external {
    (bool _found, uint256 _i) = _find(_seed, Want.Pending, false);
    if (!_found) _i = _newPending(_seed, false, 1 hours);
    Ghost storage _ghost = _ghosts[_i];
    Id _id = _lanes[_ghost.lane].id;
    if (block.timestamp <= _ghost.deadline) {
      vm.warp(_ghost.deadline);
      assertFalse(_try(hub.refund.selector, _id, _ghost.paymentId), 'refund inside the window');
    } else {
      assertFalse(_try(hub.settle.selector, _id, _ghost.paymentId), 'settle after the deadline');
      assertFalse(_try(hub.dispatch.selector, _id, _ghost.paymentId), 'dispatch after the deadline');
    }
    ++raceCalls;
  }

  function _authorize(uint256 _p, uint256 _b, uint256 _t, uint256 _budget) internal {
    IPaymentHub.Authorization memory _auth = IPaymentHub.Authorization({
      authorizer: payers[_p],
      authorized: brokers[_b],
      token: address(tokens[_t]),
      budget: _budget,
      nonce: hub.nonces(payers[_p]),
      deadline: block.timestamp + 1 hours
    });
    (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(_payerKeys[_p], _digest(_auth));
    hub.setAuthorizationWithSig(_auth, abi.encodePacked(_r, _s, _v));
    ghostBudget[_auth.authorizer][_auth.authorized][_auth.token] = _budget;
    ++authorizeCalls;
  }

  function _digest(IPaymentHub.Authorization memory _auth) internal view returns (bytes32 _hash) {
    bytes32 _domain =
      keccak256(abi.encode(_DOMAIN_TYPEHASH, keccak256('PaymentHub'), keccak256('1'), block.chainid, address(hub)));
    bytes32 _struct = keccak256(
      abi.encode(_TYPEHASH, _auth.authorizer, _auth.authorized, _auth.token, _auth.budget, _auth.nonce, _auth.deadline)
    );
    _hash = keccak256(abi.encodePacked('\x19\x01', _domain, _struct));
  }

  function _try(bytes4 _selector, Id _id, bytes32 _paymentId) internal returns (bool _ok) {
    (_ok,) = address(hub).call(abi.encodeWithSelector(_selector, _id, _paymentId));
    // The recorder keeps logs of reverted calls, so drop them here
    vm.getRecordedLogs();
  }

  // Reads the hub events: every change must continue the last seen status and follow a table edge
  function _observe() internal {
    Vm.Log[] memory _logs = vm.getRecordedLogs();
    for (uint256 _k; _k < _logs.length; ++_k) {
      if (_logs[_k].emitter != address(hub) || _logs[_k].topics[0] != IPaymentHub.StatusChanged.selector) continue;
      bytes32 _paymentId = _logs[_k].topics[2];
      (IPaymentHub.Status _from, IPaymentHub.Status _to) =
        abi.decode(_logs[_k].data, (IPaymentHub.Status, IPaymentHub.Status));
      if (_seen[_paymentId] != _from) ++brokenChains;
      _seen[_paymentId] = _to;
      ++edgeCount[uint256(_from)][uint256(_to)];
      ++statusChanges;
      if (_to == IPaymentHub.Status.Refunded) _exits[_paymentId] |= _EXIT_REFUND;
      if (_to == IPaymentHub.Status.Settled || _to == IPaymentHub.Status.Dispatched) _exits[_paymentId] |= _EXIT_PAID;
      if (_exits[_paymentId] == _EXIT_PAID | _EXIT_REFUND) ++exclusionBreaks;
    }
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
    address _payer = payers[(_amount + _window) % payers.length];
    return _payFrom(_laneIndex, _payer, _payer, _amount, _window);
  }

  function _payFrom(
    uint256 _laneIndex,
    address _payer,
    address _caller,
    uint256 _amount,
    uint256 _window
  )
    internal
    returns (uint256 _i)
  {
    Lane storage _lane = _lanes[_laneIndex];
    _lane.token.mint(_payer, _amount);
    uint256 _deadline = block.timestamp + _window;
    vm.prank(_caller);
    bytes32 _paymentId = hub.pay(_lane.id, _payer, _amount, _deadline);
    _ghosts.push(Ghost(_laneIndex, _paymentId, _amount, _deadline, IPaymentHub.Status.Pending));
    ghostEscrow[address(_lane.token)] += _amount;
    ++paysByToken[address(_lane.token)];
    ++paysByLane[_laneIndex];
    ++payCalls;
    _observe();
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
    _observe();
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
