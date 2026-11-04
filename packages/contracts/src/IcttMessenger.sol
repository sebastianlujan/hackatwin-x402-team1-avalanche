// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import { IIcttMessenger } from 'src/interfaces/IIcttMessenger.sol';
import { IMessenger } from 'src/interfaces/IMessenger.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { IERC20TokenTransferrer, SendAndCallInput } from 'src/interfaces/external/icm/IERC20TokenTransferrer.sol';

/// @title IcttMessenger
/// @notice Hub plug-in that sends a dispatched payment to the L1 with ICTT sendAndCall
contract IcttMessenger is IIcttMessenger, IMessenger {
  using SafeERC20 for IERC20;

  /// @inheritdoc IIcttMessenger
  address public immutable HUB;

  /// @inheritdoc IIcttMessenger
  IERC20TokenTransferrer public immutable TRANSFERRER;

  /// @inheritdoc IIcttMessenger
  address public immutable TOKEN;

  /// @inheritdoc IIcttMessenger
  bytes32 public immutable DESTINATION_BLOCKCHAIN_ID;

  /// @inheritdoc IIcttMessenger
  address public immutable DESTINATION_TRANSFERRER;

  /// @inheritdoc IIcttMessenger
  address public immutable RECEIVER;

  /// @inheritdoc IIcttMessenger
  uint256 public immutable REQUIRED_GAS_LIMIT;

  /// @inheritdoc IIcttMessenger
  uint256 public immutable RECIPIENT_GAS_LIMIT;

  /// @inheritdoc IIcttMessenger
  address public immutable FALLBACK_RECIPIENT;

  /// @param _hub The hub, the only caller of send
  /// @param _transferrer The ICTT token transferrer on this chain
  /// @param _token The only token the messenger sends
  /// @param _destinationBlockchainId The destination blockchain id
  /// @param _destinationTransferrer The token transferrer on the destination chain
  /// @param _receiver The contract called with the tokens on the destination chain
  /// @param _requiredGasLimit The gas the relayer must supply for the whole delivery
  /// @param _recipientGasLimit The gas forwarded to the receiver call
  /// @param _fallbackRecipient The account that receives the tokens when the delivery fails
  constructor(
    address _hub,
    IERC20TokenTransferrer _transferrer,
    address _token,
    bytes32 _destinationBlockchainId,
    address _destinationTransferrer,
    address _receiver,
    uint256 _requiredGasLimit,
    uint256 _recipientGasLimit,
    address _fallbackRecipient
  ) {
    if (
      _hub == address(0) || address(_transferrer) == address(0) || _token == address(0)
        || _destinationTransferrer == address(0) || _receiver == address(0) || _fallbackRecipient == address(0)
    ) revert IcttMessenger_ZeroAddress();
    if (_destinationBlockchainId == bytes32(0)) revert IcttMessenger_ZeroBlockchainId();
    if (_requiredGasLimit == 0 || _recipientGasLimit == 0 || _recipientGasLimit >= _requiredGasLimit) {
      revert IcttMessenger_InvalidGasLimits(_requiredGasLimit, _recipientGasLimit);
    }

    HUB = _hub;
    TRANSFERRER = _transferrer;
    TOKEN = _token;
    DESTINATION_BLOCKCHAIN_ID = _destinationBlockchainId;
    DESTINATION_TRANSFERRER = _destinationTransferrer;
    RECEIVER = _receiver;
    REQUIRED_GAS_LIMIT = _requiredGasLimit;
    RECIPIENT_GAS_LIMIT = _recipientGasLimit;
    FALLBACK_RECIPIENT = _fallbackRecipient;
  }

  /// @inheritdoc IMessenger
  function send(Id _id, bytes32 _paymentId, IPaymentHub.LaneParams calldata _lane, uint256 _amount) external {
    if (msg.sender != HUB) revert IcttMessenger_OnlyHub(msg.sender);
    if (_lane.destination != DESTINATION_BLOCKCHAIN_ID) revert IcttMessenger_DestinationMismatch(_lane.destination);
    if (_lane.token != TOKEN) revert IcttMessenger_TokenMismatch(_lane.token);
    if (_amount == 0) revert IcttMessenger_ZeroAmount();

    IERC20(TOKEN).safeTransferFrom(HUB, address(this), _amount);
    IERC20(TOKEN).forceApprove(address(TRANSFERRER), _amount);
    TRANSFERRER.sendAndCall(
      SendAndCallInput({
        destinationBlockchainID: DESTINATION_BLOCKCHAIN_ID,
        destinationTokenTransferrerAddress: DESTINATION_TRANSFERRER,
        recipientContract: RECEIVER,
        recipientPayload: abi.encode(_paymentId, _lane.merchant),
        requiredGasLimit: REQUIRED_GAS_LIMIT,
        recipientGasLimit: RECIPIENT_GAS_LIMIT,
        multiHopFallback: address(0),
        fallbackRecipient: FALLBACK_RECIPIENT,
        primaryFeeTokenAddress: address(0),
        primaryFee: 0,
        secondaryFee: 0
      }),
      _amount
    );
    emit PaymentSent(_id, _paymentId, _lane.merchant, _amount);
  }
}
