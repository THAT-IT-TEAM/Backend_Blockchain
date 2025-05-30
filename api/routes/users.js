const express = require('express');
const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress, userAddress, name, email, department } = req.body;
        
        if (!adminAddress || !userAddress || !name || !email || !department) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await contracts.userRegistry.methods
            .registerUser(userAddress, name, email, department)
            .send({ from: adminAddress, gas: 300000 });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all users
router.get('/', async (req, res) => {
    try {
        const { contracts } = req;
        
        const userAddresses = await contracts.userRegistry.methods
            .getAllUsers()
            .call();
        
        const users = [];
        for (const address of userAddresses) {
            const user = await contracts.userRegistry.methods
                .getUser(address)
                .call();
            
            users.push({
                address: user.userAddress,
                name: user.name,
                email: user.email,
                department: user.department,
                isActive: user.isActive,
                isAdmin: user.isAdmin,
                registrationTime: new Date(Number(user.registrationTime) * 1000),
                totalExpenses: Number(user.totalExpenses),
                totalReimbursed: Number(user.totalReimbursed)
            });
        }
        
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user by address
router.get('/:address', async (req, res) => {
    try {
        const { contracts } = req;
        const userAddress = req.params.address;
        
        const user = await contracts.userRegistry.methods
            .getUser(userAddress)
            .call();
        
        if (!user.isActive && user.registrationTime === '0') {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            address: user.userAddress,
            name: user.name,
            email: user.email,
            department: user.department,
            isActive: user.isActive,
            isAdmin: user.isAdmin,
            registrationTime: new Date(Number(user.registrationTime) * 1000),
            totalExpenses: Number(user.totalExpenses),
            totalReimbursed: Number(user.totalReimbursed)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Grant admin privileges
router.put('/:address/grant-admin', async (req, res) => {
    try {
        const { contracts } = req;
        const { ownerAddress } = req.body;
        const userAddress = req.params.address;
        
        if (!ownerAddress) {
            return res.status(400).json({ error: 'Owner address required' });
        }
        
        const result = await contracts.userRegistry.methods
            .grantAdmin(userAddress)
            .send({ from: ownerAddress, gas: 200000 });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Revoke admin privileges
router.put('/:address/revoke-admin', async (req, res) => {
    try {
        const { contracts } = req;
        const { ownerAddress } = req.body;
        const userAddress = req.params.address;
        
        if (!ownerAddress) {
            return res.status(400).json({ error: 'Owner address required' });
        }
        
        const result = await contracts.userRegistry.methods
            .revokeAdmin(userAddress)
            .send({ from: ownerAddress, gas: 200000 });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deactivate user
router.put('/:address/deactivate', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress } = req.body;
        const userAddress = req.params.address;
        
        if (!adminAddress) {
            return res.status(400).json({ error: 'Admin address required' });
        }
        
        const result = await contracts.userRegistry.methods
            .deactivateUser(userAddress)
            .send({ from: adminAddress, gas: 200000 });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Activate user
router.put('/:address/activate', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress } = req.body;
        const userAddress = req.params.address;
        
        if (!adminAddress) {
            return res.status(400).json({ error: 'Admin address required' });
        }
        
        const result = await contracts.userRegistry.methods
            .activateUser(userAddress)
            .send({ from: adminAddress, gas: 200000 });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;