const http = require('http');
const url = require('url');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const Web3 = require('web3');
const { v4: uuidv4 } = require('uuid');
const formidable = require('formidable');
const ngrok = require('ngrok');
require('dotenv').config(); // Load environment variables from .env file

const PORT = process.env.PORT || 3050;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const DB_PATH = path.join(__dirname, 'data', 'app.db');
const db = new sqlite3.Database(DB_PATH);

const MimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
};

// Load contract deployment info
const DEPLOYED_CONTRACTS_PATH = path.join(__dirname, '../config/deployed-contracts.json');
console.log(`DEBUG: Attempting to load deployed contracts from: ${DEPLOYED_CONTRACTS_PATH}`);
let contractsInfo = null;
if (fs.existsSync(DEPLOYED_CONTRACTS_PATH)) {
  console.log(`DEBUG: deployed-contracts.json found at: ${DEPLOYED_CONTRACTS_PATH}`);
  try {
    const fileContent = fs.readFileSync(DEPLOYED_CONTRACTS_PATH, 'utf8');
    console.log(`DEBUG: Raw content of deployed-contracts.json (first 100 chars): ${fileContent.substring(0, 100)}...`);
    contractsInfo = JSON.parse(fileContent);
    console.log('DEBUG: JSON.parse successful.');
  } catch (parseError) {
    console.error(`ERROR: Failed to parse deployed-contracts.json: ${parseError.message}`);
  }
} else {
  console.error(`ERROR: deployed-contracts.json NOT FOUND at: ${DEPLOYED_CONTRACTS_PATH}`);
}

// Initialize Web3 and contract instances
console.log('DEBUG: BLOCKCHAIN_RPC_URL from .env', process.env.BLOCKCHAIN_RPC_URL);
let web3 = null;
let UserRegistry = null, CompanyRegistry = null, TripRegistry = null, ExpenseTracker = null;
if (contractsInfo && contractsInfo.contracts) {
  web3 = new Web3(process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545');
  console.log('DEBUG: contractsInfo loaded', !!contractsInfo);
  console.log('DEBUG: contractsInfo.contracts loaded', !!contractsInfo.contracts);
  const { UserRegistry: ur, CompanyRegistry: cr, TripRegistry: tr, ExpenseTracker: et } = contractsInfo.contracts;
  if (ur) UserRegistry = new web3.eth.Contract(ur.abi, ur.address);
  if (cr) CompanyRegistry = new web3.eth.Contract(cr.abi, cr.address);
  if (tr) TripRegistry = new web3.eth.Contract(tr.abi, tr.address);
  if (et) ExpenseTracker = new web3.eth.Contract(et.abi, et.address);
    } else {
  console.error('ERROR: contractsInfo or contractsInfo.contracts is null/undefined. Web3 and contract instances will not be initialized.');
}

// Promisify db.run and db.all for async/await
const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

async function initializeDatabase() {
  try {
    // --- START UUID MIGRATION FOR USERS TABLE ---
    let userColumns = await allAsync(`PRAGMA table_info(users);`);
    let needsMigration = false;
    let oldUsers = [];

    if (userColumns.length > 0) {
      const idColumn = userColumns.find(col => col.name === 'id');
      if (idColumn && idColumn.type === 'INTEGER') {
        needsMigration = true;
        console.log('DEBUG: Users table ID is INTEGER. Migration needed.');
      } else {
        console.log('DEBUG: Users table ID is TEXT. No migration needed.');
      }
    } else {
      console.log('DEBUG: Users table does not exist. Will create with TEXT PRIMARY KEY.');
    }

    if (needsMigration) {
      console.log('DEBUG: Starting users table migration from INTEGER to TEXT UUIDs.');
      await runAsync('BEGIN TRANSACTION;');
      try {
        oldUsers = await allAsync('SELECT id, email, password, role FROM users;');
        
        await runAsync('ALTER TABLE users RENAME TO users_old;');

        const NEW_USERS_TABLE_SQL = `CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          password TEXT,
          role TEXT
        );`;
        await runAsync(NEW_USERS_TABLE_SQL);

        for (const oldUser of oldUsers) {
          const newUserId = uuidv4();
          await runAsync('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)', [newUserId, oldUser.email, oldUser.password, oldUser.role]);
          // Update profiles, expenses, project_members that reference user_id
          await runAsync('UPDATE profiles SET user_id = ? WHERE user_id = ?', [newUserId, oldUser.id]);
          await runAsync('UPDATE expenses SET user_id = ? WHERE user_id = ?', [newUserId, oldUser.id]);
          await runAsync('UPDATE project_members SET user_id = ? WHERE user_id = ?', [newUserId, oldUser.id]);
        }

        await runAsync('DROP TABLE users_old;');
        await runAsync('COMMIT;');
        console.log('DEBUG: Users table migration completed successfully.');
      } catch (migrateErr) {
        await runAsync('ROLLBACK;');
        console.error('ERROR: Users table migration failed:', migrateErr.message);
        // Do not exit, allow subsequent steps to potentially re-create table
      }
    }
    // --- END UUID MIGRATION FOR USERS TABLE ---

    // Ensure users table exists
    const USERS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT
    );`;
    await runAsync(USERS_TABLE_SQL);

    // Insert default admin if not exists
    let adminUser = await allAsync('SELECT * FROM users WHERE email = ?', ['admin@blockchain.com']);
    let walletId = null;

    if (adminUser.length === 0) {
      // Insert admin user with UUID
      const newAdminId = uuidv4(); // Generate UUID for new admin
      const result = await runAsync('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)', [newAdminId, 'admin@blockchain.com', 'admin123', 'admin']);
      const userId = newAdminId; // Use newAdminId here

      // Create wallet
      const wallet = web3.eth.accounts.create();
      walletId = wallet.address;

      // Insert into profiles (not users) - ensure profiles.user_id is TEXT
      await runAsync('INSERT INTO profiles (user_id, wallet_id, email, role) VALUES (?, ?, ?, ?)', [userId, walletId, 'admin@blockchain.com', 'admin']);

      console.log("--------------------------------------------------");
      console.log("ADMIN CREDENTIALS (for development purposes):");
      console.log(`Email: admin@blockchain.com`);
      console.log(`Password: admin123`);
      console.log(`Wallet ID: ${walletId}`);
      console.log("--------------------------------------------------");
    } else {
      // If admin user already exists, fetch their wallet ID
      // This should now fetch UUID from users table if migration happened
      const profile = await allAsync('SELECT wallet_id FROM profiles WHERE user_id = (SELECT id FROM users WHERE email = ?)', ['admin@blockchain.com']);
      if (profile.length > 0) {
        walletId = profile[0].wallet_id;
        console.log("--------------------------------------------------")
        console.log("EXISTING ADMIN CREDENTIALS:");
        console.log(`Email: admin@blockchain.com`);
        console.log(`Password: admin123`); // Note: Password is not stored hashed for simplicity in this demo.
        console.log(`Wallet ID: ${walletId}`);
        console.log("--------------------------------------------------")
      }
    }

    // Ensure profiles table exists (user_id changed to TEXT)
    const PROFILES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE,
      wallet_id TEXT,
      email TEXT,
      role TEXT DEFAULT 'user',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`;
    await runAsync(PROFILES_TABLE_SQL);

    // Add status column to profiles table if it doesn't exist
    const profileColumns = await allAsync(`PRAGMA table_info(profiles);`);
    const hasProfileStatusColumn = profileColumns.some(col => col.name === 'status');
    if (!hasProfileStatusColumn) {
      await runAsync(`ALTER TABLE profiles ADD COLUMN status TEXT DEFAULT 'unverified';`);
      console.log('Status column added to profiles table.');
    }

    // Ensure files table exists
    const FILES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cid TEXT UNIQUE,
      name TEXT,
      size INTEGER,
      mimetype TEXT,
      uploaded_by INTEGER,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;
    await runAsync(FILES_TABLE_SQL);

    // Drop and recreate dashboard table to ensure correct schema for TEXT PRIMARY KEY
    const DASHBOARD_TABLE_SQL = `CREATE TABLE IF NOT EXISTS dashboard (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      vendorName TEXT NOT NULL,
      submittedBy TEXT NOT NULL,
      projectName TEXT NOT NULL,
      receiptPreview TEXT NOT NULL,
      expenseType TEXT,
      submissionDate TEXT NOT NULL,
      amount TEXT NOT NULL,
      status TEXT NOT NULL,
      onChainHash TEXT NOT NULL,
      actions TEXT NOT NULL
    );`;
    await runAsync(DASHBOARD_TABLE_SQL);

    // Drop and recreate trip_reports table to ensure correct schema
   
    const TRIP_REPORTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS trip_reports (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      report_name TEXT NOT NULL,
      summary TEXT,
      total_expenses_amount REAL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by_user_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    );`;
    await runAsync(TRIP_REPORTS_TABLE_SQL);

    // Ensure expenses table exists
    const EXPENSES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount REAL,
      currency TEXT,
      transaction_date TEXT,
      vendor_name TEXT,
      category TEXT,
      description TEXT,
      document_id TEXT,
      payment_method TEXT,
      tax_amount REAL,
      document_url TEXT,
      extracted_data TEXT,
      summary TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      user_id TEXT NOT NULL,
      trip_id TEXT NOT NULL,
      blockchain_status INTEGER NOT NULL DEFAULT 0,
      blockchain_id TEXT,
      status TEXT DEFAULT 'pending'
    );`;
    await runAsync(EXPENSES_TABLE_SQL);

    // Add status column to expenses table if it doesn't exist
    const expenseColumns = await allAsync(`PRAGMA table_info(expenses);`);
    const hasExpenseStatusColumn = expenseColumns.some(col => col.name === 'status');
    if (!hasExpenseStatusColumn) {
      await runAsync(`ALTER TABLE expenses ADD COLUMN status TEXT DEFAULT 'pending';`);
      console.log('Status column added to expenses table.');
    }

    // Ensure receipt_fraud_checks table exists
    const RECEIPT_FRAUD_CHECKS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS receipt_fraud_checks (
      id TEXT PRIMARY KEY,
      expense_id TEXT UNIQUE,
      overall_risk_score REAL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 1),
      fraud_probability REAL CHECK (fraud_probability >= 0 AND fraud_probability <= 1),
      risk_factors TEXT,
      verification_results TEXT,
      image_analysis_results TEXT,
      online_verification_results TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`;
    await runAsync(RECEIPT_FRAUD_CHECKS_TABLE_SQL);

    // Ensure trips table exists
    const TRIPS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      budget REAL NOT NULL,
      budget_spent REAL DEFAULT 0.00,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`;
    await runAsync(TRIPS_TABLE_SQL);

    // Ensure project_members table exists (user_id and project_id changed to TEXT)
    const PROJECT_MEMBERS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(project_id, user_id)
    );`;
    await runAsync(PROJECT_MEMBERS_TABLE_SQL);

    // Ensure vector_db_documents table exists
    const VECTOR_DB_DOCUMENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS vector_db_documents (
      id TEXT PRIMARY KEY,
      vector_db_name TEXT,
      document_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );`;
    await runAsync(VECTOR_DB_DOCUMENTS_TABLE_SQL);

    // Ensure companies table exists
    const COMPANIES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT UNIQUE NOT NULL,
      category TEXT,
      registered_at TEXT DEFAULT (datetime('now'))
    );`;
    await runAsync(COMPANIES_TABLE_SQL);

    // Ensure a default company is registered on the blockchain and in the local DB
    if (CompanyRegistry) {
      try {
        // Use getAllCompanies to check count, as getCompanyCount is not a function
        const allCompanies = await CompanyRegistry.methods.getAllCompanies().call();
        const companyCount = allCompanies.length.toString(); // Convert to string as it was compared to '0'

        if (companyCount === '0') { // CompanyCount returns a string from web3.js
          console.log('DEBUG: No companies registered on blockchain. Registering a default company...');
          const accounts = await web3.eth.getAccounts();
          if (accounts.length < 2) {
            console.error('ERROR: Not enough Ethereum accounts available to register company. Need at least 2 for deployer and company address.');
          } else {
            const deployerAccount = accounts[0];
            const defaultCompanyAddress = accounts[1]; // Use the second Ganache account as the company address
            const companyName = 'Default Company';
            const companyCategory = 'Technology';

            const tx = await CompanyRegistry.methods.registerCompany(
              defaultCompanyAddress,
              companyName,
              companyCategory
            ).send({ from: deployerAccount, gas: 500000 });
            console.log(`DEBUG: Default company "${companyName}" registered on blockchain. Transaction hash: ${tx.transactionHash}`);
            console.log(`DEBUG: Default company address: ${defaultCompanyAddress}`);

            // Store the default company in the local database as well
            await runAsync(
              'INSERT OR IGNORE INTO companies (id, name, address, category) VALUES (?, ?, ?, ?)',
              [uuidv4(), companyName, defaultCompanyAddress, companyCategory]
            );
            console.log('DEBUG: Default company added to local database.');
            console.log('DEBUG: Default company stored in local DB with address:', defaultCompanyAddress);
          }
        } else {
          console.log(`DEBUG: ${companyCount} companies already registered on blockchain. Skipping default registration.`);
        }
      } catch (companyRegError) {
        console.error('ERROR: Failed to check or register default company on blockchain:', companyRegError.message);
        console.error('Blockchain company registration error stack:', companyRegError.stack);
      }
    } else {
      console.error('ERROR: CompanyRegistry contract not initialized. Cannot check or register companies.');
    }

    // Ensure file storage buckets exist
    const uploadsDir = path.join(__dirname, 'uploads');
    ['data-storage', 'images', 'web-frontend'].forEach(bucket => {
      const bucketPath = path.join(uploadsDir, bucket);
      if (!fs.existsSync(bucketPath)) {
        fs.mkdirSync(bucketPath, { recursive: true });
      }
    });

  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1); // Exit if database initialization fails
  }
}

// Ensure files table exists
const FILES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cid TEXT UNIQUE,
  name TEXT,
  size INTEGER,
  mimetype TEXT,
  uploaded_by INTEGER,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`;
