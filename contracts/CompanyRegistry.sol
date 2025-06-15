// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CompanyRegistry {
    struct Company {
        address companyAddress;
        string name;
        string category;
        string contactInfo;
        bool isActive;
        uint256 registrationTime;
        uint256 totalTransactions;
        uint256 totalAmount;
    }
    
    mapping(address => Company) public companies;
    mapping(string => address[]) public companiesByCategory;
    address[] public companyList;
    
    address public admin;
    
    event CompanyRegistered(address indexed company, string name, string category);
    event CompanyDeactivated(address indexed company);
    event CompanyActivated(address indexed company);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    function registerCompany(
        address companyAddress,
        string memory name,
        string memory category
    ) external onlyAdmin {
        require(companyAddress != address(0), "Invalid company address");
        require(!companies[companyAddress].isActive, "Company already registered");
        
        companies[companyAddress] = Company({
            companyAddress: companyAddress,
            name: name,
            category: category,
            contactInfo: "",
            isActive: true,
            registrationTime: block.timestamp,
            totalTransactions: 0,
            totalAmount: 0
        });
        
        companyList.push(companyAddress);
        companiesByCategory[category].push(companyAddress);
        
        emit CompanyRegistered(companyAddress, name, category);
    }
    
    function deactivateCompany(address companyAddress) external onlyAdmin {
        require(companies[companyAddress].isActive, "Company not active");
        companies[companyAddress].isActive = false;
        emit CompanyDeactivated(companyAddress);
    }
    
    function activateCompany(address companyAddress) external onlyAdmin {
        require(!companies[companyAddress].isActive, "Company already active");
        companies[companyAddress].isActive = true;
        emit CompanyActivated(companyAddress);
    }
    
    function updateCompanyStats(address companyAddress, uint256 amount) external {
        require(companies[companyAddress].isActive, "Company not active");
        companies[companyAddress].totalTransactions++;
        companies[companyAddress].totalAmount += amount;
    }
    
    function isRegisteredCompany(address companyAddress) external view returns (bool) {
        return companies[companyAddress].isActive;
    }
    
    function getCompany(address companyAddress) external view returns (Company memory) {
        return companies[companyAddress];
    }
    
    function getCompaniesByCategory(string memory category) external view returns (address[] memory) {
        return companiesByCategory[category];
    }
    
    function getAllCompanies() external view returns (address[] memory) {
        return companyList;
    }
}