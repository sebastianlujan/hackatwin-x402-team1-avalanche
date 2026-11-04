// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable, Ownable2Step } from '@openzeppelin/contracts/access/Ownable2Step.sol';
import { Nonces } from '@openzeppelin/contracts/utils/Nonces.sol';
import { EIP712 } from '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import { SignatureChecker } from '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { LaneParamsLib } from 'src/libraries/LaneParamsLib.sol';
import { PaymentStateLib } from 'src/libraries/PaymentStateLib.sol';

/// @title PaymentHub
/// @notice Singleton hub of permissionless lanes and escrowed payments behind one state machine
abstract contract PaymentHub is IPaymentHub, Ownable2Step, EIP712, Nonces {
  /// @notice A payment record packed into one slot, plus the escrowed amount
  struct Payment {
    address payer;
    uint64 deadline;
    Status status;
    uint256 amount;
  }

  /// @notice The EIP-712 type hash of an authorization
  bytes32 internal constant _AUTHORIZATION_TYPEHASH = keccak256(
    'Authorization(address authorizer,address authorized,address token,uint256 budget,uint256 nonce,uint256 deadline)'
  );

  /// @notice Remaining budget by authorizer, authorized caller and token
  mapping(address _authorizer => mapping(address _authorized => mapping(address _token => uint256 _budget))) internal
    _budgets;

  /// @notice Lane params by lane id; a lane exists when its token is set
  mapping(Id _id => LaneParams _params) internal _lanes;

  /// @notice Payments by lane id and payment id
  mapping(Id _id => mapping(bytes32 _paymentId => Payment _payment)) internal _payments;

  /// @notice Messengers the owner enabled
  mapping(address _messenger => bool _enabled) internal _messengerEnabled;

  /// @param _owner The initial owner, who can only enable messengers
  constructor(address _owner) Ownable(_owner) EIP712('PaymentHub', '1') { }

  /// @inheritdoc IPaymentHub
  function enableMessenger(address _messenger) external onlyOwner {
    if (_messenger == address(0)) revert PaymentHub_ZeroAddress();
    _messengerEnabled[_messenger] = true;
    emit MessengerEnabled(_messenger);
  }

  /// @inheritdoc IPaymentHub
  function createLane(LaneParams calldata _params) external returns (Id _id) {
    if (_params.token == address(0) || _params.merchant == address(0)) revert PaymentHub_ZeroAddress();
    if (_params.messenger == address(0)) {
      if (_params.destination != bytes32(0)) revert PaymentHub_InvalidLane();
    } else {
      if (!_messengerEnabled[_params.messenger]) revert PaymentHub_MessengerNotEnabled(_params.messenger);
      if (_params.destination == bytes32(0)) revert PaymentHub_InvalidLane();
    }

    _id = LaneParamsLib.id(_params);
    if (_lanes[_id].token != address(0)) revert PaymentHub_LaneExists();
    _lanes[_id] = _params;
    emit LaneCreated(_id, _params);
  }

  /// @inheritdoc IPaymentHub
  function setAuthorizationWithSig(Authorization calldata _authorization, bytes calldata _signature) external {
    if (block.timestamp > _authorization.deadline) revert PaymentHub_SignatureExpired();

    bytes32 _structHash = keccak256(
      abi.encode(
        _AUTHORIZATION_TYPEHASH,
        _authorization.authorizer,
        _authorization.authorized,
        _authorization.token,
        _authorization.budget,
        _authorization.nonce,
        _authorization.deadline
      )
    );
    if (!SignatureChecker.isValidSignatureNow(_authorization.authorizer, _hashTypedDataV4(_structHash), _signature)) {
      revert PaymentHub_InvalidSignature();
    }

    _useCheckedNonce(_authorization.authorizer, _authorization.nonce);
    _budgets[_authorization.authorizer][_authorization.authorized][_authorization.token] = _authorization.budget;
    emit AuthorizationSet(
      _authorization.authorizer, _authorization.authorized, _authorization.token, _authorization.budget
    );
  }

  /// @inheritdoc IPaymentHub
  function statusOf(Id _id, bytes32 _paymentId) external view returns (Status _status) {
    _status = _payments[_id][_paymentId].status;
  }

  /// @notice The single write path of the state machine
  /// @param _id The lane id
  /// @param _paymentId The payment id
  /// @param _from The status the payment must currently have
  /// @param _to The next status
  function _transition(Id _id, bytes32 _paymentId, Status _from, Status _to) internal {
    Payment storage _payment = _payments[_id][_paymentId];
    Status _current = _payment.status;
    if (_current != _from || !PaymentStateLib.canTransition(_from, _to)) {
      revert PaymentHub_InvalidTransition(_current, _to);
    }
    _payment.status = _to;
    emit StatusChanged(_id, _paymentId, _from, _to);
  }
}
