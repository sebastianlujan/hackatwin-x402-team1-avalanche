// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IcttMessenger } from 'src/IcttMessenger.sol';
import { IIcttMessenger } from 'src/interfaces/IIcttMessenger.sol';
import { IERC20TokenTransferrer } from 'src/interfaces/external/icm/IERC20TokenTransferrer.sol';

contract UnitIcttMessenger is Test {
  bytes32 internal constant _DESTINATION = keccak256('l1');
  uint256 internal constant _REQUIRED_GAS = 500_000;
  uint256 internal constant _RECIPIENT_GAS = 250_000;

  address internal _hub = makeAddr('hub');
  address internal _transferrer = makeAddr('transferrer');
  address internal _token = makeAddr('token');
  address internal _destinationTransferrer = makeAddr('destinationTransferrer');
  address internal _receiver = makeAddr('receiver');
  address internal _fallback = makeAddr('fallback');

  modifier whenDeployingTheMessenger() {
    _;
  }

  function test_GivenValidInputs() external whenDeployingTheMessenger {
    // it exposes every configured value
    IcttMessenger _messenger = _deploy(_addresses(), _DESTINATION, _REQUIRED_GAS, _RECIPIENT_GAS);
    assertEq(_messenger.HUB(), _hub);
    assertEq(address(_messenger.TRANSFERRER()), _transferrer);
    assertEq(_messenger.TOKEN(), _token);
    assertEq(_messenger.DESTINATION_BLOCKCHAIN_ID(), _DESTINATION);
    assertEq(_messenger.DESTINATION_TRANSFERRER(), _destinationTransferrer);
    assertEq(_messenger.RECEIVER(), _receiver);
    assertEq(_messenger.REQUIRED_GAS_LIMIT(), _REQUIRED_GAS);
    assertEq(_messenger.RECIPIENT_GAS_LIMIT(), _RECIPIENT_GAS);
    assertEq(_messenger.FALLBACK_RECIPIENT(), _fallback);
  }

  function test_GivenAGasLimitThatIsZeroOrARecipientLimitNotBelowTheRequiredLimit() external whenDeployingTheMessenger {
    // it reverts with IcttMessenger_InvalidGasLimits
    uint256[2][4] memory _limits =
      [[uint256(0), 0], [_REQUIRED_GAS, 0], [_REQUIRED_GAS, _REQUIRED_GAS], [uint256(1), 2]];
    for (uint256 _i; _i < _limits.length; ++_i) {
      vm.expectRevert(
        abi.encodeWithSelector(IIcttMessenger.IcttMessenger_InvalidGasLimits.selector, _limits[_i][0], _limits[_i][1])
      );
      _deploy(_addresses(), _DESTINATION, _limits[_i][0], _limits[_i][1]);
    }
  }

  function test_GivenAZeroAddressInAnyAddressInput() external whenDeployingTheMessenger {
    // it reverts with IcttMessenger_ZeroAddress
    for (uint256 _i; _i < 6; ++_i) {
      address[6] memory _a = _addresses();
      _a[_i] = address(0);
      vm.expectRevert(IIcttMessenger.IcttMessenger_ZeroAddress.selector);
      _deploy(_a, _DESTINATION, _REQUIRED_GAS, _RECIPIENT_GAS);
    }
  }

  function test_GivenAZeroDestinationBlockchainId() external whenDeployingTheMessenger {
    // it reverts with IcttMessenger_ZeroBlockchainId
    vm.expectRevert(IIcttMessenger.IcttMessenger_ZeroBlockchainId.selector);
    _deploy(_addresses(), bytes32(0), _REQUIRED_GAS, _RECIPIENT_GAS);
  }

  function _addresses() internal view returns (address[6] memory _a) {
    _a = [_hub, _transferrer, _token, _destinationTransferrer, _receiver, _fallback];
  }

  function _deploy(
    address[6] memory _a,
    bytes32 _destination,
    uint256 _requiredGas,
    uint256 _recipientGas
  )
    internal
    returns (IcttMessenger _m)
  {
    _m = new IcttMessenger(
      _a[0], IERC20TokenTransferrer(_a[1]), _a[2], _destination, _a[3], _a[4], _requiredGas, _recipientGas, _a[5]
    );
  }
}
