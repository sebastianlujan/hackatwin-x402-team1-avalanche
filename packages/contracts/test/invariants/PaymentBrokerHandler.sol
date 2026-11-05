// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Client } from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';

import { PaymentBroker } from 'src/PaymentBroker.sol';
import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { BrokerFixture } from 'test/utils/BrokerFixture.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { MockMessenger } from 'test/utils/MockMessenger.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

/// @notice Drives the broker through pair changes, budgets, messenger failures, deliveries and replays and never reverts
contract PaymentBrokerHandler is BrokerFixture {
  struct Ghost {
    bytes32 id;
    IPaymentBroker.Status status;
    address bound;
    bytes32 paymentId;
    uint64 selector;
    address sender;
    bytes payload;
  }

  uint256 internal constant _MAX_AMOUNT = 200;
  uint256 internal constant _FORCED = 4;

  PaymentBroker public broker;
  PaymentHubHarness public hub;
  MockERC20 public token;
  Id public laneId;
  address[3] public payers;
  Ghost[] internal _ghosts;
  mapping(uint64 selector => mapping(address sender => address payer)) internal _payerOf;

  mapping(address payer => uint256 amount) public granted;
  mapping(address payer => uint256 amount) public paid;
  uint256 public paymentCount;
  uint256 public setPairCalls;
  uint256 public grantCalls;
  uint256 public acceptedCount;
  uint256 public dispatchFailedCount;
  uint256 public hubRefusalCount;
  uint256 public mismatchCount;
  uint256 public notAllowedCount;
  uint256 public replayCount;
  uint256 internal _deliveries;
  uint256 internal _nextId;

  constructor() {
    address _payerR = makeAddr('payerR');
    _deployBroker();
    _fund(_payerR);
    (broker, hub, token, laneId) = (_broker, _hub, _token, _lane);
    payers = [_payerP, _payerQ, _payerR];
    for (uint256 _i; _i < 3; ++_i) {
      granted[payers[_i]] = _BUDGET;
    }
  }

  function ghostCount() external view returns (uint256 _count) {
    _count = _ghosts.length;
  }

  function ghostAt(uint256 _i)
    external
    view
    returns (bytes32 _id, IPaymentBroker.Status _status, address _bound, bytes32 _paymentIdOf)
  {
    Ghost storage _ghost = _ghosts[_i];
    (_id, _status, _bound, _paymentIdOf) = (_ghost.id, _ghost.status, _ghost.bound, _ghost.paymentId);
  }

  function paymentIdAt(uint256 _count) external view returns (bytes32 _id) {
    _id = _paymentId(_count);
  }

  function remaining(address _payer) public view returns (uint256 _budget) {
    _budget = hub.exposed_budget(_payer, address(broker), address(token));
  }

  function setPair(uint256 _pairSeed, uint256 _payerSeed) external {
    (uint64 _selectorOf, address _sender) = _pair(_pairSeed);
    _bind(_selectorOf, _sender, _payerSeed % 4 == 0 ? address(0) : payers[_payerSeed % 3]);
  }

  function grant(uint256 _payerSeed, uint256 _amountSeed) external {
    _topUp(payers[_payerSeed % 3], bound(_amountSeed, 1, 300));
  }

  function setMode(uint256 _seed) external {
    _messenger.setMode(_seed % 2 == 0 ? MockMessenger.Mode.Pull : MockMessenger.Mode.Revert);
  }

  function deliver(uint256 _pairSeed, uint256 _payerSeed, uint256 _amountSeed) external {
    _deliverOne(_pairSeed, _payerSeed, _amountSeed);
  }

  function replay(uint256 _seed) external {
    if (_ghosts.length == 0) _deliverOne(_seed, _seed, _seed);
    Ghost storage _ghost = _ghosts[_seed % _ghosts.length];
    if (_payerOf[_ghost.selector][_ghost.sender] == address(0)) {
      _bind(_ghost.selector, _ghost.sender, payers[_seed % 3]);
    }
    ++replayCount;
    (bool _ok, bytes memory _error) = _call(_message(_ghost.id, _ghost.selector, _ghost.sender, _ghost.payload));
    assertFalse(_ok, 'replay accepted');
    assertEq(_error, abi.encodeWithSelector(IPaymentBroker.PaymentBroker_MessageAlreadyProcessed.selector, _ghost.id));
  }

  // Deliveries 0 to 3 force an accept, a payer mismatch, a hub refusal and a failed dispatch in every run
  function _deliverOne(uint256 _pairSeed, uint256 _payerSeed, uint256 _amountSeed) internal {
    uint256 _n = _deliveries++;
    (uint64 _selectorOf, address _sender) = _pair(_pairSeed);
    if (_n < _FORCED) _force(_n, _selectorOf, _sender);
    address _bound = _payerOf[_selectorOf][_sender];
    address _onBehalf = _n == 1 ? _payerQ : (_n < _FORCED ? _bound : payers[_payerSeed % 3]);
    uint256 _amount = _n == 2 ? remaining(_onBehalf) + 1 : bound(_amountSeed, 1, _MAX_AMOUNT);
    bool _refused = _onBehalf == _bound && _amount > remaining(_onBehalf);
    bool _created = _bound != address(0) && _onBehalf == _bound && !_refused;
    bytes memory _payload = _data(_lane, _onBehalf, _amount, _deadline);
    bytes32 _id = bytes32(++_nextId);
    token.mint(_onBehalf, _amount);

    (bool _ok, bytes memory _error) = _call(_message(_id, _selectorOf, _sender, _payload));
    if (_bound == address(0)) {
      assertFalse(_ok, 'unbound pair accepted');
      assertEq(bytes4(_error), IPaymentBroker.PaymentBroker_SourceNotAllowed.selector);
      ++notAllowedCount;
      return;
    }
    assertTrue(_ok, 'delivery reverted');
    bytes32 _created_ = _record(_created, _onBehalf, _amount);
    if (!_created) _refused ? ++hubRefusalCount : ++mismatchCount;
    IPaymentBroker.Status _status = _created ? IPaymentBroker.Status.Accepted : IPaymentBroker.Status.Rejected;
    assertEq(uint8(broker.statusOf(_id)), uint8(_status), 'status');
    _ghosts.push(Ghost(_id, _status, _bound, _created_, _selectorOf, _sender, _payload));
  }

  function _record(bool _created, address _payer, uint256 _amount) internal returns (bytes32 _id) {
    if (!_created) {
      assertEq(uint8(hub.statusOf(laneId, _paymentId(paymentCount + 1))), uint8(IPaymentHub.Status.None), 'paid');
      return bytes32(0);
    }
    _id = _paymentId(++paymentCount);
    paid[_payer] += _amount;
    bool _failed = _messenger.mode() == MockMessenger.Mode.Revert;
    IPaymentHub.Status _expected = _failed ? IPaymentHub.Status.Pending : IPaymentHub.Status.Dispatched;
    assertEq(uint8(hub.statusOf(laneId, _id)), uint8(_expected), 'payment status');
    _failed ? ++dispatchFailedCount : ++acceptedCount;
  }

  function _force(uint256 _n, uint64 _selectorOf, address _sender) internal {
    _bind(_selectorOf, _sender, payers[0]);
    if (remaining(payers[0]) < _MAX_AMOUNT) _topUp(payers[0], _MAX_AMOUNT);
    _messenger.setMode(_n == 3 ? MockMessenger.Mode.Revert : MockMessenger.Mode.Pull);
  }

  function _bind(uint64 _selectorOf, address _sender, address _payer) internal {
    _broker.setAllowedSender(_selectorOf, _sender, _payer);
    _payerOf[_selectorOf][_sender] = _payer;
    ++setPairCalls;
  }

  function _topUp(address _payer, uint256 _amount) internal {
    hub.exposed_setBudget(_payer, address(broker), address(token), remaining(_payer) + _amount);
    granted[_payer] += _amount;
    ++grantCalls;
  }

  function _pair(uint256 _seed) internal view returns (uint64 _selectorOf, address _sender) {
    if (_seed % 3 == 0) return (_SELECTOR_A, _senderX);
    if (_seed % 3 == 1) return (_SELECTOR_A, _senderY);
    return (_SELECTOR_B, _senderX);
  }

  function _call(Client.Any2EVMMessage memory _delivered) internal returns (bool _ok, bytes memory _error) {
    vm.prank(_router);
    (_ok, _error) = address(broker).call(abi.encodeCall(broker.ccipReceive, (_delivered)));
  }
}
