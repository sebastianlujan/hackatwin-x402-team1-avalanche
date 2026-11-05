// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Id } from 'src/interfaces/IPaymentHub.sol';
import { IERC20TokenTransferrer } from 'src/interfaces/external/icm/IERC20TokenTransferrer.sol';

/// @title IIcttMessenger
/// @notice Hub plug-in that sends a dispatched payment to the L1 with ICTT sendAndCall
interface IIcttMessenger {
  /// @notice A payment was handed to the token transferrer
  /// @param _id The lane id
  /// @param _paymentId The payment id
  /// @param _merchant The merchant the payment is for
  /// @param _amount The amount sent
  event PaymentSent(Id indexed _id, bytes32 indexed _paymentId, address _merchant, uint256 _amount);

  /// @notice The caller is not the hub
  /// @param _caller The caller
  error IcttMessenger_OnlyHub(address _caller);

  /// @notice The lane destination is not the configured one
  /// @param _destination The lane destination
  error IcttMessenger_DestinationMismatch(bytes32 _destination);

  /// @notice The lane token is not the bound token
  /// @param _token The lane token
  error IcttMessenger_TokenMismatch(address _token);

  /// @notice The amount is zero
  error IcttMessenger_ZeroAmount();

  /// @notice A constructor address is zero
  error IcttMessenger_ZeroAddress();

  /// @notice The destination blockchain id is zero
  error IcttMessenger_ZeroBlockchainId();

  /// @notice A gas limit is zero or the recipient limit is not below the required limit
  /// @param _requiredGasLimit The required gas limit
  /// @param _recipientGasLimit The recipient gas limit
  error IcttMessenger_InvalidGasLimits(uint256 _requiredGasLimit, uint256 _recipientGasLimit);

  /// @notice The hub, the only caller of send
  /// @return _hub The hub
  function HUB() external view returns (address _hub);

  /// @notice The ICTT token transferrer the messenger calls
  /// @return _transferrer The transferrer
  function TRANSFERRER() external view returns (IERC20TokenTransferrer _transferrer);

  /// @notice The only token the messenger sends
  /// @return _token The token
  function TOKEN() external view returns (address _token);

  /// @notice The destination blockchain id
  /// @return _id The blockchain id
  function DESTINATION_BLOCKCHAIN_ID() external view returns (bytes32 _id);

  /// @notice The token transferrer on the destination chain
  /// @return _transferrer The destination transferrer
  function DESTINATION_TRANSFERRER() external view returns (address _transferrer);

  /// @notice The contract called with the tokens on the destination chain
  /// @return _receiver The receiver
  function RECEIVER() external view returns (address _receiver);

  /// @notice The gas the relayer must supply for the whole delivery
  /// @return _limit The required gas limit
  function REQUIRED_GAS_LIMIT() external view returns (uint256 _limit);

  /// @notice The gas forwarded to the receiver call
  /// @return _limit The recipient gas limit
  function RECIPIENT_GAS_LIMIT() external view returns (uint256 _limit);

  /// @notice The account that receives the tokens when the delivery fails or is not pulled
  /// @return _recipient The fallback recipient
  function FALLBACK_RECIPIENT() external view returns (address _recipient);
}
