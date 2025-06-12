// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract WalletRegistry {
    mapping(bytes32 => address) private userWallets;
    mapping(address => bytes32) private walletUsers; // Optional reverse mapping

    event WalletRegistered(bytes32 userId, address walletAddress);

    // Register a wallet address for a user identifier
    // Only a designated admin or owner should be able to call this
    function registerWallet(bytes32 userId, address walletAddress) public {
        // Add access control here (e.g., only owner can call)
        require(userWallets[userId] == address(0), "Wallet already registered for this user");
        require(walletAddress != address(0), "Invalid wallet address");

        userWallets[userId] = walletAddress;
        walletUsers[walletAddress] = userId; // Update reverse mapping

        emit WalletRegistered(userId, walletAddress);
    }

    // Get the wallet address for a user identifier
    function getUserWallet(bytes32 userId) public view returns (address) {
        return userWallets[userId];
    }

    // Get the user identifier for a wallet address (if reverse mapping is used)
    function getWalletUser(address walletAddress) public view returns (bytes32) {
        return walletUsers[walletAddress];
    }

    // Add owner/admin logic for access control to registerWallet function
} 