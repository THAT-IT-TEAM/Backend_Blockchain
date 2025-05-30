const express = require('express');
const { Web3 } = require('web3');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Routes
const expenseRoutes = require('./routes/expenses');
const vendorRoutes = require('./routes/vendors');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Web3 setup
const web3 = new Web3(process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545');

// Load deployed contracts
let contracts = {};
try {
    const deployedContracts = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'config', 'deployed-contracts.json'), 'utf8')
    );
    
    contracts.userRegistry = new web3.eth.Contract(
        deployedContracts.userRegistry.abi,
        deployedContracts.userRegistry.address
    );
    
    contracts.vendorRegistry = new web3.eth.Contract(
        deployedContracts.vendorRegistry.abi,
        deployedContracts.vendorRegistry.address
    );
    
    contracts.expenseTracker = new web3.eth.Contract(
        deployedContracts.expenseTracker.abi,
        deployedContracts.expenseTracker.address
    );
    
    console.log('Smart contracts loaded successfully');
} catch (error) {
    console.error('Failed to load smart contracts:', error.message);
    console.log('Make sure contracts are deployed first');
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Make web3 and contracts available to routes
app.use((req, res, next) => {
    req.web3 = web3;
    req.contracts = contracts;
    next();
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const blockNumber = await web3.eth.getBlockNumber();
        const accounts = await web3.eth.getAccounts();
        
        res.json({
            status: 'healthy',
            blockchain: {
                connected: true,
                blockNumber: Number(blockNumber),
                accounts: accounts.length
            },
            contracts: {
                loaded: Object.keys(contracts).length > 0,
                available: Object.keys(contracts)
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Network info
app.get('/network', async (req, res) => {
    try {
        const networkId = await web3.eth.net.getId();
        const blockNumber = await web3.eth.getBlockNumber();
        const gasPrice = await web3.eth.getGasPrice();
        
        res.json({
            networkId: Number(networkId),
            blockNumber: Number(blockNumber),
            gasPrice: gasPrice.toString(),
            nodeInfo: await web3.eth.getNodeInfo()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes
app.use('/api/expenses', expenseRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/users', userRoutes);

// Error handling
app.use((error, req, res, next) => {
    console.error('API Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`Expense Tracker Blockchain API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;