db.run(FILES_TABLE_SQL);

// Ensure additional tables exist (adapted for SQLite)
const DASHBOARD_TABLE_SQL = `CREATE TABLE IF NOT EXISTS dashboard (
  supaId INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  vendorName TEXT NOT NULL,
  submittedBy TEXT NOT NULL,
  projectName TEXT NOT NULL,
  receiptPreview TEXT NOT NULL,
  expenseType TEXT,
  submissionDate TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL,
  onChainHash TEXT NOT NULL,
  actions TEXT NOT NULL,
  id INTEGER NOT NULL
);`;
db.run(DASHBOARD_TABLE_SQL);

const EXPENSES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  amount REAL,
  currency TEXT,
  transaction_date TEXT,
  vendor_name TEXT,
  category TEXT,
  description TEXT,
  document_id TEXT,
  payment_method TEXT,
  tax_amount REAL,
  document_url TEXT,
  extracted_data TEXT,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  user_id TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  blockchain_status INTEGER NOT NULL DEFAULT 0,
  blockchain_id TEXT,
  status TEXT DEFAULT 'pending'
);`;
db.run(EXPENSES_TABLE_SQL);

// Add status column to expenses table if it doesn't exist
db.all(`PRAGMA table_info(expenses);`, (err, columns) => {
  if (err) {
    console.error('Error checking expenses table schema:', err);
    return;
  }
  if (!Array.isArray(columns)) {
    console.error('PRAGMA table_info did not return an array for columns for expenses.', columns);
    return;
  }
  const hasStatusColumn = columns.some(col => col.name === 'status');
  if (!hasStatusColumn) {
    db.run(`ALTER TABLE expenses ADD COLUMN status TEXT DEFAULT 'pending';`, (alterErr) => {
      if (alterErr) {
        console.error('Error adding status column to expenses table:', alterErr);
      } else {
        console.log('Status column added to expenses table.');
      }
    });
  }
});

const PROFILES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE,
  wallet_id TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);`;
db.run(PROFILES_TABLE_SQL, () => {
  // Add status column to profiles table if it doesn't exist
  db.all(`PRAGMA table_info(profiles);`, (err, columns) => {
    if (err) {
      console.error('Error checking profiles table schema:', err);
      return;
    }
    // Ensure columns is an array before calling .some()
    if (!Array.isArray(columns)) {
      console.error('PRAGMA table_info did not return an array for columns.', columns);
      return;
    }
    const hasStatusColumn = columns.some(col => col.name === 'status');
    if (!hasStatusColumn) {
      db.run(`ALTER TABLE profiles ADD COLUMN status TEXT DEFAULT 'unverified';`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding status column to profiles table:', alterErr);
        } else {
          console.log('Status column added to profiles table.');
        }
      });
    }
  });
});

const RECEIPT_FRAUD_CHECKS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS receipt_fraud_checks (
  id TEXT PRIMARY KEY,
  expense_id TEXT UNIQUE,
  overall_risk_score REAL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 1),
  fraud_probability REAL CHECK (fraud_probability >= 0 AND fraud_probability <= 1),
  risk_factors TEXT,
  verification_results TEXT,
  image_analysis_results TEXT,
  online_verification_results TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);`;
db.run(RECEIPT_FRAUD_CHECKS_TABLE_SQL);

const TRIPS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  budget REAL NOT NULL,
  budget_spent REAL DEFAULT 0.00,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);`;
db.run(TRIPS_TABLE_SQL);

const PROJECT_MEMBERS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_id)
);`;
db.run(PROJECT_MEMBERS_TABLE_SQL);

const VECTOR_DB_DOCUMENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS vector_db_documents (
  id TEXT PRIMARY KEY,
  vector_db_name TEXT,
  document_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);`;
db.run(VECTOR_DB_DOCUMENTS_TABLE_SQL);

// --- Logging function (copy from start-api.js for consistency) ---
function log(service, message, color) {
    const colors = {
        red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m', reset: '\x1b[0m',
    };
    const colorCode = colors[color] || colors.reset;
    console.log(`[${new Date().toISOString()}] [${service}] ${colorCode}${message}${colors.reset}`);
}

// --- Ngrok start function (copy from start-api.js) ---
async function startNgrok(port) {
    try {
        const ngrokConfig = {
            addr: port,
            authtoken: process.env.NGROK_AUTHTOKEN,
            region: 'us'
        };
        if (process.env.NGROK_DOMAIN) {
            ngrokConfig.hostname = process.env.NGROK_DOMAIN;
            log('ngrok', `Using custom ngrok domain: ${process.env.NGROK_DOMAIN}`, 'yellow');
        }
        const url = await ngrok.connect(ngrokConfig);
        log('ngrok', `API is accessible via ngrok: ${url}`, 'green');
        return url;
    } catch (error) {
        log('ngrok', `Failed to start ngrok: ${error.message}`, 'red');
        return null;
    }
}

function getOrigin(req) {
  const origin = req.headers.origin;
  // Allow any origin if it's explicitly provided in the request header
  // In a production environment, you would want to restrict this to known origins.
  if (origin) return origin;
  // Fallback to localhost if no origin header is provided (e.g., direct API calls without a browser)
  return 'http://localhost:3001';
}

function send(res, status, data, req) {
  const origin = getOrigin(req);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  });
  res.end(JSON.stringify(data));
}

