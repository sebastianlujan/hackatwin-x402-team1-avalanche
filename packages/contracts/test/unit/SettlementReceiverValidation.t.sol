// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { SettlementReceiverHarness } from 'test/utils/SettlementReceiverHarness.sol';

contract UnitSettlementReceiverValidation is Test {
  bytes32 internal constant _SOURCE = keccak256('fuji');
  bytes32 internal constant _PAYMENT = keccak256('payment');

  address internal _transferrer = makeAddr('transferrer');
  address internal _originTransferrer = makeAddr('originTransferrer');
  address internal _originSender = makeAddr('originSender');
  address internal _token = makeAddr('token');
  address internal _merchant = makeAddr('merchant');

  SettlementReceiverHarness internal _receiver;

  function setUp() external {
    _receiver = new SettlementReceiverHarness(_transferrer, _SOURCE, _originTransferrer, _originSender, _token);
  }

  modifier whenTheTransferrerDeliversTokens() {
    _;
  }

  function test_GivenAllFiveSourceValuesMatch() external whenTheTransferrerDeliversTokens {
    // it continues to payload decoding
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_InvalidPayload.selector);
    _deliver(_transferrer, _SOURCE, _originTransferrer, _originSender, _token, 1, hex'00');

    _deliver(_transferrer, _SOURCE, _originTransferrer, _originSender, _token, 1, _payload());
    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.Received));
  }

  function test_GivenACallerOrSourceValueThatDiffersFromTheConfiguration() external whenTheTransferrerDeliversTokens {
    // it reverts with the named error and writes no status
    address _other = makeAddr('other');
    bytes32 _otherId = keccak256('other');
    bytes[5] memory _errors = [
      abi.encodeWithSelector(ISettlementReceiver.SettlementReceiver_UnauthorizedCaller.selector, _other),
      abi.encodeWithSelector(ISettlementReceiver.SettlementReceiver_InvalidSourceBlockchain.selector, _otherId),
      abi.encodeWithSelector(ISettlementReceiver.SettlementReceiver_InvalidOriginTransferrer.selector, _other),
      abi.encodeWithSelector(ISettlementReceiver.SettlementReceiver_InvalidOriginSender.selector, _other),
      abi.encodeWithSelector(ISettlementReceiver.SettlementReceiver_InvalidToken.selector, _other)
    ];
    for (uint256 _i; _i < 5; ++_i) {
      address _caller = _i == 0 ? _other : _transferrer;
      bytes32 _source = _i == 1 ? _otherId : _SOURCE;
      address _from = _i == 2 ? _other : _originTransferrer;
      address _sender = _i == 3 ? _other : _originSender;
      address _asset = _i == 4 ? _other : _token;
      vm.expectRevert(_errors[_i]);
      _deliver(_caller, _source, _from, _sender, _asset, 1, _payload());
      assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.None));
    }
  }

  function test_GivenSeveralWrongSourceValues() external whenTheTransferrerDeliversTokens {
    // it reverts with the first error in check order
    address _other = makeAddr('other');
    vm.expectRevert(abi.encodeWithSelector(ISettlementReceiver.SettlementReceiver_InvalidOriginSender.selector, _other));
    _deliver(_transferrer, _SOURCE, _originTransferrer, _other, _other, 1, _payload());

    vm.expectRevert(abi.encodeWithSelector(ISettlementReceiver.SettlementReceiver_UnauthorizedCaller.selector, _other));
    _deliver(_other, keccak256('other'), _other, _other, _other, 0, hex'00');
  }

  function test_GivenABadSourceAndAMalformedPayload() external whenTheTransferrerDeliversTokens {
    // it returns the source error
    address _other = makeAddr('other');
    vm.expectRevert(abi.encodeWithSelector(ISettlementReceiver.SettlementReceiver_InvalidToken.selector, _other));
    _deliver(_transferrer, _SOURCE, _originTransferrer, _originSender, _other, 1, hex'00');
  }

  function test_GivenAZeroAmount() external whenTheTransferrerDeliversTokens {
    // it reverts with SettlementReceiver_ZeroAmount
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_ZeroAmount.selector);
    _deliver(_transferrer, _SOURCE, _originTransferrer, _originSender, _token, 0, _payload());
  }

  function test_GivenAPayloadThatIsNot64BytesOrHasADirtyMerchantWord() external whenTheTransferrerDeliversTokens {
    // it reverts with SettlementReceiver_InvalidPayload
    bytes[4] memory _payloads = [
      new bytes(0),
      abi.encodePacked(_PAYMENT, _merchant, uint8(1)),
      abi.encodePacked(_PAYMENT),
      abi.encode(_PAYMENT, type(uint256).max)
    ];
    for (uint256 _i; _i < _payloads.length; ++_i) {
      vm.expectRevert(ISettlementReceiver.SettlementReceiver_InvalidPayload.selector);
      _deliver(_transferrer, _SOURCE, _originTransferrer, _originSender, _token, 1, _payloads[_i]);
    }
  }

  function test_GivenAnUnusedPaymentId() external whenTheTransferrerDeliversTokens {
    // it emits StatusChanged from None to Received
    vm.expectEmit(true, false, false, true, address(_receiver));
    emit ISettlementReceiver.StatusChanged(
      _PAYMENT, ISettlementReceiver.Status.None, ISettlementReceiver.Status.Received
    );
    _deliver(_transferrer, _SOURCE, _originTransferrer, _originSender, _token, 1, _payload());
    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.Received));
  }

  function test_GivenAPaymentIdThatIsNotNone() external whenTheTransferrerDeliversTokens {
    // it reverts with SettlementReceiver_InvalidTransition
    ISettlementReceiver.Status[3] memory _used =
      [ISettlementReceiver.Status.Received, ISettlementReceiver.Status.Settled, ISettlementReceiver.Status.Rejected];
    for (uint256 _i; _i < _used.length; ++_i) {
      _receiver.exposed_setStatus(_PAYMENT, _used[_i]);
      vm.expectRevert(
        abi.encodeWithSelector(
          ISettlementReceiver.SettlementReceiver_InvalidTransition.selector,
          _used[_i],
          ISettlementReceiver.Status.Received
        )
      );
      _deliver(_transferrer, _SOURCE, _originTransferrer, _originSender, _token, 1, _payload());
    }
  }

  function _payload() internal view returns (bytes memory _data) {
    _data = abi.encode(_PAYMENT, _merchant);
  }

  function _deliver(
    address _caller,
    bytes32 _source,
    address _from,
    address _sender,
    address _asset,
    uint256 _amount,
    bytes memory _data
  )
    internal
  {
    vm.prank(_caller);
    _receiver.receiveTokens(_source, _from, _sender, _asset, _amount, _data);
  }
}
