// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPaymentCallback } from 'src/interfaces/IPaymentCallback.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';

/// @notice A merchant whose callback succeeds, reverts, burns all gas, or reenters the hub
contract CallbackMerchant is IPaymentCallback {
  enum Mode {
    Ok,
    Revert,
    BurnGas,
    Reenter
  }

  uint256 internal constant _REENTRANT_CALLS = 5;

  Mode public mode;
  uint256 public calls;
  bytes32 public lastPaymentId;
  address public lastToken;
  uint256 public lastAmount;
  bool[5] public reentrantSucceeded;
  bytes4[5] public reentrantError;

  IPaymentHub internal _hub;
  Id internal _lane;

  function configure(Mode _mode, IPaymentHub _target, Id _targetLane) external {
    mode = _mode;
    _hub = _target;
    _lane = _targetLane;
  }

  function onPaymentSettled(bytes32 _paymentId, address _token, uint256 _amount) external {
    ++calls;
    lastPaymentId = _paymentId;
    lastToken = _token;
    lastAmount = _amount;

    if (mode == Mode.Revert) revert('callback failed');
    if (mode == Mode.BurnGas) {
      while (true) { }
    }
    if (mode == Mode.Reenter) _reenter(_paymentId, _token);
  }

  function _reenter(bytes32 _paymentId, address _token) internal {
    bytes[5] memory _data = [
      abi.encodeCall(IPaymentHub.pay, (_lane, address(this), 1, block.timestamp + 1)),
      abi.encodeCall(IPaymentHub.settle, (_lane, _paymentId)),
      abi.encodeCall(IPaymentHub.dispatch, (_lane, _paymentId)),
      abi.encodeCall(IPaymentHub.refund, (_lane, _paymentId)),
      abi.encodeCall(IPaymentHub.withdraw, (_token))
    ];
    for (uint256 _i; _i < _REENTRANT_CALLS; ++_i) {
      (bool _ok, bytes memory _ret) = address(_hub).call(_data[_i]);
      reentrantSucceeded[_i] = _ok;
      if (_ret.length >= 4) reentrantError[_i] = bytes4(_ret);
    }
  }
}
