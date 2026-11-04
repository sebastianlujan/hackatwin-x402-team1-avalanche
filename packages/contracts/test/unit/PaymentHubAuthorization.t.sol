// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Nonces } from '@openzeppelin/contracts/utils/Nonces.sol';
import { Test } from 'forge-std/Test.sol';

import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';
import { Erc1271Wallet } from 'test/utils/Erc1271Wallet.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract UnitPaymentHubAuthorization is Test {
  bytes32 internal constant _TYPEHASH = keccak256(
    'Authorization(address authorizer,address authorized,address token,uint256 budget,uint256 nonce,uint256 deadline)'
  );
  bytes32 internal constant _DOMAIN_TYPEHASH =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');

  address internal _authorizer;
  uint256 internal _authorizerKey;
  address internal _broker = makeAddr('broker');
  address internal _token = makeAddr('token');
  address internal _relayer = makeAddr('relayer');

  PaymentHubHarness internal _hub;

  function setUp() external {
    (_authorizer, _authorizerKey) = makeAddrAndKey('authorizer');
    _hub = new PaymentHubHarness(address(this));
    vm.warp(1_000_000);
  }

  modifier whenAnyoneSubmitsAnAuthorization() {
    _;
  }

  function test_GivenAValidEOASignatureBeforeTheDeadline() external whenAnyoneSubmitsAnAuthorization {
    // it sets the budget, increments the nonce and emits AuthorizationSet
    IPaymentHub.Authorization memory _auth = _authorization(_authorizer, 10, 0, block.timestamp + 1 hours);
    bytes memory _signature = _sign(_authorizerKey, _digest(_auth, block.chainid, address(_hub)));

    vm.expectEmit(true, true, false, true, address(_hub));
    emit IPaymentHub.AuthorizationSet(_authorizer, _broker, _token, 10);
    vm.prank(_relayer);
    _hub.setAuthorizationWithSig(_auth, _signature);

    assertEq(_hub.exposed_budget(_authorizer, _broker, _token), 10);
    assertEq(_hub.nonces(_authorizer), 1);
  }

  function test_GivenAValidSignatureThatReplacesAnEarlierBudget() external whenAnyoneSubmitsAnAuthorization {
    // it replaces the budget with the new value
    IPaymentHub.Authorization memory _first = _authorization(_authorizer, 10, 0, block.timestamp + 1 hours);
    _hub.setAuthorizationWithSig(_first, _sign(_authorizerKey, _digest(_first, block.chainid, address(_hub))));
    IPaymentHub.Authorization memory _second = _authorization(_authorizer, 3, 1, block.timestamp + 1 hours);
    _hub.setAuthorizationWithSig(_second, _sign(_authorizerKey, _digest(_second, block.chainid, address(_hub))));

    assertEq(_hub.exposed_budget(_authorizer, _broker, _token), 3);
    assertEq(_hub.nonces(_authorizer), 2);
  }

  function test_GivenTheDeadlineEqualsTheCurrentTimestamp() external whenAnyoneSubmitsAnAuthorization {
    // it sets the budget
    IPaymentHub.Authorization memory _auth = _authorization(_authorizer, 7, 0, block.timestamp);
    _hub.setAuthorizationWithSig(_auth, _sign(_authorizerKey, _digest(_auth, block.chainid, address(_hub))));
    assertEq(_hub.exposed_budget(_authorizer, _broker, _token), 7);
  }

  function test_GivenAContractWalletThatApprovesTheDigest() external whenAnyoneSubmitsAnAuthorization {
    // it sets the budget
    Erc1271Wallet _wallet = new Erc1271Wallet();
    IPaymentHub.Authorization memory _auth = _authorization(address(_wallet), 25, 0, block.timestamp + 1 hours);
    _wallet.approve(_digest(_auth, block.chainid, address(_hub)));

    _hub.setAuthorizationWithSig(_auth, hex'1234');

    assertEq(_hub.exposed_budget(address(_wallet), _broker, _token), 25);
    assertEq(_hub.nonces(address(_wallet)), 1);
  }

  function test_GivenAContractWalletThatRejectsTheDigest() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_InvalidSignature
    Erc1271Wallet _wallet = new Erc1271Wallet();
    IPaymentHub.Authorization memory _auth = _authorization(address(_wallet), 25, 0, block.timestamp + 1 hours);

    vm.expectRevert(IPaymentHub.PaymentHub_InvalidSignature.selector);
    _hub.setAuthorizationWithSig(_auth, hex'1234');
    assertEq(_hub.exposed_budget(address(_wallet), _broker, _token), 0);
  }

  function test_GivenASignatureByAnotherAccount() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_InvalidSignature
    (, uint256 _otherKey) = makeAddrAndKey('other');
    IPaymentHub.Authorization memory _auth = _authorization(_authorizer, 10, 0, block.timestamp + 1 hours);

    vm.expectRevert(IPaymentHub.PaymentHub_InvalidSignature.selector);
    _hub.setAuthorizationWithSig(_auth, _sign(_otherKey, _digest(_auth, block.chainid, address(_hub))));
  }

  function test_GivenASignatureThatWasAlreadyUsed() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with InvalidAccountNonce and keeps the budget
    IPaymentHub.Authorization memory _auth = _authorization(_authorizer, 10, 0, block.timestamp + 1 hours);
    bytes memory _signature = _sign(_authorizerKey, _digest(_auth, block.chainid, address(_hub)));
    _hub.setAuthorizationWithSig(_auth, _signature);

    vm.expectRevert(abi.encodeWithSelector(Nonces.InvalidAccountNonce.selector, _authorizer, 1));
    _hub.setAuthorizationWithSig(_auth, _signature);
    assertEq(_hub.exposed_budget(_authorizer, _broker, _token), 10);
  }

  function test_GivenANonceThatIsNotTheCurrentOne() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with InvalidAccountNonce
    IPaymentHub.Authorization memory _auth = _authorization(_authorizer, 10, 5, block.timestamp + 1 hours);
    bytes memory _signature = _sign(_authorizerKey, _digest(_auth, block.chainid, address(_hub)));

    vm.expectRevert(abi.encodeWithSelector(Nonces.InvalidAccountNonce.selector, _authorizer, 0));
    _hub.setAuthorizationWithSig(_auth, _signature);
  }

  function test_GivenASignaturePastItsDeadline() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_SignatureExpired
    IPaymentHub.Authorization memory _auth = _authorization(_authorizer, 10, 0, block.timestamp - 1);
    bytes memory _signature = _sign(_authorizerKey, _digest(_auth, block.chainid, address(_hub)));

    vm.expectRevert(IPaymentHub.PaymentHub_SignatureExpired.selector);
    _hub.setAuthorizationWithSig(_auth, _signature);
  }

  function test_GivenASignatureForAnotherChainId() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_InvalidSignature
    IPaymentHub.Authorization memory _auth = _authorization(_authorizer, 10, 0, block.timestamp + 1 hours);
    bytes memory _signature = _sign(_authorizerKey, _digest(_auth, block.chainid + 1, address(_hub)));

    vm.expectRevert(IPaymentHub.PaymentHub_InvalidSignature.selector);
    _hub.setAuthorizationWithSig(_auth, _signature);
  }

  function test_GivenASignatureForAnotherHubAddress() external whenAnyoneSubmitsAnAuthorization {
    // it reverts with PaymentHub_InvalidSignature
    IPaymentHub.Authorization memory _auth = _authorization(_authorizer, 10, 0, block.timestamp + 1 hours);
    bytes memory _signature = _sign(_authorizerKey, _digest(_auth, block.chainid, makeAddr('otherHub')));

    vm.expectRevert(IPaymentHub.PaymentHub_InvalidSignature.selector);
    _hub.setAuthorizationWithSig(_auth, _signature);
  }

  function _authorization(
    address _from,
    uint256 _budget,
    uint256 _nonce,
    uint256 _deadline
  )
    internal
    view
    returns (IPaymentHub.Authorization memory _auth)
  {
    _auth = IPaymentHub.Authorization({
      authorizer: _from, authorized: _broker, token: _token, budget: _budget, nonce: _nonce, deadline: _deadline
    });
  }

  function _digest(
    IPaymentHub.Authorization memory _auth,
    uint256 _chainId,
    address _verifier
  )
    internal
    pure
    returns (bytes32 _hash)
  {
    bytes32 _domain =
      keccak256(abi.encode(_DOMAIN_TYPEHASH, keccak256('PaymentHub'), keccak256('1'), _chainId, _verifier));
    bytes32 _struct = keccak256(
      abi.encode(_TYPEHASH, _auth.authorizer, _auth.authorized, _auth.token, _auth.budget, _auth.nonce, _auth.deadline)
    );
    _hash = keccak256(abi.encodePacked('\x19\x01', _domain, _struct));
  }

  function _sign(uint256 _key, bytes32 _hash) internal pure returns (bytes memory _signature) {
    (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(_key, _hash);
    _signature = abi.encodePacked(_r, _s, _v);
  }
}
