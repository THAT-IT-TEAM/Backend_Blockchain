require('dotenv').config();
const path = require('path');
const fs = require('fs');
const Web3 = require('web3');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const Config = require('./lib/config');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fileController = require('./controllers/fileController');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept all file types
        cb(null, true);
    }
});

// Initialize Express app
const app = express();

// Enable JSON body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
            process.env.ALLOWED_ORIGINS.split(',') : [];
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// Initialize SQLite database
const DB_PATH = path.join(__dirname, 'data', 'app.db');
const DB_DIR = path.dirname(DB_PATH);

// Create data directory if it doesn't exist
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database at', DB_PATH);
    }
});

// Initialize Web3
let web3;
try {
    web3 = new Web3(process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545');
    console.log('Web3 initialized successfully');
    
    // Test the connection
    web3.eth.getBlockNumber()
        .then(number => console.log('Current block number:', number))
        .catch(err => console.error('Error connecting to blockchain:', err));
        
} catch (error) {
    console.error('Failed to initialize Web3:', error);
    process.exit(1);
}

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// File storage routes (with user context)
app.post('/api/files', 
    authenticateToken, 
    upload.single('file'),
    (req, res) => require('./controllers/fileController').uploadFile(req, res)
);

app.get('/api/files', 
    authenticateToken, 
    (req, res) => require('./controllers/fileController').listFiles(req, res)
);

app.get('/api/files/:cid', 
    authenticateToken, 
    (req, res) => require('./controllers/fileController').getFile(req, res)
);

app.delete('/api/files/:cid', 
    authenticateToken, 
    (req, res) => require('./controllers/fileController').deleteFile(req, res)
);

// --- USERS ENDPOINTS ---
const usersRouter = express.Router();

// Get all users
usersRouter.get('/', async (req, res) => {
    const db = sqliteDb;
    try {
        const users = await new Promise((resolve, reject) => {
            db.all(`SELECT id, email, wallet_id, role, created_at, updated_at FROM users`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user by address
usersRouter.get('/:address', async (req, res) => {
    const db = sqliteDb;
    const userAddress = req.params.address;
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT id, email, wallet_id, role, created_at, updated_at FROM users WHERE wallet_id = ?`, [userAddress], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Grant admin privileges
usersRouter.put('/:address/grant-admin', async (req, res) => {
    try {
        const { ownerAddress } = req.body;
        const userAddress = req.params.address;
        if (!ownerAddress) return res.status(400).json({ error: 'Owner address required' });
        const result = await web3.eth.contracts.userRegistry.methods.grantAdmin(userAddress).send({ from: ownerAddress, gas: 200000 });
        res.json({ success: true, transactionHash: result.transactionHash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Revoke admin privileges
usersRouter.put('/:address/revoke-admin', async (req, res) => {
    try {
        const { ownerAddress } = req.body;
        const userAddress = req.params.address;
        if (!ownerAddress) return res.status(400).json({ error: 'Owner address required' });
        const result = await web3.eth.contracts.userRegistry.methods.revokeAdmin(userAddress).send({ from: ownerAddress, gas: 200000 });
        res.json({ success: true, transactionHash: result.transactionHash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deactivate user
usersRouter.put('/:address/deactivate', async (req, res) => {
    try {
        const { adminAddress } = req.body;
        const userAddress = req.params.address;
        if (!adminAddress) return res.status(400).json({ error: 'Admin address required' });
        const result = await web3.eth.contracts.userRegistry.methods.deactivateUser(userAddress).send({ from: adminAddress, gas: 200000 });
        res.json({ success: true, transactionHash: result.transactionHash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Activate user
usersRouter.put('/:address/activate', async (req, res) => {
    try {
        const { adminAddress } = req.body;
        const userAddress = req.params.address;
        if (!adminAddress) return res.status(400).json({ error: 'Admin address required' });
        const result = await web3.eth.contracts.userRegistry.methods.activateUser(userAddress).send({ from: adminAddress, gas: 200000 });
        res.json({ success: true, transactionHash: result.transactionHash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- VENDORS ENDPOINTS ---
const vendorsRouter = express.Router();

// Get all vendors
vendorsRouter.get('/', async (req, res) => {
    const db = sqliteDb;
    try {
        const vendors = await new Promise((resolve, reject) => {
            db.all(`SELECT id, email, wallet_id, role FROM users WHERE role = 'vendor'`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        res.json({ vendors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get vendor by address
vendorsRouter.get('/:address', async (req, res) => {
    const db = sqliteDb;
    const vendorAddress = req.params.address;
    try {
        const vendor = await new Promise((resolve, reject) => {
            db.get(`SELECT id, email, wallet_id, role FROM users WHERE wallet_id = ? AND role = 'vendor'`, [vendorAddress], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
        if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get vendors by category
vendorsRouter.get('/category/:category', async (req, res) => {
    const db = sqliteDb;
    const category = req.params.category;
    try {
        const vendors = await new Promise((resolve, reject) => {
            db.all(`SELECT id, email, wallet_id, role FROM users WHERE role = 'vendor' AND category = ?`, [category], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        res.json({ vendors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deactivate vendor
vendorsRouter.put('/:address/deactivate', async (req, res) => {
    try {
        const { adminAddress } = req.body;
        const vendorAddress = req.params.address;
        if (!adminAddress) return res.status(400).json({ error: 'Admin address required' });
        const result = await web3.eth.contracts.vendorRegistry.methods.deactivateVendor(vendorAddress).send({ from: adminAddress, gas: 200000 });
        res.json({ success: true, transactionHash: result.transactionHash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Activate vendor
vendorsRouter.put('/:address/activate', async (req, res) => {
    try {
        const { adminAddress } = req.body;
        const vendorAddress = req.params.address;
        if (!adminAddress) return res.status(400).json({ error: 'Admin address required' });
        const result = await web3.eth.contracts.vendorRegistry.methods.activateVendor(vendorAddress).send({ from: adminAddress, gas: 200000 });
        res.json({ success: true, transactionHash: result.transactionHash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- EXPENSES ENDPOINTS ---
const expensesRouter = express.Router();

// Get all expenses
expensesRouter.get('/', async (req, res) => {
    const db = sqliteDb;
    try {
        const expenses = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM expenses`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        res.json({ expenses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mount routers
app.use('/api/users', usersRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/expenses', expensesRouter);

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});



// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: Config.env
    });
});

// Export the app for testing
module.exports = app;

// If this file is run directly, start the server
if (require.main === module) {
    startServer().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}
