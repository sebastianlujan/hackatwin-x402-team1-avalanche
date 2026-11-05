// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/// @notice A 6-decimal ERC-20 with open minting, standing in for USDC on the local chains
contract LocalUsdc is ERC20 {
  constructor() ERC20('Local USDC', 'USDC') { }

  /// @notice Mint `_amount` to `_to`
  function mint(address _to, uint256 _amount) external {
    _mint(_to, _amount);
  }

  /// @notice USDC uses 6 decimals
  function decimals() public pure override returns (uint8) {
    return 6;
  }
}
