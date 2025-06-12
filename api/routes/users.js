const express = require('express');
const router = express.Router();

// Register new user (MOVED to auth.js, commented out here)
// router.post('/register', async (req, res) => {
//     try {
//         const { contracts } = req;
//         const { adminAddress, userAddress, name, email } = req.body;
        
//         if (!adminAddress || !userAddress || !name || !email) {
//             return res.status(400).json({ error: 'Missing required fields' });
//         }
        
//         const result = await contracts.userRegistry.methods
//             .registerUser(userAddress, name, email)
//             .send({ from: adminAddress, gas: 300000 });
        
//         res.json({
//             success: true,
//             transactionHash: result.transactionHash
//         });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// Get all users (now from local SQLite)
router.get('/', async (req, res) => {
    const { db } = req; // Access the SQLite database instance
    try {
        const users = await new Promise((resolve, reject) => {
            db.all(`SELECT id, email, wallet_id, role, created_at, updated_at FROM users`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users from local DB:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get user by address (now from local SQLite using wallet_id)
router.get('/:address', async (req, res) => {
    const { db } = req; // Access the SQLite database instance
    const userAddress = req.params.address; // This is the wallet_id
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT id, email, wallet_id, role, created_at, updated_at FROM users WHERE wallet_id = ?`, [userAddress], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found in local database with this wallet ID' });
        }
        
        res.json({
            id: user.id,
            email: user.email,
            wallet_id: user.wallet_id,
            role: user.role,
            created_at: user.created_at,
            updated_at: user.updated_at
        });
    } catch (error) {
        console.error('Error fetching user by wallet ID from local DB:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Grant admin privileges (still interacts with blockchain)
router.put('/:address/grant-admin', async (req, res) => {
    try {
        const { contracts } = req;
        const { ownerAddress } = req.body;
        const userAddress = req.params.address; // Assumed to be blockchain address
        
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

// Revoke admin privileges (still interacts with blockchain)
router.put('/:address/revoke-admin', async (req, res) => {
    try {
        const { contracts } = req;
        const { ownerAddress } = req.body;
        const userAddress = req.params.address; // Assumed to be blockchain address
        
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

// Deactivate user (still interacts with blockchain)
router.put('/:address/deactivate', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress } = req.body;
        const userAddress = req.params.address; // Assumed to be blockchain address
        
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

// Activate user (still interacts with blockchain)
router.put('/:address/activate', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress } = req.body;
        const userAddress = req.params.address; // Assumed to be blockchain address
        
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