// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VendorRegistry {
    struct Vendor {
        address vendorAddress;
        string name;
        string category;
        string contactInfo;
        bool isActive;
        uint256 registrationTime;
        uint256 totalTransactions;
        uint256 totalAmount;
    }
    
    mapping(address => Vendor) public vendors;
    mapping(string => address[]) public vendorsByCategory;
    address[] public vendorList;
    
    address public admin;
    
    event VendorRegistered(address indexed vendor, string name, string category);
    event VendorDeactivated(address indexed vendor);
    event VendorActivated(address indexed vendor);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    function registerVendor(
        address vendorAddress,
        string memory name,
        string memory category,
        string memory contactInfo
    ) external onlyAdmin {
        require(vendorAddress != address(0), "Invalid vendor address");
        require(!vendors[vendorAddress].isActive, "Vendor already registered");
        
        vendors[vendorAddress] = Vendor({
            vendorAddress: vendorAddress,
            name: name,
            category: category,
            contactInfo: contactInfo,
            isActive: true,
            registrationTime: block.timestamp,
            totalTransactions: 0,
            totalAmount: 0
        });
        
        vendorList.push(vendorAddress);
        vendorsByCategory[category].push(vendorAddress);
        
        emit VendorRegistered(vendorAddress, name, category);
    }
    
    function deactivateVendor(address vendorAddress) external onlyAdmin {
        require(vendors[vendorAddress].isActive, "Vendor not active");
        vendors[vendorAddress].isActive = false;
        emit VendorDeactivated(vendorAddress);
    }
    
    function activateVendor(address vendorAddress) external onlyAdmin {
        require(!vendors[vendorAddress].isActive, "Vendor already active");
        vendors[vendorAddress].isActive = true;
        emit VendorActivated(vendorAddress);
    }
    
    function updateVendorStats(address vendorAddress, uint256 amount) external {
        require(vendors[vendorAddress].isActive, "Vendor not active");
        vendors[vendorAddress].totalTransactions++;
        vendors[vendorAddress].totalAmount += amount;
    }
    
    function isRegisteredVendor(address vendorAddress) external view returns (bool) {
        return vendors[vendorAddress].isActive;
    }
    
    function getVendor(address vendorAddress) external view returns (Vendor memory) {
        return vendors[vendorAddress];
    }
    
    function getVendorsByCategory(string memory category) external view returns (address[] memory) {
        return vendorsByCategory[category];
    }
    
    function getAllVendors() external view returns (address[] memory) {
        return vendorList;
    }
}