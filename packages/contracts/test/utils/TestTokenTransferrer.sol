// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import { IERC20TokenTransferrer, SendAndCallInput } from 'src/interfaces/external/icm/IERC20TokenTransferrer.sol';

/// @notice An ICTT transferrer double: pulls the amount, records the input and sweeps unused allowance to the fallback
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

  function recorded() external view returns (SendAndCallInput memory _input) {
    _input = abi.decode(_recorded, (SendAndCallInput));
  }
}
