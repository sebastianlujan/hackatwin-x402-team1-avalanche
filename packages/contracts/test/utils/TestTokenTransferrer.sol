// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import { IERC20SendAndCallReceiver } from 'src/interfaces/external/icm/IERC20SendAndCallReceiver.sol';
import { IERC20TokenTransferrer, SendAndCallInput } from 'src/interfaces/external/icm/IERC20TokenTransferrer.sol';

/// @notice An ICTT transferrer double: pulls the amount, records the input, delivers to a receiver and sweeps unused allowance
contract TestTokenTransferrer is IERC20TokenTransferrer {
  enum Mode {
    Pull,
    Revert
  }

  IERC20 public immutable TOKEN;
  Mode public mode;
  bytes internal _recorded;

  constructor(IERC20 _token) {
    TOKEN = _token;
  }

  function setMode(Mode _mode) external {
    mode = _mode;
  }

  function sendAndCall(SendAndCallInput calldata _input, uint256 _amount) external {
    if (mode == Mode.Revert) revert('transferrer failed');
    TOKEN.transferFrom(msg.sender, address(this), _amount);
    uint256 _unused = TOKEN.allowance(msg.sender, address(this));
    if (_unused != 0) TOKEN.transferFrom(msg.sender, _input.fallbackRecipient, _unused);
    _recorded = abi.encode(_input);
  }

  // Mirrors the remote side: approve the receiver, call it, then send whatever it did not pull to the fallback
  function deliver(
    IERC20SendAndCallReceiver _receiver,
    bytes32 _source,
    address _originTransferrer,
    address _originSender,
    uint256 _amount,
    bytes calldata _payload,
    address _fallbackRecipient
  )
    external
    returns (bool _ok)
  {
    TOKEN.approve(address(_receiver), _amount);
    try _receiver.receiveTokens(_source, _originTransferrer, _originSender, address(TOKEN), _amount, _payload) {
      _ok = true;
    } catch { }
    uint256 _unused = TOKEN.allowance(address(this), address(_receiver));
    TOKEN.approve(address(_receiver), 0);
    if (_unused != 0) TOKEN.transfer(_fallbackRecipient, _unused);
  }

  function recorded() external view returns (SendAndCallInput memory _input) {
    _input = abi.decode(_recorded, (SendAndCallInput));
  }
}
