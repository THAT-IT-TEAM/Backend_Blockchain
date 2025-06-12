const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid'); // Import uuid for generating expense IDs
const multer = require('multer'); // Import multer
// const { createClient } = require('@supabase/supabase-js'); // Removed Supabase import

// Initialize Supabase client (use environment variables for security)
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey); // Removed Supabase initialization

// Configure multer for file uploads (receipts)
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory

// Get all expenses (now from local SQLite)
router.get('/', async (req, res) => {
    const { db } = req; // Access the SQLite database instance
    try {
        // Fetch all expenses from local SQLite
        const expenses = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM expenses`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        res.json({ expenses });
    } catch (error) {
        console.error('Error fetching expenses from local DB:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Create new expense (now inserts into local SQLite, uploads to IPFS, then pushes to blockchain)
router.post('/', upload.single('receipt'), async (req, res) => { // Use upload.single() middleware
    const { contracts, web3, db, ipfs, user } = req; // Access db, ipfs, and user (from auth middleware)
    const { user_id, vendor_id, amount, category, description } = req.body; // receipt_hash will come from IPFS
    const receiptFile = req.file; // The uploaded file

    // The authenticated user's ID should be used, or ensure user_id is the authenticated user.
    // For this flow, we'll assume user_id from body is the actual user making the expense.
    // If a different user is making the expense, auth logic needs to confirm permissions.
    // For simplicity, we'll assume user_id provided in body is the user's local ID.
    const authenticatedUserId = user.userId; // ID of the user authenticated by JWT

    if (!user_id || !vendor_id || !amount || !category) {
        return res.status(400).json({ error: 'Missing required fields: user_id, vendor_id, amount, category' });
    }

    let receiptIpfsHash = null; // Initialize receiptIpfsHash

    try {
        // 0. Handle IPFS upload if a file is provided
        if (receiptFile) {
            if (!ipfs) {
                console.error('IPFS node not initialized');
                return res.status(500).json({ error: 'IPFS node not initialized. Cannot upload receipt.' });
            }
            
            try {
                console.log('Uploading receipt to in-process IPFS node...');
                // Convert buffer to Uint8Array which is what IPFS expects
                const content = new Uint8Array(receiptFile.buffer);
                // Add the file to IPFS
                const { cid } = await ipfs.add({
                    content: content,
                    path: `receipt_${Date.now()}_${receiptFile.originalname}`
                });
                
                // Get the CID (Content Identifier)
                receiptIpfsHash = cid.toString();
                console.log(`Receipt uploaded to IPFS with CID: ${receiptIpfsHash}`);
                
                // Pin the file to ensure it's not garbage collected
                await ipfs.pin.add(cid);
                console.log(`Pinned receipt with CID: ${receiptIpfsHash}`);
                
                // Get the file size
                const stats = await ipfs.files.stat(`/ipfs/${receiptIpfsHash}`);
                console.log(`File size: ${stats.size} bytes`);
                
            } catch (ipfsError) {
                console.error('Error uploading to IPFS:', ipfsError);
                return res.status(500).json({ 
                    error: 'Failed to upload receipt to IPFS',
                    details: ipfsError.message 
                });
            }
        }

        // Generate a UUID for the expense for local storage
        const expenseId = uuidv4();

        // 1. Get userAddress (wallet_id) from local SQLite 'users' table
        const userAddressPromise = new Promise((resolve, reject) => {
            db.get(`SELECT wallet_id FROM users WHERE id = ?`, [user_id], (err, row) => {
                if (err) return reject(err);
                if (!row || !row.wallet_id) return reject(new Error(`User with ID ${user_id} wallet_id not found or user not registered.`));
                resolve(row.wallet_id);
            });
        });

        // 2. Get vendorAddress (wallet_id) from local SQLite 'users' table (assuming vendors are also in 'users' table with a 'vendor' role)
        const vendorAddressPromise = new Promise((resolve, reject) => {
            db.get(`SELECT wallet_id FROM users WHERE id = ? AND role = 'vendor'`, [vendor_id], (err, row) => {
                if (err) return reject(err);
                if (!row || !row.wallet_id) return reject(new Error(`Vendor with ID ${vendor_id} wallet_id not found or vendor not registered.`));
                resolve(row.wallet_id);
            });
        });

        const [userBlockchainAddress, vendorBlockchainAddress] = await Promise.all([userAddressPromise, vendorAddressPromise]);

        // Insert into local SQLite 'expenses' table first
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO expenses (id, user_id, vendor_id, amount, category, description, receipt_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [expenseId, user_id, vendor_id, amount, category, description || null, receiptIpfsHash],
                function(err) {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });

        const amountWei = web3.utils.toWei(amount.toString(), 'ether');

        // Perform blockchain transaction
        // The userAddress found above is the one creating the expense on blockchain.
        // This assumes the user's wallet is funded and its private key is accessible to the API
        // for signing OR a system-wide automatedWallet is used for all transactions.
        // Given previous discussions, the automatedWallet is likely the one to send transactions.
        // If `user_id` is the authenticated user, we might use their wallet_id from the DB and expect it to be funded
        // For simplicity, let's use the `userBlockchainAddress` (from `user_id`) as the `from` address for the transaction.
        // This implies the user's wallet_id's private key must be loaded into web3.eth.accounts.wallet OR the transaction is delegated.

        // IMPORTANT: The `from` address for `send` needs to be an account managed by `web3.eth.accounts.wallet`
        // If individual user wallets are not loaded, you would use `req.automatedWallet.address` here, but that implies
        // the automated wallet has permission to create expenses on behalf of any user, which may not be the contract's design.
        // For now, I will use `userBlockchainAddress` and assume it is properly managed.
        const result = await contracts.expenseTracker.methods
            .createExpense(vendorBlockchainAddress, amountWei, category, description || '', receiptIpfsHash || '') // Pass IPFS hash to blockchain
            .send({ from: userBlockchainAddress, gas: 500000 }); // Use the user's blockchain address as sender
        
        const blockchainTxHash = result.transactionHash;
        const blockchainExpenseId = result.events.ExpenseCreated.returnValues.expenseId;

        // Update local SQLite 'expenses' table with blockchain transaction details
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE expenses SET blockchain_status = TRUE, blockchain_tx_hash = ? WHERE id = ?`, 
                [blockchainTxHash, expenseId],
                function(err) {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
        
        res.json({
            success: true,
            message: 'Expense created in local DB and synced to blockchain',
            localExpenseId: expenseId, // The ID generated for the local SQLite record
            blockchainTxHash: blockchainTxHash,
            blockchainExpenseId: blockchainExpenseId,
            receiptIpfsHash: receiptIpfsHash // Include IPFS hash in response
        });
    } catch (error) {
        console.error('Error creating expense:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Approve expense (unchanged for now, interacts directly with blockchain)
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

// Pay expense (unchanged for now, interacts directly with blockchain)
router.put('/:id/pay', async (req, res) => {
    try {
        const { contracts, web3 } = req;
        const { adminAddress } = req.body;
        const expenseId = req.params.id;
        
        if (!adminAddress) {
            return res.status(400).json({ error: 'Admin address required' });
        }
        
        // Get expense details from blockchain
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

// Get user expenses (unchanged for now, interacts directly with blockchain)
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

// Get vendor expenses (unchanged for now, interacts directly with blockchain)
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

// Get expenses by category (unchanged for now, interacts directly with blockchain)
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