function handleOptions(res, req) {
  const origin = getOrigin(req);
  res.writeHead(204, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  });
  res.end();
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function verifyToken(req) {
  const auth = req.headers['authorization'];
  console.log('Verify Token: Authorization Header', auth);
  if (!auth || !auth.startsWith('Bearer ')) {
    console.log('Verify Token: No valid Authorization header');
    return null;
  }
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Verify Token: Decoded payload', decoded);
    return decoded;
  } catch (e) {
    console.error('Verify Token: Error verifying token', e);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const method = req.method.trim().toUpperCase();
  const requestPath = parsed.pathname.trim();

  console.log(`Incoming Request: ${method} ${requestPath}`);

  if (method === 'OPTIONS') return handleOptions(res, req);

  // Health check
  if (requestPath === '/health' && method === 'GET') {
    return send(res, 200, { status: 'ok' }, req);
  }

  // Auth register (create admin if none exists)
  if (requestPath === '/auth/register' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.email || !body.password || !body.role) return send(res, 400, { error: 'Missing fields' }, req);
    try {
      const newUserId = uuidv4(); // Generate UUID here
      console.log(`DEBUG: Register - Generated newUserId: ${newUserId}`);

      // 1. Insert user with UUID
      await new Promise((resolve, reject) => {
        const userInsertValues = [newUserId, body.email, body.password, body.role];
        console.log(`DEBUG: Register - Inserting user with values: ${userInsertValues.join(', ')}`);
        db.run('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)', userInsertValues, function(err) {
          if (err) {
            console.error(`ERROR: Register - User insert failed: ${err.message}`);
            return reject(err);
          }
          console.log(`DEBUG: Register - User inserted successfully.`);
          resolve();
        });
      });

      // 2. Create wallet
      const wallet = web3.eth.accounts.create();
      const walletId = wallet.address;
      console.log(`DEBUG: Register - Generated walletId: ${walletId}`);

      // 3. Insert into profiles (not users) using the generated UUID
      await new Promise((resolve, reject) => {
        const profileInsertValues = [newUserId, walletId, body.email, body.role];
        console.log(`DEBUG: Register - Inserting profile with values: ${profileInsertValues.join(', ')}`);
        db.run('INSERT INTO profiles (user_id, wallet_id, email, role) VALUES (?, ?, ?, ?)', profileInsertValues, function(err) {
          if (err) {
            console.error(`ERROR: Register - Profile insert failed: ${err.message}`);
            return reject(err);
          }
          console.log(`DEBUG: Register - Profile inserted successfully.`);
          resolve();
        });
      });

      return send(res, 201, { success: true, userId: newUserId, walletId }, req);
    } catch (e) {
      console.error(`ERROR: Register - Overall registration failed: ${e.message}`);
      return send(res, 400, { error: 'User already exists or DB error', details: e.message }, req);
    }
  }

  // Auth login
  if (requestPath === '/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password, walletId } = body;

    if (!email || !password || !walletId) {
      return send(res, 400, { error: 'Missing email, password, or wallet ID' }, req);
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err || !user) {
        console.log(`Login attempt for ${email}: User not found or DB error.`);
        return send(res, 401, { error: 'Invalid credentials' }, req);
      }
      if (user.password !== password) {
        console.log(`Login attempt for ${email}: Incorrect password.`);
        return send(res, 401, { error: 'Invalid credentials' }, req);
      }

      // Now, verify wallet ID from profiles table
      db.get('SELECT wallet_id FROM profiles WHERE user_id = ?', [user.id], (err, profile) => {
        console.log(`DEBUG: Login - Frontend walletId: ${walletId}`);
        console.log(`DEBUG: Login - User ID: ${user.id}`);
        console.log(`DEBUG: Login - Stored profile.wallet_id: ${profile ? profile.wallet_id : 'N/A'}`);
        if (err || !profile || profile.wallet_id !== walletId) {
          console.log(`Login attempt for ${email}: Wallet ID mismatch or profile not found.`);
          return send(res, 401, { error: 'Invalid wallet ID' }, req);
        }

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
        console.log(`Login successful for ${email}.`);
      return send(res, 200, { token, user: { id: user.id, email: user.email, role: user.role } }, req);
      });
    });
    return;
  }

  // Handle requests for AI Service Token (Admin only)
  if (requestPath === '/auth/service-token' && method === 'POST') {
    // This endpoint should be protected by existing user JWT and require admin role
    const adminTokenPayload = verifyToken(req);
    if (!adminTokenPayload || adminTokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required to generate service token.' }, req);
    }

    try {
      const aiServiceUserId = 'ai-service-user';
      const aiServiceEmail = 'ai-service@blockchain.com';
      const aiServiceRole = 'ai-service';

      // 1. Ensure ai-service user exists in users table
      let aiUser = await allAsync('SELECT * FROM users WHERE id = ?', [aiServiceUserId]);
      if (aiUser.length === 0) {
        console.log('DEBUG: Creating ai-service user in users table...');
        await runAsync('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)', [aiServiceUserId, aiServiceEmail, uuidv4(), aiServiceRole]);
        console.log('DEBUG: ai-service user created.');
      }

      // 2. Ensure ai-service user has a profile with a wallet_id
      let aiProfile = await allAsync('SELECT * FROM profiles WHERE user_id = ?', [aiServiceUserId]);
      let aiWalletId = null;

      // Get available accounts from web3 (Ganache)
      const accounts = await web3.eth.getAccounts();
      console.log('DEBUG: Available Ganache accounts:', accounts);
      if (accounts.length === 0) {
        throw new Error('No Ethereum accounts found. Please ensure Ganache is running and connected.');
      }
      const defaultGanacheAccount = accounts[0];

      if (aiProfile.length === 0) {
        console.log('DEBUG: Creating ai-service profile and wallet with default Ganache account...');
        aiWalletId = defaultGanacheAccount;
        await runAsync('INSERT INTO profiles (user_id, wallet_id, email, role) VALUES (?, ?, ?, ?)', [aiServiceUserId, aiWalletId, aiServiceEmail, aiServiceRole]);
        console.log('DEBUG: ai-service profile with new wallet created.');
      } else if (aiProfile[0].wallet_id !== defaultGanacheAccount) {
        console.log('DEBUG: ai-service profile exists but wallet_id is different. Updating to default Ganache account...');
        aiWalletId = defaultGanacheAccount;
        await runAsync('UPDATE profiles SET wallet_id = ? WHERE user_id = ?', [aiWalletId, aiServiceUserId]);
        console.log('DEBUG: ai-service profile updated with default Ganache wallet.');
      } else {
        aiWalletId = aiProfile[0].wallet_id;
        console.log('DEBUG: Reusing existing ai-service wallet_id (already matches Ganache account):', aiWalletId);
      }

      // Generate a long-lived token for AI services
      const aiServiceToken = jwt.sign(
        { id: aiServiceUserId, email: aiServiceEmail, role: aiServiceRole },
        JWT_SECRET,
        { expiresIn: '100y' } // Token valid for 100 years, practically permanent
      );
      log('Auth', 'AI Service Token generated successfully.', 'green');
      return send(res, 200, { token: aiServiceToken, walletId: aiWalletId }, req); // Also return the walletId
    } catch (e) {
      log('Auth', `Error generating AI Service Token: ${e.message}`, 'red');
      return send(res, 500, { error: 'Failed to generate AI Service Token', details: e.message }, req);
    }
  }

  // Blockchain Info
  if (requestPath === '/api/blockchain/info' && method === 'GET') {
    if (!web3 || !UserRegistry || !CompanyRegistry || !TripRegistry || !ExpenseTracker) {
      console.error('Blockchain API: Web3 or one of the contract instances is not initialized.');
      return send(res, 500, { error: 'Web3 or contract instances not initialized. Check server logs for details.' }, req);
    }
    try {
      const networkId = await web3.eth.net.getId();
      const blockNumber = await web3.eth.getBlockNumber();
      const accounts = await web3.eth.getAccounts();

      const blockchainInfo = {
        nodeInfo: await web3.eth.getNodeInfo(),
        networkId: networkId,
        isListening: await web3.eth.net.isListening(),
        peerCount: await web3.eth.net.getPeerCount(),
        blockNumber: blockNumber,
        gasPrice: await web3.eth.getGasPrice(),
        accounts: accounts,
        coinbase: await web3.eth.getCoinbase(),
        // Example: Get user count from contract if UserRegistry is initialized
        userCount: UserRegistry ? (await UserRegistry.methods.getAllUsers().call()).length : 0,
        contractAddresses: {
          userRegistry: UserRegistry ? UserRegistry.options.address : null,
          companyRegistry: CompanyRegistry ? CompanyRegistry.options.address : null,
          tripRegistry: TripRegistry ? TripRegistry.options.address : null,
          expenseTracker: ExpenseTracker ? ExpenseTracker.options.address : null,
        },
      };
      // Convert BigInt values to string for JSON serialization
      for (const key in blockchainInfo) {
        if (typeof blockchainInfo[key] === 'bigint') {
          blockchainInfo[key] = blockchainInfo[key].toString();
        }
      }
      if (blockchainInfo.gasPrice && typeof blockchainInfo.gasPrice === 'bigint') {
        blockchainInfo.gasPrice = blockchainInfo.gasPrice.toString();
      }

      return send(res, 200, blockchainInfo, req);
    } catch (error) {
      console.error('Blockchain API Error:', error);
      return send(res, 500, { error: 'Failed to fetch blockchain info', details: error.message }, req);
    }
  }

  // Protect all /api routes
  if (requestPath.startsWith('/api/') && !verifyToken(req)) {
    return send(res, 403, { error: 'Forbidden' }, req);
  }

  // Helper to check if user is admin
  function isAdmin(req) {
    const tokenPayload = verifyToken(req);
    console.log('Is Admin Check: Token Payload', tokenPayload);
    console.log('Is Admin Check: User Role', tokenPayload ? tokenPayload.role : 'No Payload');
    return tokenPayload && tokenPayload.role === 'admin';
  }

  // Helper to check if user is an AI Service
  function isAIService(req) {
    const tokenPayload = verifyToken(req);
    console.log('Is AI Service Check: Token Payload', tokenPayload);
    console.log('Is AI Service Check: User Role', tokenPayload ? tokenPayload.role : 'No Payload');
    return tokenPayload && tokenPayload.role === 'ai-service';
  }

  // Generic CRUD for all tables (admin only)
  async function handleCrud(routePrefix, table, req, res) {
    console.log(`handleCrud called for: routePrefix=${routePrefix}, table=${table}`);
    const tokenPayload = verifyToken(req);
    const userRole = tokenPayload ? tokenPayload.role : 'guest';

    // Define tables accessible by non-admin users for read operations
    const userAccessibleTables = ['trips', 'expenses', 'files', 'profiles', 'users', 'trip_reports'];

    // Allow GET access for specific tables for non-admin users
    if (req.method === 'GET' && userAccessibleTables.includes(table) && userRole !== 'admin') {
      // Allow GET access, but filter by user_id if applicable
      let sql = `SELECT * FROM ${table}`;
      let params = [];
      
      if (table === 'trips' || table === 'expenses' || table === 'profiles') {
        sql += ` WHERE user_id = ?`;
        params.push(tokenPayload.id); // Filter by the user's own ID
      } else if (table === 'files') {
        sql += ` WHERE uploaded_by = ?`; // Assuming files are linked by user ID
        params.push(tokenPayload.id);
      }
      
      console.log(`DEBUG: handleCrud GET - User accessible table: ${table}`);
      console.log(`DEBUG: handleCrud GET - SQL: ${sql}, Params: ${JSON.stringify(params)}`);

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error(`ERROR: handleCrud GET for ${table} failed: ${err.message}`);
          return send(res, 500, { error: 'Database error' }, req);
        }
        console.log(`DEBUG: handleCrud GET - Rows found for ${table}: ${rows.length}`);
        console.log(`DEBUG: handleCrud GET - Data for ${table}: ${JSON.stringify(rows)}`);
        return send(res, 200, { [table]: rows }, req);
      });
      return; // Handled, so exit
    }

    // For all other operations (POST, PUT, DELETE) and tables not in userAccessibleTables, require admin
    // EXCEPT: allow AI service to POST to expenses
    const debugIsAdmin = isAdmin(req);
    const debugIsAIService = isAIService(req);
    console.log(`DEBUG: Auth check in handleCrud: isAdmin=${debugIsAdmin}, isAIService=${debugIsAIService}, method=${req.method}, table=${table}`);

    // Allow if admin, OR (AI service POST to expenses), OR (user PUT/PATCH their own expenses)
    if (!debugIsAdmin && !(debugIsAIService && req.method === 'POST' && table === 'expenses') && !((userRole === 'user' && (req.method === 'PUT' || req.method === 'PATCH') && table === 'expenses'))) {
      console.log(`Access denied: User with role ${userRole} attempted ${req.method} on ${table}. Admin required, or AI service for expenses POST, or user for own expense PUT/PATCH.`);
      return send(res, 403, { error: 'Forbidden: Admin access required for this operation or table.' }, req);
    }

    const parsedPath = url.parse(req.url).pathname;
    const parts = parsedPath.split('/').filter(p => p);

    let id = null;
    const routePrefixIndex = parts.indexOf(routePrefix);
    if (routePrefixIndex > -1 && parts.length > routePrefixIndex + 1) {
        id = parts[routePrefixIndex + 1];
    }
    console.log(`handleCrud ID parsed: ${id}`);

    switch (req.method) {
      case 'GET':
        if (id) {
          db.get(`SELECT * FROM ${table} WHERE id = ?`, [id], (err, row) => {
            if (err || !row) return send(res, 404, { error: `${table} not found` }, req);
            return send(res, 200, row, req);
          });
        } else {
          let sql = `SELECT * FROM ${table}`;
          let params = [];

          // Special handling for /api/vendors to only show profiles with role 'vendor'
          if (table === 'profiles' && routePrefix === 'vendors') {
            sql += ` WHERE role = 'vendor'`
          }
          
          console.log(`DEBUG: handleCrud GET (Admin) - SQL: ${sql}, Params: ${JSON.stringify(params)}`);

          db.all(sql, params, (err, rows) => {
            if (err) {
              console.error(`ERROR: handleCrud GET (Admin) for ${table} failed: ${err.message}`);
              return send(res, 500, { error: 'Database error' }, req);
            }
            console.log(`DEBUG: handleCrud GET (Admin) - Rows found for ${table}: ${rows.length}`);
            console.log(`DEBUG: handleCrud GET (Admin) - Data for ${table}: ${JSON.stringify(rows)}`);
            return send(res, 200, { [table]: rows }, req);
          });
        }
        break;
      case 'POST':
        const body = await parseBody(req);
        if (!body || Object.keys(body).length === 0) return send(res, 400, { error: 'Missing body for POST' }, req);

        if (table === 'users') {
          const newUserId = uuidv4(); // Generate UUID for the new user
          const columns = `id, ${Object.keys(body).join(', ')}`; // Include 'id' column
          const placeholders = `?, ${Object.keys(body).map(() => '?').join(', ')}`; // Add placeholder for 'id'
          const values = [newUserId, ...Object.values(body)]; // Prepend UUID to values

          db.run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values, async function(err) {
            if (err) return send(res, 400, { error: `Insert failed: ${err.message}` }, req);
            // Use newUserId directly, as this.lastID is for INTEGER primary keys
            const wallet = web3.eth.accounts.create();
            const walletId = wallet.address;
            const email = body.email;
            const role = body.role || 'user';
            await new Promise((resolve, reject) => {
              db.run('INSERT INTO profiles (user_id, wallet_id, email, role) VALUES (?, ?, ?, ?)', [newUserId, walletId, email, role], function(err) {
                if (err) return reject(err);
                resolve();
              });
            });
            return send(res, 201, { id: newUserId, walletId, success: true }, req);
          });
        } else if (table === 'expenses') {
          console.log('DEBUG: POST /api/expenses - Received body:', body);
          const columns = Object.keys(body).join(', ');
          const placeholders = Object.keys(body).map(() => '?').join(', ');
          const values = Object.values(body);
          console.log(`DEBUG: POST /api/expenses - SQL INSERT columns: (${columns}), placeholders: (${placeholders}), values: ${JSON.stringify(values)}`);

          db.run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values, async function(err) {
            if (err) {
              console.error('ERROR: Database insert failed for expenses:', err.message);
              return send(res, 400, { error: `Insert failed: ${err.message}` }, req);
            }
            console.log('DEBUG: Database insert successful for expenses, lastID:', this.lastID);

            const userId = verifyToken(req).id;
            console.log('DEBUG: Fetching wallet_id for user:', userId);
            db.get('SELECT wallet_id FROM profiles WHERE user_id = ?', [userId], async (err, profile) => {
              if (err || !profile || !profile.wallet_id) {
                const errorMessage = 'User wallet not found for blockchain transaction.';
                console.error('ERROR:', errorMessage, err ? err.message : 'No profile or wallet_id');
                return send(res, 500, { error: errorMessage }, req);
              }

              const userWalletAddress = profile.wallet_id;
              console.log('DEBUG: User wallet address:', userWalletAddress);
              
              const expenseAmount = (body.amount !== null && body.amount !== undefined && !isNaN(parseFloat(body.amount))) ? web3.utils.toWei(body.amount.toString(), 'ether') : web3.utils.toWei('0', 'ether');
              const expenseCategory = body.category || 'Uncategorized';
              const expenseDescription = body.description || '';
              const receiptHash = body.document_id || 'no_receipt_hash';

              // Fetch the first registered company from the local database
              const registeredCompanies = await allAsync('SELECT address FROM companies LIMIT 1');
              let companyAddress = '0x0000000000000000000000000000000000000000'; // Default to zero address if no company found
              if (registeredCompanies.length > 0) {
                  companyAddress = registeredCompanies[0].address;
                  console.log('DEBUG: Using registered company address:', companyAddress);
              } else {
                  console.warn('WARNING: No companies found in local DB. Ensure a company is registered on blockchain and in local DB.');
              }

              const expenseData = {
                expenseAmount: expenseAmount,
                expenseCategory: expenseCategory,
                expenseDescription: expenseDescription,
                receiptHash: receiptHash,
                companyAddress: companyAddress // Use the fetched company address
              };
              console.log('DEBUG: Expense data prepared for blockchain:', expenseData);

              console.log(`DEBUG: expenseAmount value: ${expenseAmount}, type: ${typeof expenseAmount}, parseFloat result: ${parseFloat(expenseAmount)}`);

              // Only attempt blockchain transaction if amount is greater than 0
              if (parseFloat(expenseAmount) > 0) {
                console.log('DEBUG: Attempting blockchain transaction...');
                try {
                  const gasPrice = await web3.eth.getGasPrice();
                  const gasLimit = 500000; // Increased gas limit for potential complexity
                  console.log(`DEBUG: Gas price: ${gasPrice} Gas limit: ${gasLimit}`);

                  const tx = ExpenseTracker.methods.createExpense(
                    expenseData.companyAddress,
                    expenseData.expenseAmount,
                    expenseData.expenseCategory,
                    expenseData.expenseDescription,
                    expenseData.receiptHash
                  );

                  const receipt = await tx.send({
                    from: userWalletAddress,
                    gasPrice: gasPrice,
                    gas: gasLimit,
                  });
                  console.log('DEBUG: Blockchain transaction successful:', receipt.transactionHash);

                  // Update the local database with blockchain transaction details
                  await runAsync('UPDATE expenses SET blockchain_status = ?, blockchain_id = ? WHERE id = ?', [1, receipt.transactionHash, body.id]);
                  console.log('DEBUG: Local database updated with blockchain transaction hash.');

                  send(res, 200, { message: 'Expense added and blockchain transaction successful', expenseId: body.id, transactionHash: receipt.transactionHash }, req);
                } catch (blockchainError) {
                  console.error('ERROR: Error interacting with blockchain for expense:', blockchainError.message);
                  console.error('Blockchain error stack:', blockchainError);

                  // Update local database to reflect blockchain transaction failure
                  await runAsync('UPDATE expenses SET blockchain_status = ? WHERE id = ?', [2, body.id]); // 2 for blockchain failed
                  send(res, 500, { error: 'Failed to record expense on blockchain', details: blockchainError.message }, req);
                }
              } else {
                console.warn('WARNING: Expense amount is 0. Skipping blockchain transaction.');
                // Update local database to reflect blockchain transaction skipped due to zero amount
                await runAsync('UPDATE expenses SET blockchain_status = ? WHERE id = ?', [2, body.id]); // 2 for blockchain skipped/failed
                send(res, 200, { message: 'Expense added to database, blockchain transaction skipped (amount is 0)', expenseId: body.id, transactionHash: null }, req);
              }
            });
          });
        } else if (table === 'trips') {
            const newTripId = uuidv4();
            const newBody = { id: newTripId, ...body };
            const newColumns = Object.keys(newBody).join(', ');
            const newPlaceholders = Object.keys(newBody).map(() => '?').join(', ');
            const newValues = Object.values(newBody);
            console.log('DEBUG: Trips POST - newBody:', newBody);
            console.log('DEBUG: Trips POST - newColumns:', newColumns);
            console.log('DEBUG: Trips POST - newPlaceholders:', newPlaceholders);
            console.log('DEBUG: Trips POST - newValues:', newValues);
            db.run(`INSERT INTO ${table} (${newColumns}) VALUES (${newPlaceholders})`, newValues, function(insertErr) {
              if (insertErr) return send(res, 400, { error: `Insert failed: ${insertErr.message}` }, req);
              
              // DEBUG: Immediately fetch all trips after successful insertion
              db.all(`SELECT * FROM trips`, [], (fetchErr, fetchedTrips) => {
                if (fetchErr) {
                  console.error('DEBUG: Error fetching all trips after POST:', fetchErr);
                } else {
                  console.log(`DEBUG: Trips in DB after POST (${fetchedTrips.length}): ${JSON.stringify(fetchedTrips)}`);
                }
              });

              return send(res, 201, { id: newTripId, success: true }, req);
            });
          } else if (table === 'dashboard') {
            const newDashboardId = body.id || uuidv4(); // Use provided ID or generate new UUID
            const newBody = { id: newDashboardId, ...body };
            const newColumns = Object.keys(newBody).join(', ');
            const newPlaceholders = Object.keys(newBody).map(() => '?').join(', ');
            const newValues = Object.values(newBody);
            db.run(`INSERT INTO ${table} (${newColumns}) VALUES (${newPlaceholders})`, newValues, function(insertErr) {
              if (insertErr) return send(res, 400, { error: `Insert failed: ${insertErr.message}` }, req);
              return send(res, 201, { id: newDashboardId, success: true }, req);
            });
          } else if (table === 'trip_reports') {
            const newReportId = uuidv4();
            const createdByUserId = verifyToken(req).id; // Get user ID from token
            if (!createdByUserId || userRole !== 'admin') {
              return send(res, 403, { error: 'Forbidden: Only admins can create trip reports.' }, req);
            }
            const newBody = { id: newReportId, ...body, created_by_user_id: createdByUserId };

            // Calculate total_expenses_amount for the report from associated trip expenses
            let totalExpensesAmount = 0;
            if (newBody.trip_id) {
              try {
                const tripExpenses = await allAsync('SELECT amount FROM expenses WHERE trip_id = ?', [newBody.trip_id]);
                totalExpensesAmount = tripExpenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
                newBody.total_expenses_amount = totalExpensesAmount;
              } catch (e) {
                console.error(`ERROR: Failed to calculate total expenses for trip ${newBody.trip_id}: ${e.message}`);
                // Proceed without total_expenses_amount if calculation fails
              }
            }

            const newColumns = Object.keys(newBody).join(', ');
            const newPlaceholders = Object.keys(newBody).map(() => '?').join(', ');
            const newValues = Object.values(newBody);
            db.run(`INSERT INTO ${table} (${newColumns}) VALUES (${newPlaceholders})`, newValues, function(insertErr) {
              if (insertErr) return send(res, 400, { error: `Insert failed: ${insertErr.message}` }, req);
              return send(res, 201, { id: newReportId, success: true, total_expenses_amount: totalExpensesAmount }, req);
            });
          } else {
            // Generic handling for other tables if needed
            const columns = Object.keys(body).join(', ');
            const placeholders = Object.keys(body).map(() => '?').join(', ');
            const values = Object.values(body);
            db.run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values, function(err) {
                if (err) return send(res, 400, { error: `Insert failed: ${err.message}` }, req);
                return send(res, 201, { id: this.lastID, success: true }, req);
            });
          }
        break;
      case 'PUT':
        if (!id) return send(res, 400, { error: 'Missing ID for PUT' }, req);
        const putBody = await parseBody(req);
        if (!putBody || Object.keys(putBody).length === 0) return send(res, 400, { error: 'Missing body for PUT' }, req);
        
        // Retrieve the user_id of the record to be updated to ensure ownership, only for relevant tables
        if (table === 'expenses') { // Apply this check only for the 'expenses' table
          console.log(`DEBUG: Inside user ownership check for PUT/PATCH. Table: ${table}, Condition (table === 'expenses'): ${table === 'expenses'}`);
          const existingRecord = await new Promise((resolve, reject) => {
            db.get(`SELECT user_id FROM ${table} WHERE id = ?`, [id], (err, row) => {
              if (err) return reject(err);
              resolve(row);
            });
          });

          if (!existingRecord) {
            return send(res, 404, { error: `${table} not found` }, req);
          }

          // Check if the current user is the owner of the record or an admin
          const userIdFromToken = verifyToken(req).id;
          if (existingRecord.user_id !== userIdFromToken && userRole !== 'admin') {
            console.log(`Access denied: User ${userIdFromToken} attempted to update ${table} ${id} owned by ${existingRecord.user_id}. Not admin.`);
            return send(res, 403, { error: `Forbidden: You can only edit your own ${table} records.` }, req);
          }
        }

        const setClause = Object.keys(putBody).map(k => `${k} = ?`).join(', ');
        const putValues = [...Object.values(putBody), id];
        db.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, putValues, async function(err) {
          if (err) return send(res, 400, { error: `Update failed: ${err.message}` }, req);
          
          // Special handling for users table to update the 'role' in the profiles table as well
          if (table === 'users' && putBody.role) {
            try {
              await runAsync('UPDATE profiles SET role = ? WHERE user_id = ?', [putBody.role, id]);
              console.log(`Updated role for user_id ${id} in profiles table to ${putBody.role}`);
            } catch (profileErr) {
              console.error(`Failed to update profile role for user_id ${id}: ${profileErr.message}`);
              // Do not send 500 error for profile update failure, as the main user update was successful.
            }
          }

          return send(res, 200, { success: true }, req);
        });
        break;
      case 'PATCH': // Add PATCH case to mirror PUT logic
        if (!id) return send(res, 400, { error: 'Missing ID for PATCH' }, req);
        const patchBody = await parseBody(req);
        if (!patchBody || Object.keys(patchBody).length === 0) return send(res, 400, { error: 'Missing body for PATCH' }, req);

        // Retrieve the user_id of the record to be updated to ensure ownership, only for relevant tables
        if (table === 'expenses') { // Apply this check only for the 'expenses' table
          console.log(`DEBUG: Inside user ownership check for PUT/PATCH. Table: ${table}, Condition (table === 'expenses'): ${table === 'expenses'}`);
          const existingRecord = await new Promise((resolve, reject) => {
            db.get(`SELECT user_id FROM ${table} WHERE id = ?`, [id], (err, row) => {
              if (err) return reject(err);
              resolve(row);
            });
          });

          if (!existingRecord) {
            return send(res, 404, { error: `${table} not found` }, req);
          }

          // Check if the current user is the owner of the record or an admin
          const userIdFromToken = verifyToken(req).id;
          if (existingRecord.user_id !== userIdFromToken && userRole !== 'admin') {
            console.log(`Access denied: User ${userIdFromToken} attempted to update ${table} ${id} owned by ${existingRecord.user_id}. Not admin.`);
            return send(res, 403, { error: `Forbidden: You can only edit your own ${table} records.` }, req);
          }
        } else if (table === 'trip_reports') {
          // Admins can edit trip reports. If trip_id is updated, recalculate total expenses.
          if (patchBody.trip_id) {
            try {
              const tripExpenses = await allAsync('SELECT amount FROM expenses WHERE trip_id = ?', [patchBody.trip_id]);
              patchBody.total_expenses_amount = tripExpenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
            } catch (e) {
              console.error(`ERROR: Failed to recalculate total expenses for trip ${patchBody.trip_id} during PATCH: ${e.message}`);
            }
          }
          // Prevent created_by_user_id from being updated
          delete patchBody.created_by_user_id;
        }

        const patchSetClause = Object.keys(patchBody).map(k => `${k} = ?`).join(', ');
        const patchValues = [...Object.values(patchBody), id];
        db.run(`UPDATE ${table} SET ${patchSetClause} WHERE id = ?`, patchValues, async function(err) {
          if (err) return send(res, 400, { error: `Update failed: ${err.message}` }, req);
          
          // Special handling for users table to update the 'role' in the profiles table as well
          if (table === 'users' && patchBody.role) {
            try {
              await runAsync('UPDATE profiles SET role = ? WHERE user_id = ?', [patchBody.role, id]);
              console.log(`Updated role for user_id ${id} in profiles table to ${patchBody.role}`);
            } catch (profileErr) {
              console.error(`Failed to update profile role for user_id ${id}: ${profileErr.message}`);
              // Do not send 500 error for profile update failure, as the main user update was successful.
            }
          }

          return send(res, 200, { success: true }, req);
        });
        break;
      case 'DELETE':
        if (!id) return send(res, 400, { error: 'Missing ID for DELETE' }, req);
        db.run(`DELETE FROM ${table} WHERE id = ?`, [id], function(err) {
          if (err) return send(res, 400, { error: `Delete failed: ${err.message}` }, req);
          return send(res, 200, { success: true }, req);
        });
        break;
      default:
        send(res, 405, { error: 'Method not allowed' }, req);
    }
  }

  // --- FILE STORAGE BUCKET ENDPOINTS (admin only) ---
  // GET /api/files/buckets
  if (requestPath === '/api/files/buckets' && method === 'GET') {
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    const uploadsDir = path.join(__dirname, 'uploads');
    fs.readdir(uploadsDir, { withFileTypes: true }, (err, dirents) => {
      if (err) return send(res, 500, { error: 'Failed to read uploads directory' }, req);
      const buckets = dirents.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
      return send(res, 200, { buckets }, req);
    });
    return;
  }

  // --- RESTful FILES ENDPOINTS (admin only) ---
  // GET /api/files
  if (requestPath.startsWith('/api/files') && method === 'GET') {
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    const urlObj = url.parse(req.url, true);
    const bucket = urlObj.query.bucket;
    let sql = 'SELECT * FROM files';
    let params = [];
    if (bucket) {
      sql += ' WHERE json_extract(metadata, "$.bucket") = ?';
      params.push(bucket);
    }
    db.all(sql, params, (err, rows) => {
      if (err) return send(res, 500, { error: 'Database error' }, req);
      return send(res, 200, { files: rows }, req);
    });
    return;
  }
  // POST /api/files (multipart upload)
  if (requestPath === '/api/files' && method === 'POST') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload) {
      return send(res, 401, { error: 'Unauthorized: No token provided or invalid token.' }, req);
    }
    const userId = tokenPayload.id; // Get the user ID from the token

    const form = new formidable.IncomingForm({ multiples: false, uploadDir: path.join(__dirname, 'uploads'), keepExtensions: true });
    form.parse(req, (err, fields, filesObj) => {
      console.log('DEBUG fields:', fields);
      console.log('DEBUG filesObj:', filesObj);
      let file = filesObj.file;
      if (Array.isArray(file)) {
        file = file[0];
      }
      if (!file && filesObj && Object.keys(filesObj).length > 0) {
        file = filesObj[Object.keys(filesObj)[0]];
        if (Array.isArray(file)) file = file[0];
        console.log('DEBUG fallback file:', file);
      }
      if (err) return send(res, 400, { error: 'File upload failed', details: err.message }, req);
      if (!file) return send(res, 400, { error: 'No file uploaded' }, req);
      // Ensure values are strings, not arrays, and not undefined
      const bucket = Array.isArray(fields.bucket) ? fields.bucket[0] : fields.bucket || 'data-storage';
      const originalFilename = Array.isArray(file.originalFilename) ? file.originalFilename[0] : file.originalFilename;
      const filepath = Array.isArray(file.filepath) ? file.filepath[0] : file.filepath;
      if (!bucket || !originalFilename || !filepath) {
        return send(res, 400, { error: 'Missing file or bucket information' }, req);
      }
      const bucketPath = path.join(__dirname, 'uploads', bucket);
      if (!fs.existsSync(bucketPath)) fs.mkdirSync(bucketPath, { recursive: true });
      const destPath = path.join(bucketPath, originalFilename);
      fs.renameSync(filepath, destPath);
      console.log('[UPLOAD] Saved file to:', destPath);
      db.run('INSERT INTO files (name, size, mimetype, uploaded_by, metadata) VALUES (?, ?, ?, ?, ?)', [originalFilename, file.size, file.mimetype, userId, JSON.stringify({ bucket })], function(err) {
        if (err) return send(res, 500, { error: 'Failed to save file to DB', details: err.message }, req);
        // Return the new file's ID and filename
        return send(res, 201, { success: true, id: this.lastID, filename: originalFilename }, req);
      });
    });
    return;
  }

  // GET /api/files/:id (download)
  const fileIdMatch = requestPath.match(/^\/api\/files\/(\d+)$/);
  if (fileIdMatch && method === 'GET') {
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    const fileId = fileIdMatch[1];
    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
      if (err || !file) return send(res, 404, { error: 'File not found' }, req);
      const bucket = (JSON.parse(file.metadata || '{}').bucket) || 'data-storage';
      const filePath = path.join(__dirname, 'uploads', bucket, file.name);
      if (!fs.existsSync(filePath)) return send(res, 404, { error: 'File not found on disk' }, req);
      res.writeHead(200, {
        'Content-Type': file.mimetype,
        'Content-Disposition': `attachment; filename="${file.name}"`,
        'Access-Control-Allow-Origin': getOrigin(req),
        'Access-Control-Allow-Credentials': 'true',
      });
      fs.createReadStream(filePath).pipe(res);
    });
    return;
  }

  // DELETE /api/files/:id
  if (fileIdMatch && method === 'DELETE') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload) {
      return send(res, 401, { error: 'Unauthorized: No token provided or invalid token.' }, req);
    }
    const userId = tokenPayload.id; // Get the user ID from the token

    const fileId = fileIdMatch[1];
    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
      if (err) {
        console.error(`ERROR: Failed to fetch file for deletion: ${err.message}`);
        return send(res, 500, { error: 'Database error' }, req);
      }
      if (!file) {
        return send(res, 404, { error: 'File not found' }, req);
      }

      console.log(`DEBUG: Delete File - file.uploaded_by: ${file.uploaded_by}, type: ${typeof file.uploaded_by}`);
      console.log(`DEBUG: Delete File - userId from token: ${userId}, type: ${typeof userId}`);
      console.log(`DEBUG: Delete File - user role: ${tokenPayload.role}`);

      // Check if the user is authorized to delete this file (either admin or the uploader)
      if (tokenPayload.role !== 'admin' && file.uploaded_by !== userId) {
        return send(res, 403, { error: 'Forbidden: You can only delete files you have uploaded.' }, req);
      }

      const bucket = (JSON.parse(file.metadata || '{}').bucket) || 'data-storage';
      const filePath = path.join(__dirname, 'uploads', bucket, file.name);
      // Delete file from disk
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      // Delete file entry from database
      db.run('DELETE FROM files WHERE id = ?', [fileId], function(err) {
        if (err) return send(res, 500, { error: 'Failed to delete file from DB', details: err.message }, req);
        return send(res, 200, { success: true, message: 'File deleted successfully' }, req);
      });
    });
    return;
  }

  // --- FILE UPLOAD ENDPOINT (admin only) ---
  if (requestPath === '/api/files/upload' && method === 'POST') {
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    // For demo: expects JSON body with { filename, content (base64), mimetype, bucket }
    const body = await parseBody(req);
    const { filename, content, mimetype, bucket } = body;
    if (!filename || !content || !bucket) return send(res, 400, { error: 'Missing fields' }, req);
    const allowedBuckets = ['data-storage', 'images', 'web-frontend'];
    const bucketPath = path.join(__dirname, 'uploads', bucket);
    if (!allowedBuckets.includes(bucket) || !fs.existsSync(bucketPath)) return send(res, 400, { error: 'Invalid bucket' }, req);
    const filePath = path.join(bucketPath, filename);
    fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
    db.run('INSERT INTO files (name, size, mimetype, uploaded_by, metadata) VALUES (?, ?, ?, ?, ?)', [filename, Buffer.from(content, 'base64').length, mimetype, 1, JSON.stringify({ bucket })]);
    return send(res, 201, { success: true, filename }, req);
  }

  // --- CREATE NEW TABLE (admin only) ---
  if (requestPath === '/api/admin/create-table' && method === 'POST') {
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    const body = await parseBody(req);
    if (!body.sql) return send(res, 400, { error: 'Missing sql' }, req);
    db.run(body.sql, [], function(err) {
      if (err) return send(res, 400, { error: 'Table creation failed', details: err.message }, req);
      return send(res, 201, { success: true }, req);
    });
    return;
  }

  // --- CREATE NEW BUCKET (admin only) ---
  if (requestPath === '/api/admin/create-bucket' && method === 'POST') {
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    const body = await parseBody(req);
    if (!body.bucket) return send(res, 400, { error: 'Missing bucket' }, req);
    const bucketPath = path.join(__dirname, 'uploads', body.bucket);
    if (!fs.existsSync(bucketPath)) {
      fs.mkdirSync(bucketPath, { recursive: true });
      return send(res, 201, { success: true, bucket: body.bucket }, req);
    } else {
      return send(res, 400, { error: 'Bucket already exists' }, req);
    }
  }

  // DB inspection endpoints
  if (requestPath === '/api/db/tables' && method === 'GET') {
    try {
      const tables = await allAsync("SELECT name FROM sqlite_master WHERE type='table';");
      return send(res, 200, { tables: tables.map(t => t.name) }, req);
    } catch (e) {
      console.error('Error fetching tables:', e);
      return send(res, 500, { error: 'Failed to fetch tables', details: e.message }, req);
    }
  }

  if (requestPath === '/api/db/relationships' && method === 'GET') {
    try {
      const tables = await allAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      const relationships = [];

      for (const tableObj of tables) {
        const tableName = tableObj.name;
        const foreignKeys = await allAsync(`PRAGMA foreign_key_list(${tableName});`);
        for (const fk of foreignKeys) {
          relationships.push({
            from_table: tableName,
            to_table: fk.table,
            type: 'many-to-one', // SQLite foreign keys typically represent many-to-one or one-to-one
            on: `${fk.from} -> ${fk.to}` // Format: from_column -> to_column
          });
        }
      }
      return send(res, 200, { relationships }, req);
    } catch (e) {
      console.error('Error fetching database relationships:', e);
      return send(res, 500, { error: 'Failed to fetch database relationships', details: e.message }, req);
    }
  }

  if (requestPath.startsWith('/api/db/') && method === 'GET') {
    const parts = requestPath.split('/');
    const tableName = parts[3]; // e.g., /api/db/users -> users
    if (!tableName) {
      return send(res, 400, { error: 'Table name missing' }, req);
    }
    
    // Check if it's a schema request
    if (parts[4] === 'schema') {
      try {
        const schema = await allAsync(`PRAGMA table_info(${tableName});`);
        return send(res, 200, { schema }, req);
      } catch (e) {
        console.error(`Error fetching schema for ${tableName}:`, e);
        return send(res, 500, { error: `Failed to fetch schema for ${tableName}`, details: e.message }, req);
      }
    } else {
      // It's a data request
      try {
        const data = await allAsync(`SELECT * FROM ${tableName};`);
        return send(res, 200, { data }, req);
      } catch (e) {
        console.error(`Error fetching data for ${tableName}:`, e);
        return send(res, 500, { error: `Failed to fetch data for ${tableName}`, details: e.message }, req);
      }
    }
  }

  // User Dashboard Summary
  if (requestPath === '/api/dashboard/user-summary' && method === 'GET') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload) {
      return send(res, 403, { error: 'Forbidden' }, req);
    }
    const userId = tokenPayload.id;

    try {
      const expenditureData = await new Promise((resolve, reject) => {
        db.get(`SELECT SUM(amount) AS totalExpenditure FROM expenses WHERE user_id = ?`, [userId], (err, row) => {
          if (err) return reject(err);
          resolve(row.totalExpenditure || 0);
        });
      });

      const projectData = await new Promise((resolve, reject) => {
        db.get(`SELECT SUM(budget) AS totalBudget, COUNT(id) AS activeProjects FROM trips WHERE user_id = ? AND status = 'active'`, [userId], (err, row) => {
          if (err) return reject(err);
          resolve({
            totalBudget: row.totalBudget || 0,
            activeProjects: row.activeProjects || 0
          });
        });
      });

      const vendorData = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(DISTINCT vendor_name) AS distinctVendors FROM expenses WHERE user_id = ?`, [userId], (err, row) => {
          if (err) return reject(err);
          resolve(row.distinctVendors || 0);
        });
      });

      const auditSyncData = await new Promise((resolve, reject) => {
        db.all(`SELECT COUNT(id) AS count, blockchain_status FROM expenses WHERE user_id = ? GROUP BY blockchain_status`, [userId], (err, rows) => {
          if (err) return reject(err);
          const totalExpenses = rows.reduce((sum, row) => sum + row.count, 0);
          const blockchainSynced = rows.find(row => row.blockchain_status === 1)?.count || 0;
          const auditSyncRate = totalExpenses > 0 ? (blockchainSynced / totalExpenses) * 100 : 0;
          resolve(auditSyncRate);
        });
      });

      const expenseGraphData = await new Promise((resolve, reject) => {
        db.all(`SELECT SUM(amount) AS monthlyAmount, STRFTIME('%Y-%m', transaction_date) AS month FROM expenses WHERE user_id = ? GROUP BY month ORDER BY month`, [userId], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });

      const dashboardSummary = {
        currentExpenditure: expenditureData,
        budget: projectData.totalBudget,
        vendors: vendorData,
        auditSyncRate: auditSyncData,
        activeProjects: projectData.activeProjects,
        expenditureGraph: expenseGraphData
      };

      return send(res, 200, dashboardSummary, req);

    } catch (e) {
      console.error('Error fetching user dashboard summary:', e);
      return send(res, 500, { error: 'Failed to fetch user dashboard summary', details: e.message }, req);
    }
  }

 // Get Expenses by Email (works for all roles, but users can only query their own expenses)
 if (requestPath === '/api/expenses/by-email' && method === 'POST') {
  const tokenPayload = verifyToken(req);
  if (!tokenPayload) {
    return send(res, 403, { error: 'Forbidden' }, req);
  }

  const body = await parseBody(req);
  let targetEmail = body.email;

  // Security check: If the user is not an admin, they can only query their own expenses.
  // Overwrite targetEmail with the authenticated user's email from the token.
  if (tokenPayload.role !== 'admin') {
    targetEmail = tokenPayload.email;
    console.log(`DEBUG: Non-admin user (${tokenPayload.email}) attempted to query expenses by email. Forcing query to their own email.`);
  }

  if (!targetEmail) {
    return send(res, 400, { error: 'Missing email in request body' }, req);
  }

  try {
    const user = await new Promise((resolve, reject) => {
      db.get(`SELECT id FROM users WHERE email = ?`, [targetEmail], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (!user) {
      return send(res, 404, { error: 'User not found' }, req);
    }

    const expenses = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM expenses WHERE user_id = ? ORDER BY transaction_date DESC`, [user.id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
    return send(res, 200, { expenses }, req);

  } catch (e) {
    console.error('Error fetching expenses by email:', e);
    return send(res, 500, { error: 'Failed to fetch expenses by email', details: e.message }, req);
  }
}

  // Generic CRUD routes
  const crudMatch = requestPath.match(/^\/api\/(users|profiles|expenses|trips|files|vendors|receipt_fraud_checks|vector_db_documents|project_members|dashboard|trip_reports)(\/?.*)$/);
  if (crudMatch) {
    const table = crudMatch[1];
    const routePrefix = crudMatch[1]; // Use the matched table name as routePrefix
    // Special handling for the vendors route to map to profiles table
    if (table === 'vendors') {
      return handleCrud(routePrefix, 'profiles', req, res);
    }
    return handleCrud(routePrefix, table, req, res);
  }

  

  // Admin Dashboard Summary
  if (requestPath === '/api/dashboard/admin-summary' && method === 'GET') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }

    try {
      const pendingApprovals = await new Promise((resolve, reject) => {
        // Assuming 'status' in 'expenses' table tracks approval. Example: 'pending'
        db.get(`SELECT COUNT(id) AS count FROM expenses WHERE status = 'pending'`, [], (err, row) => {
          if (err) return reject(err);
          resolve(row.count || 0);
        });
      });

      const rejectedRequests = await new Promise((resolve, reject) => {
        // Assuming 'status' in 'expenses' table tracks rejection. Example: 'rejected'
        db.get(`SELECT COUNT(id) AS count FROM expenses WHERE status = 'rejected'`, [], (err, row) => {
          if (err) return reject(err);
          resolve(row.count || 0);
        });
      });

      const unverifiedVendors = await new Promise((resolve, reject) => {
        // Assuming 'vendors' are in 'profiles' table with role 'vendor' and a 'verified' status.
        // If 'vendors' are in a separate table, adjust query accordingly.
        // For now, assuming a 'verified' column in 'profiles' for vendors.
        db.get(`SELECT COUNT(id) AS count FROM profiles WHERE role = 'vendor' AND (status IS NULL OR status != 'verified')`, [], (err, row) => {
          if (err) return reject(err);
          resolve(row.count || 0);
        });
      });

      const overallExpenditureGraphData = await new Promise((resolve, reject) => {
        db.all(`SELECT SUM(amount) AS monthlyAmount, STRFTIME('%Y-%m', transaction_date) AS month FROM expenses GROUP BY month ORDER BY month`, [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });

      // Placeholder for High Priority Expenses - requires definition
      const highPriorityExpenses = 0; // To be implemented based on new column/logic

      const adminDashboardSummary = {
        pendingApprovals,
        rejectedRequests,
        unverifiedVendors,
        overallExpenditureGraph: overallExpenditureGraphData,
        highPriorityExpenses
      };

      return send(res, 200, adminDashboardSummary, req);

    } catch (e) {
      console.error('Error fetching admin dashboard summary:', e);
      return send(res, 500, { error: 'Failed to fetch admin dashboard summary', details: e.message }, req);
    }
  }

  // Expense Approval
  const approveExpenseMatch = requestPath.match(/^\/api\/expenses\/(\d+)\/approve$/);
  if (approveExpenseMatch && method === 'POST') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }
    const expenseId = approveExpenseMatch[1];

    try {
      const expense = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM expenses WHERE id = ?`, [expenseId], (err, row) => {
          if (err) return reject(err);
          if (!row) return reject(new Error('Expense not found'));
          resolve(row);
        });
      });

      if (expense.blockchain_status === 1) {
        return send(res, 400, { error: 'Expense already on blockchain.' }, req);
      }

      // Get admin's wallet ID
      const adminProfile = await new Promise((resolve, reject) => {
        db.get(`SELECT wallet_id FROM profiles WHERE user_id = ?`, [tokenPayload.id], (err, profile) => {
          if (err) return reject(err);
          if (!profile || !profile.wallet_id) return reject(new Error('Admin wallet not found.'));
          resolve(profile);
        });
      });

      if (!ExpenseTracker) {
        return send(res, 500, { error: 'ExpenseTracker contract not initialized.' }, req);
      }
      const gasPrice = await web3.eth.getGasPrice();
      const gasLimit = 500000; // Adjust as needed

      const tx = await ExpenseTracker.methods.approveExpense(expenseId).send({ from: adminProfile.wallet_id, gasPrice, gas: gasLimit });
      const blockchainId = tx.transactionHash;

          await new Promise((resolve, reject) => {
        db.run(`UPDATE expenses SET status = 'approved', blockchain_status = 2, blockchain_id = ? WHERE id = ?`, [blockchainId, expenseId], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      return send(res, 200, { success: true, message: 'Expense approved and recorded on blockchain.', blockchainId }, req);

    } catch (e) {
      console.error('Error approving expense:', e);
      return send(res, 500, { error: 'Failed to approve expense', details: e.message }, req);
    }
  }

  // Expense Rejection
  const rejectExpenseMatch = requestPath.match(/^\/api\/expenses\/(\d+)\/reject$/);
  if (rejectExpenseMatch && method === 'POST') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }
    const expenseId = rejectExpenseMatch[1];

    try {
      await new Promise((resolve, reject) => {
        db.run(`UPDATE expenses SET status = 'rejected' WHERE id = ?`, [expenseId], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      return send(res, 200, { success: true, message: 'Expense rejected.' }, req);
    } catch (e) {
      console.error('Error rejecting expense:', e);
      return send(res, 500, { error: 'Failed to reject expense', details: e.message }, req);
    }
  }

  // Expense Flagging
  const flagExpenseMatch = requestPath.match(/^\/api\/expenses\/(\d+)\/flag$/);
  if (flagExpenseMatch && method === 'POST') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }
    const expenseId = flagExpenseMatch[1];

    try {
      // For flagging, we can set a specific status or add a flag column
      // For now, let's set the status to 'flagged'
      await new Promise((resolve, reject) => {
        db.run(`UPDATE expenses SET status = 'flagged' WHERE id = ?`, [expenseId], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      return send(res, 200, { success: true, message: 'Expense flagged for review.' }, req);
    } catch (e) {
      console.error('Error flagging expense:', e);
      return send(res, 500, { error: 'Failed to flag expense', details: e.message }, req);
    }
  }

  // User Reports
  if (requestPath === '/api/reports/user' && method === 'GET') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload) {
      return send(res, 403, { error: 'Forbidden' }, req);
    }
    const userId = tokenPayload.id;

    try {
      const expenses = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM expenses WHERE user_id = ? ORDER BY transaction_date DESC`, [userId], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      return send(res, 200, { expenses }, req);
    } catch (e) {
      console.error('Error fetching user reports:', e);
      return send(res, 500, { error: 'Failed to fetch user reports', details: e.message }, req);
    }
  }

  // Admin Reports
  if (requestPath === '/api/reports/admin' && method === 'GET') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }

    try {
      const allExpenses = await new Promise((resolve, reject) => {
        db.all(`SELECT e.*, p.email AS user_email FROM expenses e JOIN profiles p ON e.user_id = p.user_id ORDER BY e.transaction_date DESC`, [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
      });
    });
      return send(res, 200, { expenses: allExpenses }, req);
    } catch (e) {
      console.error('Error fetching admin reports:', e);
      return send(res, 500, { error: 'Failed to fetch admin reports', details: e.message }, req);
    }
  }

  // Get Project Team Members
  const getProjectMembersMatch = requestPath.match(/^\/api\/trips\/([a-zA-Z0-9_]+)\/members$/);
  if (getProjectMembersMatch && method === 'GET') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }
    const tripId = getProjectMembersMatch[1];

    try {
      const members = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            pm.user_id, 
            pm.role AS project_role, 
            u.email AS user_email, 
            p.wallet_id
          FROM project_members pm
          JOIN users u ON pm.user_id = u.id
          JOIN profiles p ON pm.user_id = p.user_id
          WHERE pm.project_id = ?
        `, [tripId], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      return send(res, 200, { members }, req);
    } catch (e) {
      console.error('Error fetching project members:', e);
      return send(res, 500, { error: 'Failed to fetch project members', details: e.message }, req);
    }
  }

  // Get Individual Team Member Expenses within a Project
  const getTeamMemberExpensesMatch = requestPath.match(/^\/api\/trips\/([a-zA-Z0-9_]+)\/members\/(\d+)\/expenses$/);
  if (getTeamMemberExpensesMatch && method === 'GET') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }
    const tripId = getTeamMemberExpensesMatch[1];
    const userId = getTeamMemberExpensesMatch[2];

    try {
      const expenses = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM expenses WHERE trip_id = ? AND user_id = ? ORDER BY transaction_date DESC`, [tripId, userId], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      return send(res, 200, { expenses }, req);
    } catch (e) {
      console.error('Error fetching team member expenses for project:', e);
      return send(res, 500, { error: 'Failed to fetch team member expenses for project', details: e.message }, req);
    }
  }

  // Delete Project Member
  const deleteProjectMemberMatch = requestPath.match(/^\/api\/trips\/([a-zA-Z0-9_]+)\/members\/(\d+)$/);
  if (deleteProjectMemberMatch && method === 'DELETE') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }
    const tripId = deleteProjectMemberMatch[1];
    const userId = deleteProjectMemberMatch[2];

    try {
      await new Promise((resolve, reject) => {
        db.run(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [tripId, userId], function(err) {
          if (err) return reject(err);
          if (this.changes === 0) return reject(new Error('Project member not found or not removed.'));
          resolve();
        });
      });
      return send(res, 200, { success: true, message: 'Project member removed successfully.' }, req);
    } catch (e) {
      console.error('Error deleting project member:', e);
      return send(res, 500, { error: 'Failed to delete project member', details: e.message }, req);
    }
  }

  // Add Project Member (create new project_members entry)
  const addProjectMemberMatch = requestPath.match(/^\/api\/trips\/([a-zA-Z0-9_]+)\/members$/);
  if (addProjectMemberMatch && method === 'POST') {
    const tokenPayload = verifyToken(req);
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }
    const tripId = addProjectMemberMatch[1];
    const body = await parseBody(req);
    const { userId, role } = body; // Expecting userId and optional role in the request body

    if (!userId) {
      return send(res, 400, { error: 'Missing user ID for adding project member.' }, req);
    }

    try {
      // Check if the user exists and the trip exists (optional, but good practice)
      const userExists = await new Promise((resolve) => {
        db.get(`SELECT id FROM users WHERE id = ?`, [userId], (err, row) => {
          resolve(!!row);
        });
      });
      if (!userExists) {
        return send(res, 404, { error: 'User not found.' }, req);
      }

      const tripExists = await new Promise((resolve) => {
        db.get(`SELECT id FROM trips WHERE id = ?`, [tripId], (err, row) => {
          resolve(!!row);
        });
      });
      if (!tripExists) {
        return send(res, 404, { error: 'Trip not found.' }, req);
      }

      // Insert into project_members table
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
          [tripId, userId, role || 'member'],
          function(err) {
            if (err) {
              if (err.code === 'SQLITE_CONSTRAINT') {
                return reject(new Error('User is already a member of this project.'));
              }
              return reject(err);
            }
            resolve(this.lastID);
          }
        );
      });
      return send(res, 201, { success: true, message: 'Project member added successfully.' }, req);

    } catch (e) {
      console.error('Error adding project member:', e);
      return send(res, 500, { error: 'Failed to add project member', details: e.message }, req);
    }
  }

  // Get User ID by Email (Admin only)
  if (requestPath === '/api/users/by-email' && method === 'GET') {
    const authPayload = verifyToken(req);
    if (!authPayload || authPayload.role !== 'admin') {
      return send(res, 403, { error: 'Forbidden: Admin access required.' }, req);
    }
    const email = parsed.query.email;
    if (!email) {
      return send(res, 400, { error: 'Missing email query parameter.' }, req);
    }

    db.get(`SELECT id FROM users WHERE email = ?`, [email], (err, row) => {
      if (err) {
        console.error(`Error fetching user by email ${email}:`, err);
        return send(res, 500, { error: 'Database error' }, req);
      }
      if (!row) {
        return send(res, 404, { error: 'User not found' }, req);
      }
      return send(res, 200, { userId: row.id }, req);
    });
    return;
  }

  // API to get user ID by email (Admin only)
  if (requestPath === '/api/users/id-by-email' && method === 'POST') {
    if (!isAdmin(req)) {
      return send(res, 403, { error: 'Forbidden: Admin access required to get user ID by email.' }, req);
    }
    const body = await parseBody(req);
    const { email } = body;

    console.log(`DEBUG: getUserIdByEmail - Request body: ${JSON.stringify(body)}`);

    if (!email) {
      return send(res, 400, { error: 'Missing email in request body' }, req);
    }

    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error(`ERROR: Failed to fetch user ID by email: ${err.message}`);
        return send(res, 500, { error: 'Database error' }, req);
      }
      if (!row) {
        return send(res, 404, { error: 'User not found' }, req);
      }
      return send(res, 200, { userId: row.id }, req);
    });
    return;
  }

  // Serve static files from the uploads directory
  if (requestPath.startsWith('/uploads/')) {
    const decodedRequestPath = decodeURIComponent(requestPath);
    const filePath = path.join(__dirname, decodedRequestPath);
    console.log(`Attempting to serve static file: ${filePath}`);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error(`Error serving static file ${filePath}: ${err.message}`);
        return send(res, 404, { error: 'File not found' }, req);
      }
      const contentType = MimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': getOrigin(req),
        'Access-Control-Allow-Credentials': 'true',
      });
      res.end(data);
    });
    return;
  }

  // No route matched
  console.log(`No route matched for: ${method} ${requestPath}. Sending 404.`);
  send(res, 404, { error: 'Not found' }, req);
});

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeDatabase();
  // Start ngrok only if authtoken is provided
  if (process.env.NGROK_AUTHTOKEN) {
    log('ngrok', 'Starting ngrok...', 'magenta');
    await startNgrok(PORT);
  }
});
