// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/// @notice A plain ERC-20 with open minting
contract MockERC20 is ERC20 {
  constructor() ERC20('Mock', 'MCK') { }

  function mint(address _to, uint256 _amount) external {
    _mint(_to, _amount);
  }
}
