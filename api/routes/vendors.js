const express = require('express');
const router = express.Router();

// Register new vendor
router.post('/register', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress, vendorAddress, name, category, contactInfo } = req.body;
        
        if (!adminAddress || !vendorAddress || !name || !category) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await contracts.vendorRegistry.methods
            .registerVendor(vendorAddress, name, category, contactInfo || '')
            .send({ from: adminAddress, gas: 300000 });
        
        res.json({
            success: true,
            transactionHash: result.transactionHash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all vendors
router.get('/', async (req, res) => {
    try {
        const { contracts } = req;
        
        const vendorAddresses = await contracts.vendorRegistry.methods
            .getAllVendors()
            .call();
        
        const vendors = [];
        for (const address of vendorAddresses) {
            const vendor = await contracts.vendorRegistry.methods
                .getVendor(address)
                .call();
            
            vendors.push({
                address: vendor.vendorAddress,
                name: vendor.name,
                category: vendor.category,
                contactInfo: vendor.contactInfo,
                isActive: vendor.isActive,
                registrationTime: new Date(Number(vendor.registrationTime) * 1000),
                totalTransactions: Number(vendor.totalTransactions),
                totalAmount: vendor.totalAmount
            });
        }
        
        res.json({ vendors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get vendor by address
router.get('/:address', async (req, res) => {
    try {
        const { contracts } = req;
        const vendorAddress = req.params.address;
        
        const vendor = await contracts.vendorRegistry.methods
            .getVendor(vendorAddress)
            .call();
        
        if (!vendor.isActive && vendor.registrationTime === '0') {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        
        res.json({
            address: vendor.vendorAddress,
            name: vendor.name,
            category: vendor.category,
            contactInfo: vendor.contactInfo,
            isActive: vendor.isActive,
            registrationTime: new Date(Number(vendor.registrationTime) * 1000),
            totalTransactions: Number(vendor.totalTransactions),
            totalAmount: vendor.totalAmount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get vendors by category
router.get('/category/:category', async (req, res) => {
    try {
        const { contracts } = req;
        const category = req.params.category;
        
        const vendorAddresses = await contracts.vendorRegistry.methods
            .getVendorsByCategory(category)
            .call();
        
        const vendors = [];
        for (const address of vendorAddresses) {
            const vendor = await contracts.vendorRegistry.methods
                .getVendor(address)
                .call();
            
            if (vendor.isActive) {
                vendors.push({
                    address: vendor.vendorAddress,
                    name: vendor.name,
                    category: vendor.category,
                    contactInfo: vendor.contactInfo,
                    isActive: vendor.isActive,
                    registrationTime: new Date(Number(vendor.registrationTime) * 1000),
                    totalTransactions: Number(vendor.totalTransactions),
                    totalAmount: vendor.totalAmount
                });
            }
        }
        
        res.json({ vendors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deactivate vendor
router.put('/:address/deactivate', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress } = req.body;
        const vendorAddress = req.params.address;
        
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

// Activate vendor
router.put('/:address/activate', async (req, res) => {
    try {
        const { contracts } = req;
        const { adminAddress } = req.body;
        const vendorAddress = req.params.address;
        
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