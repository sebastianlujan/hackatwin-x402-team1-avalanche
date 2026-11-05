// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { CCIPReceiver } from '@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol';
import { IAny2EVMMessageReceiver } from '@chainlink/contracts-ccip/contracts/interfaces/IAny2EVMMessageReceiver.sol';
import { Client } from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';
import { FinalityCodec } from '@chainlink/contracts-ccip/contracts/libraries/FinalityCodec.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';

import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { BrokerFixture } from 'test/utils/BrokerFixture.sol';

contract UnitPaymentBrokerEntry is BrokerFixture {
  address internal _stranger = makeAddr('stranger');

  function setUp() external {
    _deployBroker();
    _broker.setAllowedSender(_SELECTOR_A, _senderX, _payerP);
    _broker.setAllowedSender(_SELECTOR_B, _senderY, _payerQ);
  }

  modifier whenAMessageReachesTheBroker() {
    _;
  }

  function test_GivenACallerThatIsNotTheRouter() external whenAMessageReachesTheBroker {
    // it reverts with InvalidRouter
    Client.Any2EVMMessage memory _msg = _message(keccak256('m'), _SELECTOR_A, _senderX, _valid(_payerP));
    assertEq(_broker.getRouter(), _router);
    assertEq(address(_broker.HUB()), address(_hub));
    address[2] memory _callers = [_stranger, address(this)];
    for (uint256 _i; _i < 2; ++_i) {
      vm.expectRevert(abi.encodeWithSelector(CCIPReceiver.InvalidRouter.selector, _callers[_i]));
      vm.prank(_callers[_i]);
      _broker.ccipReceive(_msg);
    }
  }

  function test_GivenAnAllowedPair() external whenAMessageReachesTheBroker {
    // it processes the message
    _deliver(_message(keccak256('a'), _SELECTOR_A, _senderX, _valid(_payerP)));
    _deliver(_message(keccak256('b'), _SELECTOR_B, _senderY, _valid(_payerQ)));
    assertEq(uint8(_broker.statusOf(keccak256('a'))), uint8(IPaymentBroker.Status.Accepted));
    assertEq(uint8(_broker.statusOf(keccak256('b'))), uint8(IPaymentBroker.Status.Accepted));
  }

  function test_GivenPairsThatAreNotMixed() external whenAMessageReachesTheBroker {
    // it reverts with PaymentBroker_SourceNotAllowed before any other check
    Client.Any2EVMMessage memory _crossed = _message(keccak256('c'), _SELECTOR_A, _senderY, hex'00');
    _crossed.destTokenAmounts = new Client.EVMTokenAmount[](1);
    vm.expectRevert(
      abi.encodeWithSelector(IPaymentBroker.PaymentBroker_SourceNotAllowed.selector, _SELECTOR_A, _senderY)
    );
    _deliver(_crossed);

    vm.expectRevert(
      abi.encodeWithSelector(IPaymentBroker.PaymentBroker_SourceNotAllowed.selector, _SELECTOR_B, _senderX)
    );
    _deliver(_message(keccak256('d'), _SELECTOR_B, _senderX, _valid(_payerP)));

    vm.expectRevert(abi.encodeWithSelector(IPaymentBroker.PaymentBroker_SourceNotAllowed.selector, 3, _senderX));
    _deliver(_message(keccak256('e'), 3, _senderX, _valid(_payerP)));
  }

  function test_GivenARemovedPair() external whenAMessageReachesTheBroker {
    // it reverts with PaymentBroker_SourceNotAllowed
    _broker.setAllowedSender(_SELECTOR_A, _senderX, address(0));
    vm.expectRevert(
      abi.encodeWithSelector(IPaymentBroker.PaymentBroker_SourceNotAllowed.selector, _SELECTOR_A, _senderX)
    );
    _deliver(_message(keccak256('f'), _SELECTOR_A, _senderX, _valid(_payerP)));

    _deliver(_message(keccak256('g'), _SELECTOR_B, _senderY, _valid(_payerQ)));
  }

  function test_GivenAMessageThatCarriesTokens() external whenAMessageReachesTheBroker {
    // it reverts with PaymentBroker_UnexpectedTokens
    Client.Any2EVMMessage memory _msg = _message(keccak256('h'), _SELECTOR_A, _senderX, _valid(_payerP));
    for (uint256 _n = 1; _n <= 2; ++_n) {
      _msg.destTokenAmounts = new Client.EVMTokenAmount[](_n);
      vm.expectRevert(IPaymentBroker.PaymentBroker_UnexpectedTokens.selector);
      _deliver(_msg);
    }
  }

  function test_GivenDataThatIsNot128Bytes() external whenAMessageReachesTheBroker {
    // it reverts with PaymentBroker_InvalidPayload
    uint256[4] memory _sizes = [uint256(0), 127, 129, 160];
    for (uint256 _i; _i < 4; ++_i) {
      vm.expectRevert(IPaymentBroker.PaymentBroker_InvalidPayload.selector);
      _deliver(_message(keccak256('i'), _SELECTOR_A, _senderX, new bytes(_sizes[_i])));
    }
  }

  modifier whenTheOwnerConfiguresTheBroker() {
    _;
  }

  function test_GivenACallerThatIsNotTheOwner() external whenTheOwnerConfiguresTheBroker {
    // it reverts with OwnableUnauthorizedAccount
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _stranger));
    vm.prank(_stranger);
    _broker.setAllowedSender(_SELECTOR_A, _senderX, _payerQ);
    assertEq(_broker.payerOf(_SELECTOR_A, _senderX), _payerP);
  }

  function test_GivenAZeroSender() external whenTheOwnerConfiguresTheBroker {
    // it reverts with PaymentBroker_ZeroAddress
    vm.expectRevert(IPaymentBroker.PaymentBroker_ZeroAddress.selector);
    _broker.setAllowedSender(_SELECTOR_A, address(0), _payerP);
  }

  function test_GivenANewPair() external whenTheOwnerConfiguresTheBroker {
    // it stores the payer and emits AllowedSenderSet
    address _newSender = makeAddr('newSender');
    vm.expectEmit(true, true, false, true, address(_broker));
    emit IPaymentBroker.AllowedSenderSet(3, _newSender, _payerQ);
    _broker.setAllowedSender(3, _newSender, _payerQ);
    assertEq(_broker.payerOf(3, _newSender), _payerQ);

    _broker.setAllowedSender(3, _newSender, _payerP);
    assertEq(_broker.payerOf(3, _newSender), _payerP);
    assertEq(_broker.payerOf(_SELECTOR_A, _senderX), _payerP);
  }

  function test_GivenTheDefaultCcipConfig() external view whenTheOwnerConfiguresTheBroker {
    // it keeps full finality and no custom CCVs
    (address[] memory _required, address[] memory _optional, uint8 _threshold, bytes4 _finality) =
      _broker.getCCVsAndFinalityConfig(_SELECTOR_A, abi.encode(_senderX));
    assertEq(_required.length, 0);
    assertEq(_optional.length, 0);
    assertEq(_threshold, 0);
    assertEq(_finality, FinalityCodec.WAIT_FOR_FINALITY_FLAG);
    assertTrue(_broker.supportsInterface(type(IAny2EVMMessageReceiver).interfaceId));
  }
}
