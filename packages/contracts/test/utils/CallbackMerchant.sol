// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ReentrancyGuardTransient } from '@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol';

import { IPaymentCallback } from 'src/interfaces/IPaymentCallback.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';

/// @notice A merchant whose callback succeeds, reverts, burns all gas, or reenters the hub
contract CallbackMerchant is IPaymentCallback {
  enum Mode {
    Ok,
    Revert,
    BurnGas,
    Reenter,
    WithdrawFromCaller
  }

  uint256 internal constant _REENTRANT_CALLS = 5;

  Mode public mode;
  bytes32 public lastPaymentId;
  address public lastToken;
  uint256 public lastAmount;
  uint256 public reentrantGuarded;

  IPaymentHub internal _hub;
  Id internal _lane;

  function configure(Mode _mode, IPaymentHub _target, Id _targetLane) external {
    mode = _mode;
    _hub = _target;
    _lane = _targetLane;
  }

  function onPaymentSettled(bytes32 _paymentId, address _token, uint256 _amount) external {
    if (mode == Mode.Revert) revert('callback failed');
    if (mode == Mode.BurnGas) {
      while (true) { }
    }
    if (mode == Mode.Reenter) return _reenter(_paymentId, _token);
    if (mode == Mode.WithdrawFromCaller) return _withdrawFromCaller();

    lastPaymentId = _paymentId;
    lastToken = _token;
    lastAmount = _amount;
  }

  function _withdrawFromCaller() internal {
    (bool _ok, bytes memory _ret) = msg.sender.call(abi.encodeWithSignature('withdraw()'));
    if (!_ok && bytes4(_ret) == ReentrancyGuardTransient.ReentrancyGuardReentrantCall.selector) reentrantGuarded = 1;
  }

  function _reenter(bytes32 _paymentId, address _token) internal {
    bytes[5] memory _data = [
      abi.encodeCall(IPaymentHub.pay, (_lane, address(this), 1, block.timestamp + 1)),
      abi.encodeCall(IPaymentHub.settle, (_lane, _paymentId)),
      abi.encodeCall(IPaymentHub.dispatch, (_lane, _paymentId)),
      abi.encodeCall(IPaymentHub.refund, (_lane, _paymentId)),
      abi.encodeCall(IPaymentHub.withdraw, (_token))
    ];
    uint256 _guarded;
    for (uint256 _i; _i < _REENTRANT_CALLS; ++_i) {
      (bool _ok, bytes memory _ret) = address(_hub).call(_data[_i]);
      if (!_ok && _ret.length >= 4 && bytes4(_ret) == ReentrancyGuardTransient.ReentrancyGuardReentrantCall.selector) {
        _guarded |= 1 << _i;
      }
    }
    reentrantGuarded = _guarded;
  }
}
