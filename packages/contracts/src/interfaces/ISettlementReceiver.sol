// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title ISettlementReceiver
/// @notice The L1 ICTT receiver that records Received then Settled or Rejected per payment
interface ISettlementReceiver {
  /// @notice Receiver payment states; None is the default for an unknown payment
  enum Status {
    None,
    Received,
    Settled,
    Rejected
  }

  /// @notice A payment changed status
  /// @param _paymentId The payment id
  /// @param _from The previous status
  /// @param _to The new status
  event StatusChanged(bytes32 indexed _paymentId, Status _from, Status _to);

  /// @notice A merchant was added to or removed from the allowlist
  /// @param _merchant The merchant
  /// @param _allowed Whether the merchant is now allowed
  event MerchantSet(address indexed _merchant, bool _allowed);

  /// @notice A merchant withdrew its credit
  /// @param _merchant The merchant
  /// @param _amount The withdrawn amount
  event Withdrawn(address indexed _merchant, uint256 _amount);

  /// @notice A merchant callback failed, ran out of gas or reentered
  /// @param _paymentId The settled payment
  /// @param _merchant The merchant whose callback failed
  event CallbackFailed(bytes32 indexed _paymentId, address indexed _merchant);

  /// @notice The caller is not the configured token transferrer
  /// @param _caller The caller
  error SettlementReceiver_UnauthorizedCaller(address _caller);

  /// @notice The source blockchain is not the configured one
  /// @param _sourceBlockchainId The delivered source blockchain id
  error SettlementReceiver_InvalidSourceBlockchain(bytes32 _sourceBlockchainId);

  /// @notice The origin transferrer is not the configured one
  /// @param _originTransferrer The delivered origin transferrer
  error SettlementReceiver_InvalidOriginTransferrer(address _originTransferrer);

  /// @notice The origin sender is not the configured messenger
  /// @param _originSender The delivered origin sender
  error SettlementReceiver_InvalidOriginSender(address _originSender);

  /// @notice The delivered token is not the configured one
  /// @param _token The delivered token
  error SettlementReceiver_InvalidToken(address _token);

  /// @notice The merchant or a constructor address is the zero address
  error SettlementReceiver_ZeroAddress();

  /// @notice The delivered amount is zero
  error SettlementReceiver_ZeroAmount();

  /// @notice The payload is not 64 bytes of (payment id, merchant)
  error SettlementReceiver_InvalidPayload();

  /// @notice The remaining gas cannot fund the full merchant callback
  error SettlementReceiver_InsufficientCallbackGas();

  /// @notice The status change is not an edge of the state table
  /// @param _current The current status
  /// @param _to The requested status
  error SettlementReceiver_InvalidTransition(Status _current, Status _to);

  /// @notice The token transferrer allowed to deliver
  /// @return _transferrer The transferrer
  function TRANSFERRER() external view returns (address _transferrer);

  /// @notice The only accepted source blockchain
  /// @return _id The blockchain id
  function SOURCE_BLOCKCHAIN_ID() external view returns (bytes32 _id);

  /// @notice The only accepted origin token transferrer
  /// @return _transferrer The origin transferrer
  function ORIGIN_TRANSFERRER() external view returns (address _transferrer);

  /// @notice The only accepted origin sender, the messenger
  /// @return _sender The origin sender
  function ORIGIN_SENDER() external view returns (address _sender);

  /// @notice The only accepted token
  /// @return _token The token
  function TOKEN() external view returns (address _token);

  /// @notice The status of a payment
  /// @param _paymentId The payment id
  /// @return _status The status, None for an unknown payment
  function statusOf(bytes32 _paymentId) external view returns (Status _status);

  /// @notice Allow or disallow a merchant, owner only
  /// @param _merchant The merchant
  /// @param _allowed Whether payments for the merchant settle
  function setMerchant(address _merchant, bool _allowed) external;

  /// @notice The credited balance a merchant can withdraw
  /// @param _merchant The merchant
  /// @return _credit The credit
  function creditOf(address _merchant) external view returns (uint256 _credit);

  /// @notice Pull the caller's whole credit
  function withdraw() external;
}
