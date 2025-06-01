// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CompanyRegistry.sol";
import "./UserRegistry.sol";

contract ExpenseTracker {
    CompanyRegistry public companyRegistry;
    UserRegistry public userRegistry;
    
    struct Expense {
        uint256 id;
        address user;
        address companyAddress;
        uint256 amount;
        string category;
        string description;
        uint256 timestamp;
        bool isApproved;
        bool isPaid;
        string receiptHash; // IPFS hash for receipt
    }
    
    struct Reimbursement {
        uint256 expenseId;
        uint256 amount;
        uint256 timestamp;
        bool processed;
    }
    
    mapping(uint256 => Expense) public expenses;
    mapping(address => uint256[]) public userExpenses;
    mapping(uint256 => Reimbursement) public reimbursements;
    
    uint256 public expenseCounter;
    uint256 public reimbursementCounter;
    
    event ExpenseCreated(
        uint256 indexed expenseId,
        address indexed user,
        address indexed company,
        uint256 amount,
        string category
    );
    
    event ExpenseApproved(uint256 indexed expenseId, address approver);
    event ExpensePaid(uint256 indexed expenseId, uint256 amount);
    event ReimbursementRequested(uint256 indexed reimbursementId, uint256 expenseId);
    event ReimbursementProcessed(uint256 indexed reimbursementId);
    
    modifier onlyRegisteredUser() {
        require(userRegistry.isRegisteredUser(msg.sender), "User not registered");
        _;
    }
    
    modifier onlyAdmin() {
        require(userRegistry.isAdmin(msg.sender), "Only admin can perform this action");
        _;
    }
    
    constructor(address _companyRegistry, address _userRegistry) {
        companyRegistry = CompanyRegistry(_companyRegistry);
        userRegistry = UserRegistry(_userRegistry);
    }
    
    function createExpense(
        address companyAddress,
        uint256 amount,
        string memory category,
        string memory description,
        string memory receiptHash
    ) external onlyRegisteredUser {
        require(companyRegistry.isRegisteredCompany(companyAddress), "Company not registered");
        require(amount > 0, "Amount must be greater than 0");
        
        expenseCounter++;
        
        expenses[expenseCounter] = Expense({
            id: expenseCounter,
            user: msg.sender,
            companyAddress: companyAddress,
            amount: amount,
            category: category,
            description: description,
            timestamp: block.timestamp,
            isApproved: false,
            isPaid: false,
            receiptHash: receiptHash
        });
        
        userExpenses[msg.sender].push(expenseCounter);
        
        emit ExpenseCreated(expenseCounter, msg.sender, companyAddress, amount, category);
    }
    
    function approveExpense(uint256 expenseId) external onlyAdmin {
        require(expenses[expenseId].id != 0, "Expense does not exist");
        require(!expenses[expenseId].isApproved, "Expense already approved");
        
        expenses[expenseId].isApproved = true;
        
        emit ExpenseApproved(expenseId, msg.sender);
    }
    
    function payExpense(uint256 expenseId) external payable onlyAdmin {
        require(expenses[expenseId].id != 0, "Expense does not exist");
        require(expenses[expenseId].isApproved, "Expense not approved");
        require(!expenses[expenseId].isPaid, "Expense already paid");
        require(msg.value >= expenses[expenseId].amount, "Insufficient payment amount");
        
        expenses[expenseId].isPaid = true;
        
        // Transfer payment to user (reimbursement model)
        payable(expenses[expenseId].user).transfer(expenses[expenseId].amount);
        
        // Refund excess payment
        if (msg.value > expenses[expenseId].amount) {
            payable(msg.sender).transfer(msg.value - expenses[expenseId].amount);
        }
        
        emit ExpensePaid(expenseId, expenses[expenseId].amount);
    }
    
    function requestReimbursement(uint256 expenseId) external onlyRegisteredUser {
        require(expenses[expenseId].id != 0, "Expense does not exist");
        require(expenses[expenseId].user == msg.sender, "Not your expense");
        require(expenses[expenseId].isApproved, "Expense not approved");
        
        reimbursementCounter++;
        
        reimbursements[reimbursementCounter] = Reimbursement({
            expenseId: expenseId,
            amount: expenses[expenseId].amount,
            timestamp: block.timestamp,
            processed: false
        });
        
        emit ReimbursementRequested(reimbursementCounter, expenseId);
    }
    
    function processReimbursement(uint256 reimbursementId) external payable onlyAdmin {
        require(reimbursements[reimbursementId].expenseId != 0, "Reimbursement does not exist");
        require(!reimbursements[reimbursementId].processed, "Reimbursement already processed");
        require(msg.value >= reimbursements[reimbursementId].amount, "Insufficient reimbursement amount");
        
        uint256 expenseId = reimbursements[reimbursementId].expenseId;
        address user = expenses[expenseId].user;
        
        reimbursements[reimbursementId].processed = true;
        
        // Transfer reimbursement to user
        payable(user).transfer(reimbursements[reimbursementId].amount);
        
        // Refund excess payment
        if (msg.value > reimbursements[reimbursementId].amount) {
            payable(msg.sender).transfer(msg.value - reimbursements[reimbursementId].amount);
        }
        
        emit ReimbursementProcessed(reimbursementId);
    }
    
    function getExpense(uint256 expenseId) external view returns (Expense memory) {
        return expenses[expenseId];
    }
    
    function getUserExpenses(address user) external view returns (uint256[] memory) {
        return userExpenses[user];
    }
    
    function getExpensesByCategory(string memory category) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](expenseCounter);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= expenseCounter; i++) {
            if (keccak256(bytes(expenses[i].category)) == keccak256(bytes(category))) {
                result[count] = i;
                count++;
            }
        }
        
        // Resize array
        uint256[] memory filteredResult = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            filteredResult[i] = result[i];
        }
        
        return filteredResult;
    }
}