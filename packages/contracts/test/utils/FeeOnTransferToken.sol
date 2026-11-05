// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/// @notice An ERC-20 that burns a fee in basis points from every transfer between accounts
contract FeeOnTransferToken is ERC20 {
  uint256 internal constant _BPS = 10_000;

  uint256 public immutable FEE_BPS;

  constructor(uint256 _feeBps) ERC20('Fee', 'FEE') {
    FEE_BPS = _feeBps;
  }

  function mint(address _to, uint256 _amount) external {
    _mint(_to, _amount);
  }

  function _update(address _from, address _to, uint256 _value) internal override {
    if (_from == address(0) || _to == address(0)) return super._update(_from, _to, _value);
    uint256 _fee = _value * FEE_BPS / _BPS;
    super._update(_from, address(0), _fee);
    super._update(_from, _to, _value - _fee);
  }
}
