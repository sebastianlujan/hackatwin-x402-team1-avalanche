// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable, Ownable2Step } from '@openzeppelin/contracts/access/Ownable2Step.sol';
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import { Nonces } from '@openzeppelin/contracts/utils/Nonces.sol';
import { ReentrancyGuardTransient } from '@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol';
import { EIP712 } from '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import { SignatureChecker } from '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';
import { SafeCast } from '@openzeppelin/contracts/utils/math/SafeCast.sol';

import { IMessenger } from 'src/interfaces/IMessenger.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { LaneParamsLib } from 'src/libraries/LaneParamsLib.sol';
import { PaymentCallbackLib } from 'src/libraries/PaymentCallbackLib.sol';
import { PaymentStateLib } from 'src/libraries/PaymentStateLib.sol';

/// @title PaymentHub
/// @notice Singleton hub of permissionless lanes and escrowed payments behind one state machine
contract PaymentHub is IPaymentHub, Ownable2Step, EIP712, Nonces, ReentrancyGuardTransient {
  using SafeERC20 for IERC20;

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

  /// @notice The number of payments created, which feeds the payment id
  uint256 internal _count;

  /// @notice Credited merchant balance by token and merchant, withdrawn by the merchant
  mapping(address _token => mapping(address _merchant => uint256 _credit)) internal _credits;

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
  function pay(
    Id _id,
    address _onBehalf,
    uint256 _amount,
    uint256 _deadline
  )
    external
    nonReentrant
    returns (bytes32 _paymentId)
  {
    address _token = _lanes[_id].token;
    if (_token == address(0)) revert PaymentHub_LaneNotFound(_id);
    if (_amount == 0) revert PaymentHub_ZeroAmount();
    if (_deadline <= block.timestamp) revert PaymentHub_InvalidDeadline();
    if (msg.sender != _onBehalf) _spendBudget(_onBehalf, _token, _amount);

    _paymentId = keccak256(abi.encode(block.chainid, address(this), ++_count));
    uint256 _before = IERC20(_token).balanceOf(address(this));
    IERC20(_token).safeTransferFrom(_onBehalf, address(this), _amount);
    uint256 _escrow = IERC20(_token).balanceOf(address(this)) - _before;
    if (_escrow == 0) revert PaymentHub_ZeroAmount();

    Payment storage _payment = _payments[_id][_paymentId];
    _payment.payer = _onBehalf;
    _payment.deadline = SafeCast.toUint64(_deadline);
    _payment.amount = _escrow;
    _transition(_id, _paymentId, Status.None, Status.Pending);
  }

  /// @inheritdoc IPaymentHub
  function dispatch(Id _id, bytes32 _paymentId) external nonReentrant {
    _transition(_id, _paymentId, Status.Pending, Status.Dispatched);

    LaneParams memory _lane = _lanes[_id];
    if (_lane.messenger == address(0)) revert PaymentHub_WrongLaneKind();
    Payment storage _payment = _payments[_id][_paymentId];
    if (block.timestamp > _payment.deadline) revert PaymentHub_DeadlinePassed();

    uint256 _escrow = _payment.amount;
    _payment.amount = 0;
    IERC20 _token = IERC20(_lane.token);
    _token.forceApprove(_lane.messenger, _escrow);
    IMessenger(_lane.messenger).send(_id, _paymentId, _lane, _escrow);

    uint256 _remaining = _token.allowance(address(this), _lane.messenger);
    if (_remaining != 0) revert PaymentHub_AllowanceNotConsumed(_remaining);
  }

  /// @inheritdoc IPaymentHub
  function refund(Id _id, bytes32 _paymentId) external nonReentrant {
    _transition(_id, _paymentId, Status.Pending, Status.Refunded);

    Payment storage _payment = _payments[_id][_paymentId];
    if (block.timestamp <= _payment.deadline) revert PaymentHub_DeadlineNotReached();

    address _payer = _payment.payer;
    uint256 _escrow = _payment.amount;
    _payment.amount = 0;
    IERC20(_lanes[_id].token).safeTransfer(_payer, _escrow);
  }

  /// @inheritdoc IPaymentHub
  function settle(Id _id, bytes32 _paymentId) external nonReentrant {
    _transition(_id, _paymentId, Status.Pending, Status.Settled);

    LaneParams storage _lane = _lanes[_id];
    if (_lane.messenger != address(0)) revert PaymentHub_WrongLaneKind();
    Payment storage _payment = _payments[_id][_paymentId];
    if (block.timestamp > _payment.deadline) revert PaymentHub_DeadlinePassed();

    uint256 _escrow = _payment.amount;
    _payment.amount = 0;
    _credits[_lane.token][_lane.merchant] += _escrow;

    address _merchant = _lane.merchant;
    if (PaymentCallbackLib.hasCallback(_merchant)) {
      if (!PaymentCallbackLib.canFund()) revert PaymentHub_InsufficientCallbackGas();
      if (!PaymentCallbackLib.notify(_merchant, _paymentId, _lane.token, _escrow)) {
        emit CallbackFailed(_paymentId, _merchant);
      }
    }
  }

  /// @inheritdoc IPaymentHub
  function withdraw(address _token) external nonReentrant {
    uint256 _credit = _credits[_token][msg.sender];
    if (_credit == 0) revert PaymentHub_ZeroAmount();
    _credits[_token][msg.sender] = 0;
    IERC20(_token).safeTransfer(msg.sender, _credit);
    emit Withdrawn(_token, msg.sender, _credit);
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

  /// @notice Reduce the budget the caller holds from a payer, which is never restored
  /// @param _payer The authorizing account
  /// @param _token The lane token
  /// @param _amount The amount to spend
  function _spendBudget(address _payer, address _token, uint256 _amount) internal {
    uint256 _remaining = _budgets[_payer][msg.sender][_token];
    if (_remaining == 0) revert PaymentHub_Unauthorized(msg.sender);
    if (_amount > _remaining) revert PaymentHub_BudgetExceeded(_remaining, _amount);
    _budgets[_payer][msg.sender][_token] = _remaining - _amount;
  }
}
