// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { SettlementReceiver } from 'src/SettlementReceiver.sol';
import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { TestTokenTransferrer } from 'test/utils/TestTokenTransferrer.sol';

contract UnitSettlementReceiverWithdraw is Test {
  bytes32 internal constant _SOURCE = keccak256('fuji');

  address internal _originTransferrer = makeAddr('originTransferrer');
  address internal _originSender = makeAddr('originSender');
  address internal _merchant = makeAddr('merchant');
  address internal _other = makeAddr('other');

  MockERC20 internal _token;
  TestTokenTransferrer internal _transferrer;
  SettlementReceiver internal _receiver;

  function setUp() external {
    _token = new MockERC20();
    _transferrer = new TestTokenTransferrer(_token);
    _receiver = new SettlementReceiver(
      address(_transferrer), _SOURCE, _originTransferrer, _originSender, address(_token), address(this)
    );
    _receiver.setMerchant(_merchant, true);
    _receiver.setMerchant(_other, true);
  }

  modifier whenAMerchantWithdraws() {
    _;
  }

  function test_GivenACreditedMerchant() external whenAMerchantWithdraws {
    // it transfers the credit and zeroes it and emits Withdrawn
    _settle(keccak256('one'), _merchant, 5);

    vm.expectEmit(true, false, false, true, address(_receiver));
    emit ISettlementReceiver.Withdrawn(_merchant, 5);
    vm.prank(_merchant);
    _receiver.withdraw();

    assertEq(_token.balanceOf(_merchant), 5);
    assertEq(_token.balanceOf(address(_receiver)), 0);
    assertEq(_receiver.creditOf(_merchant), 0);
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_ZeroAmount.selector);
    vm.prank(_merchant);
    _receiver.withdraw();
  }

  function test_GivenTwoCreditedMerchants() external whenAMerchantWithdraws {
    // it pays each only its own credit
    _settle(keccak256('one'), _merchant, 5);
    _settle(keccak256('two'), _other, 8);
    _settle(keccak256('three'), _merchant, 2);

    vm.prank(_merchant);
    _receiver.withdraw();
    assertEq(_token.balanceOf(_merchant), 7);
    assertEq(_receiver.creditOf(_other), 8);
    vm.prank(_other);
    _receiver.withdraw();
    assertEq(_token.balanceOf(_other), 8);
    assertEq(_token.balanceOf(address(_receiver)), 0);
  }

  function test_GivenACallerWithoutCredit() external whenAMerchantWithdraws {
    // it reverts with SettlementReceiver_ZeroAmount
    _settle(keccak256('one'), _merchant, 5);
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_ZeroAmount.selector);
    vm.prank(makeAddr('stranger'));
    _receiver.withdraw();
    assertEq(_token.balanceOf(address(_receiver)), 5);
  }

  function _settle(bytes32 _paymentId, address _to, uint256 _amount) internal {
    _token.mint(address(_transferrer), _amount);
    _transferrer.deliver(
      _receiver, _SOURCE, _originTransferrer, _originSender, _amount, abi.encode(_paymentId, _to), address(0xdead)
    );
  }
}
