// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract UnitRegistryIcm {
    modifier whenReadingTheChainIDOfAKey() {
        _;
    }

    function test_GivenTheEntryHasAChainID() external whenReadingTheChainIDOfAKey {
        // it returns it
    }

    function test_GivenTheEntryHasNoChainID() external whenReadingTheChainIDOfAKey {
        // it reverts with EntryNotFound naming the key and chainId
    }

    modifier whenReadingTheICMBlockchainID() {
        _;
    }

    function test_GivenTheEntryHasOne() external whenReadingTheICMBlockchainID {
        // it returns the bytes32
    }

    function test_GivenTheEntryHasNone() external whenReadingTheICMBlockchainID {
        // it reverts with EntryNotFound naming icm blockchainId
    }

    modifier whenReadingAnICMTransferrer() {
        _;
    }

    function test_GivenTheEntryHasTheTransferrer() external whenReadingAnICMTransferrer {
        // it returns the address
    }

    function test_GivenTheEntryHasNone_WhenReadingAnICMTransferrer() external whenReadingAnICMTransferrer {
        // it reverts with EntryNotFound naming the transferrer
    }

    function test_WhenReadingASelectorFromAnExplicitDirectory() external {
        // it returns the selector of that directory
    }
}
