// scripts/deploy.js
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const Web3 = require('web3');

// Configuration
const RPC_URL = 'http://localhost:8545';
const CONTRACTS_DIR = path.join(__dirname, '..', 'contracts');
const BUILD_DIR = path.join(__dirname, '..', 'build');
const GAS_LIMIT = 6721975;
const GAS_PRICE = 20000000000; // 20 Gwei as number

// Initialize Web3
const web3 = new Web3(RPC_URL);

// Helper function to safely convert BigInt to Number
function safeToNumber(value) {
    if (typeof value === 'bigint') {
        return Number(value);
    }
    return value;
}

async function main() {
    try {
        console.log('🚀 Starting contract deployment...');
        
        // Check connection
        const isConnected = await web3.eth.net.isListening();
        if (!isConnected) {
            throw new Error('Failed to connect to blockchain network');
        }
        console.log('✅ Connected to blockchain network');
        
        // Get network info
        const networkId = await web3.eth.net.getId();
        const chainId = await web3.eth.getChainId();
        console.log(`📡 Network ID: ${networkId}, Chain ID: ${chainId}`);
        
        // Get accounts
        const accounts = await web3.eth.getAccounts();
        if (accounts.length === 0) {
            throw new Error('No accounts available');
        }
        
        const deployerAccount = accounts[0];
        const balance = await web3.eth.getBalance(deployerAccount);
        
        console.log(`Deploying contracts from account: ${deployerAccount}`);
        console.log(`Account balance: ${web3.utils.fromWei(balance, 'ether')} ETH`);
        
        // Ensure build directory exists
        if (!fs.existsSync(BUILD_DIR)) {
            fs.mkdirSync(BUILD_DIR, { recursive: true });
        }
        
        // Compile contracts
        console.log('📝 Compiling contracts...');
        const compiledContracts = await compileContracts();
        
        // Deploy contracts in order
        console.log('🚀 Deploying contracts...');
        
        // 1. Deploy UserRegistry
        console.log('Deploying UserRegistry...');
        const userRegistry = await deployContract(
            'UserRegistry',
            compiledContracts.UserRegistry,
            [],
            deployerAccount
        );
        
        // 2. Deploy CompanyRegistry
        console.log('Deploying CompanyRegistry...');
        const companyRegistry = await deployContract(
            'CompanyRegistry',
            compiledContracts.CompanyRegistry,
            [],
            deployerAccount
        );
        
        // 3. Deploy TripRegistry
        console.log('Deploying TripRegistry...');
        const tripRegistry = await deployContract(
            'TripRegistry',
            compiledContracts.TripRegistry,
            [companyRegistry.options.address],
            deployerAccount
        );
        
        // 4. Deploy ExpenseTracker with registry addresses
        console.log('Deploying ExpenseTracker...');
        const expenseTracker = await deployContract(
            'ExpenseTracker',
            compiledContracts.ExpenseTracker,
            [companyRegistry.options.address, userRegistry.options.address],
            deployerAccount
        );
        
        // Save deployment info
        const deploymentInfo = {
            network: 'development',
            chainId: safeToNumber(await web3.eth.getChainId()),
            deployedAt: new Date().toISOString(),
            deployer: deployerAccount,
            contracts: {
                UserRegistry: {
                    address: userRegistry.options.address,
                    transactionHash: userRegistry.transactionHash,
                    abi: compiledContracts.UserRegistry.abi
                },
                CompanyRegistry: {
                    address: companyRegistry.options.address,
                    transactionHash: companyRegistry.transactionHash,
                    abi: compiledContracts.CompanyRegistry.abi
                },
                TripRegistry: {
                    address: tripRegistry.options.address,
                    transactionHash: tripRegistry.transactionHash,
                    abi: compiledContracts.TripRegistry.abi
                },
                ExpenseTracker: {
                    address: expenseTracker.options.address,
                    transactionHash: expenseTracker.transactionHash,
                    abi: compiledContracts.ExpenseTracker.abi
                }
            }
        };
        
        // Save to file
        const deploymentPath = path.join(__dirname, '..', 'config', 'deployed-contracts.json');
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        
        console.log('\n🎉 Deployment completed successfully!');
        console.log('\n📋 Contract Addresses:');
        console.log(`UserRegistry: ${userRegistry.options.address}`);
        console.log(`CompanyRegistry: ${companyRegistry.options.address}`);
        console.log(`TripRegistry: ${tripRegistry.options.address}`);
        console.log(`ExpenseTracker: ${expenseTracker.options.address}`);
        console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);
        
        // Generate frontend config
        generateFrontendConfig(deploymentInfo);
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

async function compileContracts() {
    console.log('📁 Reading contract files...');
    
    // List of contract files to compile
    const contractFiles = [
        'UserRegistry.sol',
        'CompanyRegistry.sol',
        'TripRegistry.sol',
        'ExpenseTracker.sol'
    ];
    
    // Check if files exist
    const sources = {};
    for (const filename of contractFiles) {
        const contractPath = path.join(CONTRACTS_DIR, filename);
        if (!fs.existsSync(contractPath)) {
            console.log(`⚠️  File not found: ${contractPath}`);
            console.log('📂 Available files in contracts directory:');
            const availableFiles = fs.readdirSync(CONTRACTS_DIR);
            availableFiles.forEach(file => console.log(`   - ${file}`));
            throw new Error(`Contract file not found: ${filename}`);
        }
        
        const source = fs.readFileSync(contractPath, 'utf8');
        sources[filename] = { content: source };
        console.log(`✅ Read ${filename} (${source.length} chars)`);
    }
    
    // Prepare input for solc with import resolver
    const input = {
        language: 'Solidity',
        sources: sources,
        settings: {
            outputSelection: {
                '*': {
                    '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
                }
            },
            optimizer: {
                enabled: true,
                runs: 200
            },
            evmVersion: 'london' // Use a stable EVM version
        }
    };
    
    // Custom import resolver function
    function findImports(importPath) {
        try {
            // Resolve from node_modules
            const nodeModulesPath = path.resolve(__dirname, '..', 'node_modules', importPath);
            if (fs.existsSync(nodeModulesPath)) {
                return { contents: fs.readFileSync(nodeModulesPath, 'utf8') };
            }

            // Resolve from local contracts directory
            const localPath = path.resolve(CONTRACTS_DIR, importPath);
            if (fs.existsSync(localPath)) {
                return { contents: fs.readFileSync(localPath, 'utf8') };
            }

            // For nested imports within libraries (e.g., @openzeppelin/contracts/utils/Context.sol)
            const directPath = path.resolve(importPath);
            if (fs.existsSync(directPath)) {
                return { contents: fs.readFileSync(directPath, 'utf8') };
            }
            return { error: 'File not found' };
        } catch (error) {
            return { error: error.message };
        }
    }
    
    // Compile with import resolver
    console.log('🔨 Compiling with Solidity compiler...');
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    
    // Check for errors
    if (output.errors) {
        const errors = output.errors.filter(error => error.severity === 'error');
        if (errors.length > 0) {
            console.error('❌ Compilation errors:');
            errors.forEach(error => console.error(error.formattedMessage));
            throw new Error('Compilation failed');
        }
        
        // Log warnings
        const warnings = output.errors.filter(error => error.severity === 'warning');
        if (warnings.length > 0) {
            console.warn('⚠️  Compilation warnings:');
            warnings.forEach(warning => console.warn(warning.formattedMessage));
        }
    }
    
    // Extract contracts
    const contracts = {};
    
    // Process each contract file
    for (const filename of contractFiles) {
        if (output.contracts[filename]) {
            const compiledFile = output.contracts[filename];
            
            for (const contractName in compiledFile) {
                const contractData = compiledFile[contractName];
                const bytecode = '0x' + contractData.evm.bytecode.object;
                
                // Validate bytecode
                if (!bytecode || bytecode === '0x' || bytecode.length < 10) {
                    console.error(`❌ Invalid bytecode for ${contractName}`);
                    console.error(`Bytecode: ${bytecode}`);
                    throw new Error(`Contract ${contractName} has invalid bytecode`);
                }
                
                contracts[contractName] = {
                    abi: contractData.abi,
                    bytecode: bytecode
                };
                
                // Save ABI to file
                const abiPath = path.join(BUILD_DIR, `${contractName}.json`);
                fs.writeFileSync(abiPath, JSON.stringify({
                    contractName,
                    abi: contractData.abi,
                    bytecode: bytecode
                }, null, 2));
                
                console.log(`💾 Saved ${contractName} ABI to ${abiPath}`);
                console.log(`📏 Bytecode length: ${bytecode.length} chars`);
            }
        }
    }
    
    console.log('✅ Contracts compiled successfully');
    console.log(`📋 Compiled contracts: ${Object.keys(contracts).join(', ')}`);
    
    return contracts;
}

async function deployContract(name, contractData, constructorArgs, fromAccount) {
    if (!contractData) {
        throw new Error(`Contract data not found for ${name}`);
    }
    
    console.log(`🔧 Preparing deployment for ${name}...`);
    console.log(`📦 Constructor args: ${JSON.stringify(constructorArgs)}`);
    
    const contract = new web3.eth.Contract(contractData.abi);
    
    const deployTx = contract.deploy({
        data: contractData.bytecode,
        arguments: constructorArgs
    });
    
    try {
        // Estimate gas with a safety check
        console.log(`⛽ Estimating gas for ${name}...`);
        const gas = await deployTx.estimateGas({ from: fromAccount });
        
        // Convert BigInt to Number safely for calculations
        const gasNumber = safeToNumber(gas);
        const gasWithBuffer = Math.floor(gasNumber * 1.3); // Add 30% buffer
        
        console.log(`⛽ Estimated gas for ${name}: ${gas}, using: ${gasWithBuffer}`);
        
        // Validate gas limit
        if (gasWithBuffer > GAS_LIMIT) {
            console.warn(`⚠️  Gas limit too high for ${name}: ${gasWithBuffer} > ${GAS_LIMIT}`);
        }
        
        console.log(`🚀 Sending deployment transaction for ${name}...`);
        const deployedContract = await deployTx.send({
            from: fromAccount,
            gas: Math.min(gasWithBuffer, GAS_LIMIT),
            gasPrice: GAS_PRICE
        });
        
        console.log(`✅ ${name} deployed at: ${deployedContract.options.address}`);
        console.log(`📜 Transaction hash: ${deployedContract.transactionHash}`);
        
        return deployedContract;
        
    } catch (error) {
        console.error(`❌ Failed to deploy ${name}:`);
        console.error(`Error message: ${error.message}`);
        
        // Try to get more details about the error
        if (error.message.includes('invalid opcode')) {
            console.error('💡 This usually means:');
            console.error('   - Constructor has a require() that fails');
            console.error('   - Contract has compilation issues');
            console.error('   - Bytecode is invalid or corrupted');
            console.error('   - Constructor arguments are wrong');
        }
        
        throw error;
    }
}

function generateFrontendConfig(deploymentInfo) {
    const frontendConfig = {
        networkId: deploymentInfo.chainId,
        rpcUrl: RPC_URL,
        contracts: {}
    };
    
    for (const [name, info] of Object.entries(deploymentInfo.contracts)) {
        try {
            const abiFile = path.join(BUILD_DIR, `${name}.json`);
            if (fs.existsSync(abiFile)) {
                frontendConfig.contracts[name] = {
                    address: info.address,
                    abi: JSON.parse(fs.readFileSync(abiFile, 'utf8')).abi
                };
            }
        } catch (error) {
            console.warn(`⚠️  Could not load ABI for ${name}: ${error.message}`);
        }
    }
    
    const configPath = path.join(BUILD_DIR, 'frontend-config.json');
    fs.writeFileSync(configPath, JSON.stringify(frontendConfig, null, 2));
    
    console.log(`📱 Frontend config saved to: ${configPath}`);
}

// Debug function to list contract directory contents
function debugContractDirectory() {
    console.log('🔍 Debug: Contract directory contents:');
    console.log(`📁 Directory: ${CONTRACTS_DIR}`);
    
    if (!fs.existsSync(CONTRACTS_DIR)) {
        console.log('❌ Contract directory does not exist!');
        return;
    }
    
    const files = fs.readdirSync(CONTRACTS_DIR);
    console.log(`📄 Files found (${files.length}):`);
    files.forEach(file => {
        const fullPath = path.join(CONTRACTS_DIR, file);
        const stats = fs.statSync(fullPath);
        console.log(`   - ${file} (${stats.size} bytes)`);
    });
}

// Run the deployment
if (require.main === module) {
    // Add debug info before starting
    debugContractDirectory();
    main().catch(console.error);
}

module.exports = { main };