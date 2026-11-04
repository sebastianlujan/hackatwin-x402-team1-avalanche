// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { IERC20SendAndCallReceiver } from 'src/interfaces/external/icm/IERC20SendAndCallReceiver.sol';
import { PaymentStateLib } from 'src/libraries/PaymentStateLib.sol';

/// @title SettlementReceiver
/// @notice The L1 ICTT receiver that validates the source and records each payment once
contract SettlementReceiver is ISettlementReceiver, IERC20SendAndCallReceiver {
  /// @inheritdoc ISettlementReceiver
  address public immutable TRANSFERRER;

  /// @inheritdoc ISettlementReceiver
  bytes32 public immutable SOURCE_BLOCKCHAIN_ID;

  /// @inheritdoc ISettlementReceiver
  address public immutable ORIGIN_TRANSFERRER;

  /// @inheritdoc ISettlementReceiver
  address public immutable ORIGIN_SENDER;

  /// @inheritdoc ISettlementReceiver
  address public immutable TOKEN;

  /// @notice Payment status by payment id
  mapping(bytes32 _paymentId => Status _status) internal _statuses;

  /// @param _transferrer The local token transferrer allowed to deliver
  /// @param _sourceBlockchainId The only accepted source blockchain
  /// @param _originTransferrer The only accepted origin token transferrer
  /// @param _originSender The only accepted origin sender, the messenger
  /// @param _token The only accepted token
  constructor(
    address _transferrer,
    bytes32 _sourceBlockchainId,
    address _originTransferrer,
    address _originSender,
    address _token
  ) {
    TRANSFERRER = _transferrer;
    SOURCE_BLOCKCHAIN_ID = _sourceBlockchainId;
    ORIGIN_TRANSFERRER = _originTransferrer;
    ORIGIN_SENDER = _originSender;
    TOKEN = _token;
  }

  /// @inheritdoc IERC20SendAndCallReceiver
  function receiveTokens(
    bytes32 _sourceBlockchainID,
    address _originTokenTransferrerAddress,
    address _originSenderAddress,
    address _token,
    uint256 _amount,
    bytes calldata _payload
  )
    external
  {
    if (msg.sender != TRANSFERRER) revert SettlementReceiver_UnauthorizedCaller(msg.sender);
    if (_sourceBlockchainID != SOURCE_BLOCKCHAIN_ID) {
      revert SettlementReceiver_InvalidSourceBlockchain(_sourceBlockchainID);
    }
    if (_originTokenTransferrerAddress != ORIGIN_TRANSFERRER) {
      revert SettlementReceiver_InvalidOriginTransferrer(_originTokenTransferrerAddress);
    }
    if (_originSenderAddress != ORIGIN_SENDER) revert SettlementReceiver_InvalidOriginSender(_originSenderAddress);
    if (_token != TOKEN) revert SettlementReceiver_InvalidToken(_token);
    if (_amount == 0) revert SettlementReceiver_ZeroAmount();

    (bytes32 _paymentId,) = _decode(_payload);
    _transition(_paymentId, Status.None, Status.Received);
  }

  /// @inheritdoc ISettlementReceiver
  function statusOf(bytes32 _paymentId) external view returns (Status _status) {
    _status = _statuses[_paymentId];
  }

  /// @notice Decode the 64 byte payload into the payment id and the merchant
  /// @param _payload The payload chosen by the sender
  /// @return _paymentId The payment id
  /// @return _merchant The merchant
  function _decode(bytes calldata _payload) internal pure returns (bytes32 _paymentId, address _merchant) {
    if (_payload.length != 64) revert SettlementReceiver_InvalidPayload();
    uint256 _word;
    (_paymentId, _word) = abi.decode(_payload, (bytes32, uint256));
    if (_word >> 160 != 0) revert SettlementReceiver_InvalidPayload();
    _merchant = address(uint160(_word));
  }

  /// @notice The single write path of the state machine
  /// @param _paymentId The payment id
  /// @param _from The status the payment must currently have
  /// @param _to The next status
  function _transition(bytes32 _paymentId, Status _from, Status _to) internal {
    Status _current = _statuses[_paymentId];
    if (_current != _from || !PaymentStateLib.canTransition(_from, _to)) {
      revert SettlementReceiver_InvalidTransition(_current, _to);
    }
    _statuses[_paymentId] = _to;
    emit StatusChanged(_paymentId, _from, _to);
  }
}
