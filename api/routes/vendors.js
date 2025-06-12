const express = require('express');
const router = express.Router();

// Register new vendor (MOVED functionality to auth.js and sync process)
// router.post('/register', async (req, res) => {
//     try {
//         const { contracts } = req;
//         const { adminAddress, vendorAddress, name, category, contactInfo } = req.body;
        
//         if (!adminAddress || !vendorAddress || !name || !category) {
//             return res.status(400).json({ error: 'Missing required fields' });
//         }
        
//         const result = await contracts.vendorRegistry.methods
//             .registerVendor(vendorAddress, name, category, contactInfo || '')
//             .send({ from: adminAddress, gas: 300000 });
        
//         res.json({
//             success: true,
//             transactionHash: result.transactionHash
//         });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// Get all vendors (now from local SQLite)
router.get('/', async (req, res) => {
    const { db } = req; // Access the SQLite database instance
    try {
        const vendors = await new Promise((resolve, reject) => {
            // Assuming vendors are stored in the 'users' table with role = 'vendor'
            db.all(`SELECT id, email, wallet_id, role FROM users WHERE role = 'vendor'`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        res.json({ vendors });
    } catch (error) {
        console.error('Error fetching vendors from local DB:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get vendor by address (now from local SQLite using wallet_id)
router.get('/:address', async (req, res) => {
    const { db } = req; // Access the SQLite database instance
    const vendorAddress = req.params.address; // This is the wallet_id
    try {
        const vendor = await new Promise((resolve, reject) => {
            // Assuming vendors are in the 'users' table with role = 'vendor'
            db.get(`SELECT id, email, wallet_id, role FROM users WHERE wallet_id = ? AND role = 'vendor'`, [vendorAddress], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
        
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found in local database with this wallet ID' });
        }
        
        res.json({
            id: vendor.id,
            email: vendor.email,
            wallet_id: vendor.wallet_id,
            role: vendor.role
            // You might add name, category, contactInfo fields here if they are in your users table
        });
    } catch (error) {
        console.error('Error fetching vendor by wallet ID from local DB:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get vendors by category (now from local SQLite)
router.get('/category/:category', async (req, res) => {
    const { db } = req; // Access the SQLite database instance
    const category = req.params.category;
    try {
        const vendors = await new Promise((resolve, reject) => {
            // Assuming a 'category' column exists in the users table for vendors
            db.all(`SELECT id, email, wallet_id, role FROM users WHERE role = 'vendor' AND category = ?`, [category], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        
        res.json({ vendors });
    } catch (error) {
        console.error('Error fetching vendors by category from local DB:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Deactivate vendor (still interacts with blockchain)
router.put('/:address/deactivate', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress } = req.body;
        const vendorAddress = req.params.address; // Assumed to be blockchain address
        
        if (!adminAddress) {
            return res.status(400).json({ error: 'Admin address required' });
        }
        
        const result = await contracts.vendorRegistry.methods
            .deactivateVendor(vendorAddress)
            .send({ from: adminAddress, gas: 200000 });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Activate vendor (still interacts with blockchain)
router.put('/:address/activate', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress } = req.body;
        const vendorAddress = req.params.address; // Assumed to be blockchain address
        
        if (!adminAddress) {
            return res.status(400).json({ error: 'Admin address required' });
        }
        
        const result = await contracts.vendorRegistry.methods
            .activateVendor(vendorAddress)
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