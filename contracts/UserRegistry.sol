// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract UserRegistry {
    struct User {
        address userAddress;
        string name;
        string email;
        string department;
        bool isActive;
        bool isAdmin;
        uint256 registrationTime;
        uint256 totalExpenses;
        uint256 totalReimbursed;
    }
    
    mapping(address => User) public users;
    address[] public userList;
    
    address public owner;
    
    event UserRegistered(address indexed user, string name, string department);
    event UserDeactivated(address indexed user);
    event UserActivated(address indexed user);
    event AdminGranted(address indexed user);
    event AdminRevoked(address indexed user);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    modifier onlyAdmin() {
        require(users[msg.sender].isAdmin, "Only admin can perform this action");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        // Register owner as admin
        users[owner] = User({
            userAddress: owner,
            name: "System Admin",
            email: "admin@expensetracker.com",
            department: "IT",
            isActive: true,
            isAdmin: true,
            registrationTime: block.timestamp,
            totalExpenses: 0,
            totalReimbursed: 0
        });
        userList.push(owner);
    }
    
    function registerUser(
        address userAddress,
        string memory name,
        string memory email,
        string memory department
    ) external onlyAdmin {
        require(userAddress != address(0), "Invalid user address");
        require(!users[userAddress].isActive, "User already registered");
        
        users[userAddress] = User({
            userAddress: userAddress,
            name: name,
            email: email,
            department: department,
            isActive: true,
            isAdmin: false,
            registrationTime: block.timestamp,
            totalExpenses: 0,
            totalReimbursed: 0
        });
        
        userList.push(userAddress);
        
        emit UserRegistered(userAddress, name, department);
    }
    
    function deactivateUser(address userAddress) external onlyAdmin {
        require(users[userAddress].isActive, "User not active");
        users[userAddress].isActive = false;
        emit UserDeactivated(userAddress);
    }
    
    function activateUser(address userAddress) external onlyAdmin {
        require(!users[userAddress].isActive, "User already active");
        users[userAddress].isActive = true;
        emit UserActivated(userAddress);
    }
    
    function grantAdmin(address userAddress) external onlyOwner {
        require(users[userAddress].isActive, "User not active");
        users[userAddress].isAdmin = true;
        emit AdminGranted(userAddress);
    }
    
    function revokeAdmin(address userAddress) external onlyOwner {
        require(userAddress != owner, "Cannot revoke owner admin");
        users[userAddress].isAdmin = false;
        emit AdminRevoked(userAddress);
    }
    
    function updateUserStats(address userAddress, uint256 expenseAmount, uint256 reimbursedAmount) external {
        require(users[userAddress].isActive, "User not active");
        users[userAddress].totalExpenses += expenseAmount;
        users[userAddress].totalReimbursed += reimbursedAmount;
    }
    
    function isRegisteredUser(address userAddress) external view returns (bool) {
        return users[userAddress].isActive;
    }
    
    function isAdmin(address userAddress) external view returns (bool) {
        return users[userAddress].isAdmin;
    }
    
    function getUser(address userAddress) external view returns (User memory) {
        return users[userAddress];
    }
    
    function getAllUsers() external view returns (address[] memory) {
        return userList;
    }
}