// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { SettlementReceiver } from 'src/SettlementReceiver.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { CallbackMerchant } from 'test/utils/CallbackMerchant.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { TestTokenTransferrer } from 'test/utils/TestTokenTransferrer.sol';

/// @notice Drives the receiver through deliveries and withdrawals with ghost accounting and never reverts
contract SettlementReceiverHandler is Test {
  struct Ghost {
    bytes32 id;
    address merchant;
    ISettlementReceiver.Status status;
  }

  bytes32 internal constant _SOURCE = keccak256('fuji');
  address internal constant _ORIGIN_TRANSFERRER = address(0xA11CE);
  address internal constant _ORIGIN_SENDER = address(0xB0B);
  uint256 internal constant _MAX_AMOUNT = 1000;

  SettlementReceiver public receiver;
  MockERC20 public token;
  TestTokenTransferrer public transferrer;
  address public fallbackRecipient = makeAddr('fallback');
  address[3] public merchants;
  Ghost[] internal _ghosts;
  bytes32[] internal _failed;
  mapping(address merchant => bool allowed) internal _allowed;

  mapping(address merchant => uint256 amount) public ghostCreditOf;
  uint256 public ghostCredit;
  uint256 public ghostSwept;
  uint256 public setMerchantCalls;
  uint256 public settledCount;
  uint256 public rejectedCount;
  uint256 public withdrawCalls;
  uint256 public retryCalls;
  uint256 public callbackSettled;
  uint256 internal _deliveries;
  uint256 internal _nextId;

  constructor() {
    token = new MockERC20();
    transferrer = new TestTokenTransferrer(token);
    receiver = new SettlementReceiver(
      address(transferrer), _SOURCE, _ORIGIN_TRANSFERRER, _ORIGIN_SENDER, address(token), address(this)
    );
    CallbackMerchant _callback = new CallbackMerchant();
    _callback.configure(CallbackMerchant.Mode.Revert, IPaymentHub(address(0)), Id.wrap(0));
    merchants = [makeAddr('merchant0'), makeAddr('merchant1'), address(_callback)];
  }

  function ghostCount() external view returns (uint256 _count) {
    _count = _ghosts.length;
  }

  function ghostAt(uint256 _i) external view returns (bytes32 _id, ISettlementReceiver.Status _status) {
    (_id, _status) = (_ghosts[_i].id, _ghosts[_i].status);
  }

  function failedCount() external view returns (uint256 _count) {
    _count = _failed.length;
  }

  function failedAt(uint256 _i) external view returns (bytes32 _id) {
    _id = _failed[_i];
  }

  function setMerchant(uint256 _seed, bool _allow) external {
    _setMerchant(merchants[_seed % 3], _allow);
  }

  function deliver(uint256 _seed, uint256 _amountSeed) external {
    // Deliveries 0 to 2 settle at every merchant and delivery 3 is rejected, so each path is reached in every run
    uint256 _n = _deliveries++;
    address _merchant = _n < 3 ? merchants[_n] : merchants[_seed % 3];
    if (_n < 3) _setMerchant(_merchant, true);
    if (_n == 3) _setMerchant(_merchant, false);
    _deliver(_merchant, bound(_amountSeed, 1, _MAX_AMOUNT));
  }

  function deliverInvalid(uint256 _seed, uint256 _kind) external {
    bytes32 _id = bytes32(++_nextId);
    uint256 _amount = bound(_seed, 1, _MAX_AMOUNT);
    bytes memory _payload = abi.encode(_id, merchants[_seed % 3]);
    bytes32 _source = _SOURCE;
    if (_kind % 3 == 0) _source = keccak256('other');
    if (_kind % 3 == 1) _amount = 0;
    if (_kind % 3 == 2) _payload = bytes.concat(_payload, hex'01');
    _failed.push(_id);
    assertFalse(_send(_source, _amount, _payload, _amount), 'invalid delivery accepted');
  }

  function retry(uint256 _seed) external {
    if (_ghosts.length == 0) _deliver(merchants[_seed % 3], 1);
    Ghost storage _ghost = _ghosts[_seed % _ghosts.length];
    ++retryCalls;
    assertFalse(_send(_SOURCE, 1, abi.encode(_ghost.id, _ghost.merchant), 1), 'duplicate accepted');
  }

  function withdraw(uint256 _seed) external {
    address _merchant;
    for (uint256 _k; _k < 3; ++_k) {
      if (ghostCreditOf[merchants[(_seed % 3 + _k) % 3]] != 0) _merchant = merchants[(_seed % 3 + _k) % 3];
    }
    if (_merchant == address(0)) {
      _merchant = merchants[_seed % 3];
      _setMerchant(_merchant, true);
      _deliver(_merchant, 1 + _seed % _MAX_AMOUNT);
    }
    uint256 _credit = ghostCreditOf[_merchant];
    uint256 _before = token.balanceOf(_merchant);
    vm.prank(_merchant);
    receiver.withdraw();
    assertEq(token.balanceOf(_merchant), _before + _credit, 'withdrawn amount');
    ghostCreditOf[_merchant] = 0;
    ghostCredit -= _credit;
    ++withdrawCalls;
  }

  function _setMerchant(address _merchant, bool _allow) internal {
    receiver.setMerchant(_merchant, _allow);
    _allowed[_merchant] = _allow;
    ++setMerchantCalls;
  }

  function _deliver(address _merchant, uint256 _amount) internal {
    bytes32 _id = bytes32(++_nextId);
    bool _settled = _allowed[_merchant];
    assertTrue(_send(_SOURCE, _amount, abi.encode(_id, _merchant), _settled ? 0 : _amount), 'valid delivery refused');
    if (_settled) {
      ghostCreditOf[_merchant] += _amount;
      ghostCredit += _amount;
      ++settledCount;
      if (_merchant == merchants[2]) ++callbackSettled;
    } else {
      ++rejectedCount;
    }
    _ghosts.push(
      Ghost(_id, _merchant, _settled ? ISettlementReceiver.Status.Settled : ISettlementReceiver.Status.Rejected)
    );
  }

  // Delivers through the transferrer double and checks the fallback received exactly what the receiver left
  function _send(
    bytes32 _source,
    uint256 _amount,
    bytes memory _payload,
    uint256 _expectedSweep
  )
    internal
    returns (bool _ok)
  {
    token.mint(address(transferrer), _amount);
    uint256 _held = token.balanceOf(address(receiver));
    uint256 _fallback = token.balanceOf(fallbackRecipient);
    bool _willSettle = _expectedSweep == 0 && _amount != 0;
    _ok =
      transferrer.deliver(receiver, _source, _ORIGIN_TRANSFERRER, _ORIGIN_SENDER, _amount, _payload, fallbackRecipient);

    uint256 _swept = token.balanceOf(fallbackRecipient) - _fallback;
    ghostSwept += _swept;
    assertEq(_swept, _expectedSweep, 'sweep');
    assertEq(token.balanceOf(address(receiver)), _held + (_willSettle ? _amount : 0), 'receiver balance');
  }
}
