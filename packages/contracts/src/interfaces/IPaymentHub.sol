// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Lane identifier, the keccak256 of the encoded lane params
type Id is bytes32;

/// @title IPaymentHub
/// @notice Escrowed payments settled locally or dispatched cross-chain through one state machine
interface IPaymentHub {
  /// @notice Payment states; None is the default for an unknown payment
  enum Status {
    None,
    Pending,
    Settled,
    Dispatched,
    Refunded
  }

  /// @notice Parameters that identify a lane
  struct LaneParams {
    address token;
    address merchant;
    address messenger;
    bytes32 destination;
  }

  /// @notice A signed spending budget for one authorized caller and token
  struct Authorization {
    address authorizer;
    address authorized;
    address token;
    uint256 budget;
    uint256 nonce;
    uint256 deadline;
  }

  /// @notice A messenger plug-in was enabled
  /// @param _messenger The enabled messenger
  event MessengerEnabled(address indexed _messenger);

  /// @notice A lane was created
  /// @param _id The lane id
  /// @param _params The lane params
  event LaneCreated(Id indexed _id, LaneParams _params);

  /// @notice A budget authorization was set
  /// @param _authorizer The authorizing account
  /// @param _authorized The authorized caller
  /// @param _token The token the budget covers
  /// @param _budget The new remaining budget
  event AuthorizationSet(address indexed _authorizer, address indexed _authorized, address _token, uint256 _budget);

  /// @notice A payment changed status
  /// @param _id The lane id
  /// @param _paymentId The payment id
  /// @param _from The previous status
  /// @param _to The new status
  event StatusChanged(Id indexed _id, bytes32 indexed _paymentId, Status _from, Status _to);

  /// @notice A merchant withdrew its credited balance
  /// @param _token The withdrawn token
  /// @param _merchant The withdrawing merchant
  /// @param _amount The withdrawn amount
  event Withdrawn(address indexed _token, address indexed _merchant, uint256 _amount);

  /// @notice The merchant callback failed after a settlement, which is not reverted
  /// @param _paymentId The settled payment
  /// @param _merchant The merchant whose callback failed
  event CallbackFailed(bytes32 indexed _paymentId, address indexed _merchant);

  /// @notice The stored status differs from the expected one, or the edge is not in the table
  /// @param _current The stored status
  /// @param _to The requested status
  error PaymentHub_InvalidTransition(Status _current, Status _to);

  /// @notice The lane names a messenger the owner never enabled
  /// @param _messenger The messenger
  error PaymentHub_MessengerNotEnabled(address _messenger);

  /// @notice No lane exists for the id
  /// @param _id The lane id
  error PaymentHub_LaneNotFound(Id _id);

  /// @notice The caller is neither the payer nor authorized by it
  /// @param _caller The caller
  error PaymentHub_Unauthorized(address _caller);

  /// @notice The amount exceeds the remaining authorization budget
  /// @param _remaining The remaining budget
  /// @param _amount The requested amount
  error PaymentHub_BudgetExceeded(uint256 _remaining, uint256 _amount);

  /// @notice The signature is not valid for the authorizer and domain
  error PaymentHub_InvalidSignature();

  /// @notice The authorization deadline has passed
  error PaymentHub_SignatureExpired();

  /// @notice The payment deadline has not passed yet
  error PaymentHub_DeadlineNotReached();

  /// @notice The payment deadline has passed
  error PaymentHub_DeadlinePassed();

  /// @notice The amount, or the escrowed balance delta, is zero
  error PaymentHub_ZeroAmount();

  /// @notice A token or merchant address is zero
  error PaymentHub_ZeroAddress();

  /// @notice The lane shape is invalid for its messenger and destination
  error PaymentHub_InvalidLane();

  /// @notice The lane already exists
  error PaymentHub_LaneExists();

  /// @notice The payment deadline is not in the future
  error PaymentHub_InvalidDeadline();

  /// @notice The call does not match the lane kind (local or cross-chain)
  error PaymentHub_WrongLaneKind();

  /// @notice The messenger left part of the approved allowance unspent
  /// @param _remaining The allowance left
  error PaymentHub_AllowanceNotConsumed(uint256 _remaining);

  /// @notice The call carries too little gas to fund the full callback cap
  error PaymentHub_InsufficientCallbackGas();

  /// @notice Enable a messenger plug-in for lanes
  /// @param _messenger The messenger to enable
  function enableMessenger(address _messenger) external;

  /// @notice Create a lane
  /// @param _params The lane params
  /// @return _id The lane id
  function createLane(LaneParams calldata _params) external returns (Id _id);

  /// @notice Set a budget with an EIP-712 signature (EOA or ERC-1271)
  /// @param _authorization The signed authorization
  /// @param _signature The signature
  function setAuthorizationWithSig(Authorization calldata _authorization, bytes calldata _signature) external;

  /// @notice Escrow a payment, None to Pending
  /// @param _id The lane id
  /// @param _onBehalf The payer
  /// @param _amount The amount to escrow
  /// @param _deadline The payment deadline
  /// @return _paymentId The new payment id
  function pay(Id _id, address _onBehalf, uint256 _amount, uint256 _deadline) external returns (bytes32 _paymentId);

  /// @notice Settle a local payment, Pending to Settled
  /// @param _id The lane id
  /// @param _paymentId The payment id
  function settle(Id _id, bytes32 _paymentId) external;

  /// @notice Dispatch a cross-chain payment, Pending to Dispatched
  /// @param _id The lane id
  /// @param _paymentId The payment id
  function dispatch(Id _id, bytes32 _paymentId) external;

  /// @notice Refund an expired payment to its payer, Pending to Refunded
  /// @param _id The lane id
  /// @param _paymentId The payment id
  function refund(Id _id, bytes32 _paymentId) external;

  /// @notice Withdraw the caller's credited balance of a token
  /// @param _token The token to withdraw
  function withdraw(address _token) external;

  /// @notice Read a payment status
  /// @param _id The lane id
  /// @param _paymentId The payment id
  /// @return _status The status, None for an unknown payment
  function statusOf(Id _id, bytes32 _paymentId) external view returns (Status _status);
}
