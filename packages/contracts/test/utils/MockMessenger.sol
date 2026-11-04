// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import { IMessenger } from 'src/interfaces/IMessenger.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';

/// @notice A messenger that pulls the whole amount, pulls one unit less, or reverts
contract MockMessenger is IMessenger {
  enum Mode {
    Pull,
    PullShort,
    Revert
  }

  Mode public mode;
  Id public lastId;
  bytes32 public lastPaymentId;
  address public lastToken;
  address public lastMerchant;
  bytes32 public lastDestination;
  uint256 public lastAmount;

  function setMode(Mode _mode) external {
    mode = _mode;
  }

  function send(Id _id, bytes32 _paymentId, IPaymentHub.LaneParams calldata _lane, uint256 _amount) external {
    if (mode == Mode.Revert) revert('send failed');
    lastId = _id;
    lastPaymentId = _paymentId;
    lastToken = _lane.token;
    lastMerchant = _lane.merchant;
    lastDestination = _lane.destination;
    lastAmount = _amount;
    uint256 _pulled = mode == Mode.PullShort ? _amount - 1 : _amount;
    IERC20(_lane.token).transferFrom(msg.sender, address(this), _pulled);
  }
}
