// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable, Ownable2Step } from '@openzeppelin/contracts/access/Ownable2Step.sol';
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import { ReentrancyGuardTransient } from '@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol';

import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { IERC20SendAndCallReceiver } from 'src/interfaces/external/icm/IERC20SendAndCallReceiver.sol';
import { PaymentCallbackLib } from 'src/libraries/PaymentCallbackLib.sol';
import { PaymentStateLib } from 'src/libraries/PaymentStateLib.sol';

/// @title SettlementReceiver
/// @notice The L1 ICTT receiver that validates the source and records each payment once
contract SettlementReceiver is ISettlementReceiver, IERC20SendAndCallReceiver, Ownable2Step, ReentrancyGuardTransient {
  using SafeERC20 for IERC20;

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

  /// @notice Merchants whose payments settle
  mapping(address _merchant => bool _allowed) internal _allowlist;

  /// @notice Credited balance by merchant, the sum of which the receiver holds
  mapping(address _merchant => uint256 _credit) internal _credits;

  /// @param _transferrer The local token transferrer allowed to deliver
  /// @param _sourceBlockchainId The only accepted source blockchain
  /// @param _originTransferrer The only accepted origin token transferrer
  /// @param _originSender The only accepted origin sender, the messenger
  /// @param _token The only accepted token
  /// @param _owner The owner, who only manages the merchant allowlist
  constructor(
    address _transferrer,
    bytes32 _sourceBlockchainId,
    address _originTransferrer,
    address _originSender,
    address _token,
    address _owner
  )
    Ownable(_owner)
  {
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
    nonReentrant
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

    (bytes32 _paymentId, address _merchant) = _decode(_payload);
    _transition(_paymentId, Status.None, Status.Received);

    if (!_allowlist[_merchant]) return _transition(_paymentId, Status.Received, Status.Rejected);
    IERC20(TOKEN).safeTransferFrom(msg.sender, address(this), _amount);
    _credits[_merchant] += _amount;
    _transition(_paymentId, Status.Received, Status.Settled);

    if (PaymentCallbackLib.hasCallback(_merchant)) {
      if (!PaymentCallbackLib.canFund()) revert SettlementReceiver_InsufficientCallbackGas();
      if (!PaymentCallbackLib.notify(_merchant, _paymentId, TOKEN, _amount)) {
        emit CallbackFailed(_paymentId, _merchant);
      }
    }
  }

  /// @inheritdoc ISettlementReceiver
  function withdraw() external nonReentrant {
    uint256 _credit = _credits[msg.sender];
    if (_credit == 0) revert SettlementReceiver_ZeroAmount();
    _credits[msg.sender] = 0;
    IERC20(TOKEN).safeTransfer(msg.sender, _credit);
    emit Withdrawn(msg.sender, _credit);
  }

  /// @inheritdoc ISettlementReceiver
  function setMerchant(address _merchant, bool _allowed) external onlyOwner {
    if (_merchant == address(0)) revert SettlementReceiver_ZeroAddress();
    _allowlist[_merchant] = _allowed;
    emit MerchantSet(_merchant, _allowed);
  }

  /// @inheritdoc ISettlementReceiver
  function creditOf(address _merchant) external view returns (uint256 _credit) {
    _credit = _credits[_merchant];
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
