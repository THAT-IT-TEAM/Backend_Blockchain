const express = require('express');
const router = express.Router();

// Get all expenses
router.get('/', async (req, res) => {
    try {
        const { contracts, web3 } = req;
        const accounts = await web3.eth.getAccounts();
        
        // Get expense counter
        const expenseCounter = await contracts.expenseTracker.methods.expenseCounter().call();
        
        const expenses = [];
        for (let i = 1; i <= expenseCounter; i++) {
            const expense = await contracts.expenseTracker.methods.getExpense(i).call();
            expenses.push({
                id: expense.id,
                user: expense.user,
                vendor: expense.vendor,
                amount: web3.utils.fromWei(expense.amount, 'ether'),
                category: expense.category,
                description: expense.description,
                timestamp: new Date(Number(expense.timestamp) * 1000),
                isApproved: expense.isApproved,
                isPaid: expense.isPaid,
                receiptHash: expense.receiptHash
            });
        }
        
        res.json({ expenses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new expense
router.post('/', async (req, res) => {
    try {
        const { contracts, web3 } = req;
        const { userAddress, vendorAddress, amount, category, description, receiptHash } = req.body;
        
        if (!userAddress || !vendorAddress || !amount || !category) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const amountWei = web3.utils.toWei(amount.toString(), 'ether');
        
        const result = await contracts.expenseTracker.methods
            .createExpense(vendorAddress, amountWei, category, description || '', receiptHash || '')
            .send({ from: userAddress, gas: 500000 });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash,
            expenseId: result.events.ExpenseCreated.returnValues.expenseId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve expense
router.put('/:id/approve', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress } = req.body;
        const expenseId = req.params.id;
        
        if (!adminAddress) {
            return res.status(400).json({ error: 'Admin address required' });
        }
        
        const result = await contracts.expenseTracker.methods
            .approveExpense(expenseId)
            .send({ from: adminAddress, gas: 200000 });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Pay expense
router.put('/:id/pay', async (req, res) => {
    try {
        const { contracts, web3 } = req;
        const { adminAddress } = req.body;
        const expenseId = req.params.id;
        
        if (!adminAddress) {
            return res.status(400).json({ error: 'Admin address required' });
        }
        
        // Get expense details
        const expense = await contracts.expenseTracker.methods.getExpense(expenseId).call();
        
        const result = await contracts.expenseTracker.methods
            .payExpense(expenseId)
            .send({ 
                from: adminAddress, 
                value: expense.amount, 
                gas: 300000 
            });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user expenses
router.get('/user/:address', async (req, res) => {
    try {
        const { contracts, web3 } = req;
        const userAddress = req.params.address;
        
        const expenseIds = await contracts.expenseTracker.methods
            .getUserExpenses(userAddress)
            .call();
        
        const expenses = [];
        for (const id of expenseIds) {
            const expense = await contracts.expenseTracker.methods.getExpense(id).call();
            expenses.push({
                id: expense.id,
                vendor: expense.vendor,
                amount: web3.utils.fromWei(expense.amount, 'ether'),
                category: expense.category,
                description: expense.description,
                timestamp: new Date(Number(expense.timestamp) * 1000),
                isApproved: expense.isApproved,
                isPaid: expense.isPaid,
                receiptHash: expense.receiptHash
            });
        }
        
        res.json({ expenses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get vendor expenses
router.get('/vendor/:address', async (req, res) => {
    try {
        const { contracts, web3 } = req;
        const vendorAddress = req.params.address;
        
        const expenseIds = await contracts.expenseTracker.methods
            .getVendorExpenses(vendorAddress)
            .call();
        
        const expenses = [];
        for (const id of expenseIds) {
            const expense = await contracts.expenseTracker.methods.getExpense(id).call();
            expenses.push({
                id: expense.id,
                user: expense.user,
                amount: web3.utils.fromWei(expense.amount, 'ether'),
                category: expense.category,
                description: expense.description,
                timestamp: new Date(Number(expense.timestamp) * 1000),
                isApproved: expense.isApproved,
                isPaid: expense.isPaid,
                receiptHash: expense.receiptHash
            });
        }
        
        res.json({ expenses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get expenses by category
router.get('/category/:category', async (req, res) => {
    try {
        const { contracts, web3 } = req;
        const category = req.params.category;
        
        const expenseIds = await contracts.expenseTracker.methods
            .getExpensesByCategory(category)
            .call();
        
        const expenses = [];
        for (const id of expenseIds) {
            if (id > 0) { // Filter out empty entries
                const expense = await contracts.expenseTracker.methods.getExpense(id).call();
                expenses.push({
                    id: expense.id,
                    user: expense.user,
                    vendor: expense.vendor,
                    amount: web3.utils.fromWei(expense.amount, 'ether'),
                    category: expense.category,
                    description: expense.description,
                    timestamp: new Date(Number(expense.timestamp) * 1000),
                    isApproved: expense.isApproved,
                    isPaid: expense.isPaid,
                    receiptHash: expense.receiptHash
                });
            }
        }
        
        res.json({ expenses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;