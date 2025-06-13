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

// Ensure users table exists
const USERS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT
);`;
db.run(USERS_TABLE_SQL, () => {
  // Insert default admin if not exists
  db.get('SELECT * FROM users WHERE email = ?', ['admin@blockchain.com'], async (err, user) => {
    if (!user) {
      // Insert admin user
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', ['admin@blockchain.com', 'admin123', 'admin'], function(err) {
          if (err) return reject(err);
          const userId = this.lastID;
          // Create wallet
          const wallet = web3.eth.accounts.create();
          const walletId = wallet.address;
          // Insert into profiles (not users)
          db.run('INSERT INTO profiles (user_id, wallet_id, email, role) VALUES (?, ?, ?, ?)', [userId, walletId, 'admin@blockchain.com', 'admin'], function(err) {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    }
  });
});

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
  blockchain_id TEXT
);`;
db.run(EXPENSES_TABLE_SQL);

const PROFILES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE,
  wallet_id TEXT,
  email TEXT,
  role TEXT DEFAULT 'user'
);`;
db.run(PROFILES_TABLE_SQL);

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

const VECTOR_DB_DOCUMENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS vector_db_documents (
  id TEXT PRIMARY KEY,
  vector_db_name TEXT,
  document_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);`;
db.run(VECTOR_DB_DOCUMENTS_TABLE_SQL);

// Ensure file storage buckets exist
const uploadsDir = path.join(__dirname, 'uploads');
['data-storage', 'images', 'web-frontend'].forEach(bucket => {
  const bucketPath = path.join(uploadsDir, bucket);
  if (!fs.existsSync(bucketPath)) {
    fs.mkdirSync(bucketPath, { recursive: true });
  }
});

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
  // Allow only the dashboard origin
  const allowedOrigin = 'http://localhost:3001';
  const origin = req.headers.origin;
  if (origin === allowedOrigin) return allowedOrigin;
  return '';
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
      // 1. Insert user (no wallet_id)
      let userId;
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [body.email, body.password, body.role], function(err) {
          if (err) return reject(err);
          userId = this.lastID;
          resolve();
        });
      });

      // 2. Create wallet
      const wallet = web3.eth.accounts.create();
      const walletId = wallet.address;

      // 3. Insert into profiles (not users)
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO profiles (user_id, wallet_id, email, role) VALUES (?, ?, ?, ?)', [userId, walletId, body.email, body.role], function(err) {
          if (err) return reject(err);
          resolve();
        });
      });

      return send(res, 201, { success: true, userId, walletId }, req);
    } catch (e) {
      return send(res, 400, { error: 'User already exists or DB error', details: e.message }, req);
    }
  }

  // Auth login
  if (requestPath === '/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    db.get('SELECT * FROM users WHERE email = ?', [body.email], (err, user) => {
      if (err || !user) return send(res, 401, { error: 'Invalid credentials' }, req);
      if (user.password !== body.password) return send(res, 401, { error: 'Invalid credentials' }, req);
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
      return send(res, 200, { token, user: { id: user.id, email: user.email, role: user.role } }, req);
    });
    return;
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

  // Generic CRUD for all tables (admin only)
  async function handleCrud(routePrefix, table, req, res) {
    console.log(`handleCrud called for: routePrefix=${routePrefix}, table=${table}`);
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);

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
          db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
            if (err) return send(res, 500, { error: 'Database error' }, req);
            return send(res, 200, { [table]: rows }, req);
          });
        }
        break;
      case 'POST':
        const body = await parseBody(req);
        if (!body || Object.keys(body).length === 0) return send(res, 400, { error: 'Missing body for POST' }, req);
        const columns = Object.keys(body).join(', ');
        const placeholders = Object.keys(body).map(() => '?').join(', ');
        const values = Object.values(body);
        db.run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values, async function(err) {
          if (err) return send(res, 400, { error: `Insert failed: ${err.message}` }, req);
          // If creating a user, also create wallet and profile
          if (table === 'users') {
            const userId = this.lastID;
            const wallet = web3.eth.accounts.create();
            const walletId = wallet.address;
            const email = body.email;
            const role = body.role || 'user';
            await new Promise((resolve, reject) => {
              db.run('INSERT INTO profiles (user_id, wallet_id, email, role) VALUES (?, ?, ?, ?)', [userId, walletId, email, role], function(err) {
                if (err) return reject(err);
                resolve();
              });
            });
            return send(res, 201, { id: userId, walletId, success: true }, req);
          } else {
            return send(res, 201, { id: this.lastID, success: true }, req);
          }
        });
        break;
      case 'PUT':
        if (!id) return send(res, 400, { error: 'Missing ID for PUT' }, req);
        const putBody = await parseBody(req);
        if (!putBody || Object.keys(putBody).length === 0) return send(res, 400, { error: 'Missing body for PUT' }, req);
        const setClause = Object.keys(putBody).map(k => `${k} = ?`).join(', ');
        const putValues = [...Object.values(putBody), id];
        db.run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, putValues, function(err) {
          if (err) return send(res, 400, { error: `Update failed: ${err.message}` }, req);
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
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
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
      db.run('INSERT INTO files (name, size, mimetype, uploaded_by, metadata) VALUES (?, ?, ?, ?, ?)', [originalFilename, file.size, file.mimetype, 1, JSON.stringify({ bucket })], function(err) {
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
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    const fileId = fileIdMatch[1];
    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
      if (err || !file) return send(res, 404, { error: 'File not found' }, req);
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

  // --- RESTful USERS ENDPOINTS (admin only) ---
  if (requestPath.startsWith('/api/users')) return handleCrud('users', 'users', req, res);

  // --- RESTful VENDORS ENDPOINTS (admin only) ---
  if (requestPath.startsWith('/api/vendors')) return handleCrud('vendors', 'profiles', req, res); // Vendors are profiles with role 'vendor'

  // --- RESTful EXPENSES ENDPOINTS (admin only) ---
  if (requestPath.startsWith('/api/expenses')) return handleCrud('expenses', 'expenses', req, res);

  // --- RESTful DASHBOARD ENDPOINTS (admin only) ---
  if (requestPath.startsWith('/api/dashboard')) return handleCrud('dashboard', 'dashboard', req, res);

  // --- RESTful TRIPS ENDPOINTS (admin only) ---
  if (requestPath.startsWith('/api/trips')) return handleCrud('trips', 'trips', req, res);

  // --- RESTful RECEIPT_FRAUD_CHECKS ENDPOINTS (admin only) ---
  if (requestPath.startsWith('/api/receipt_fraud_checks')) return handleCrud('receipt_fraud_checks', 'receipt_fraud_checks', req, res);

  // --- RESTful VECTOR_DB_DOCUMENTS ENDPOINTS (admin only) ---
  if (requestPath.startsWith('/api/vector_db_documents')) return handleCrud('vector_db_documents', 'vector_db_documents', req, res);


  // --- DB Inspection Endpoints (admin only) ---
  // GET /api/db/tables
  if (requestPath === '/api/db/tables' && method === 'GET') {
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    db.all('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name', [], (err, rows) => {
      if (err) return send(res, 500, { error: 'Database error' }, req);
      return send(res, 200, { tables: rows.map(row => row.name) }, req);
    });
    return;
  }

  // GET /api/db/relationships (Must be before /api/db/:tableName)
  if (requestPath === '/api/db/relationships' && method === 'GET') {
    console.log(`Debug: Entering /api/db/relationships handler. Path: '${requestPath}', Method: '${method}'`);
    console.log('Processing /api/db/relationships request.');
    if (!isAdmin(req)) {
      console.log('Access denied for /api/db/relationships: not admin.');
      return send(res, 403, { error: 'Forbidden' }, req);
    }
    db.all('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name', [], async (err, tables) => {
      if (err) {
        console.error('Error fetching tables for relationships:', err);
        return send(res, 500, { error: 'Database error fetching tables', details: err.message }, req);
      }
      console.log('Tables fetched for relationships:', tables.map(t => t.name));

      const relationships = {};
      for (const table of tables) {
        try {
          await new Promise((resolve, reject) => {
            db.all(`PRAGMA foreign_key_list('${table.name}')`, [], (fkErr, fks) => {
              if (fkErr) {
                console.error(`Error fetching foreign keys for table ${table.name}:`, fkErr);
                return reject(fkErr);
              }
              if (fks.length > 0) {
                relationships[table.name] = fks;
                console.log(`Found foreign keys for ${table.name}:`, fks);
              }
              resolve(null);
            });
          });
        } catch (e) {
          console.error(`Error processing foreign keys for table ${table.name}:`, e);
          // Continue processing other tables even if one fails
        }
      }
      console.log('Successfully fetched relationships. Sending response.');
      return send(res, 200, { relationships }, req);
    });
    return;
  }

  // GET /api/db/relationships (Must be before /api/db/:tableName)
  const tableSchemaMatch = requestPath.match(/^\/api\/db\/([a-zA-Z0-9_]+)\/schema$/);
  if (tableSchemaMatch && method === 'GET') {
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    const tableName = tableSchemaMatch[1];
    db.all(`PRAGMA table_info('${tableName}')`, [], (err, rows) => {
      if (err) return send(res, 500, { error: 'Database error fetching schema', details: err.message }, req);
      return send(res, 200, { tableName, schema: rows }, req);
    });
    return;
  }

  // GET /api/db/:tableName
  const tableMatch = requestPath.match(/^\/api\/db\/([a-zA-Z0-9_]+)$/);
  if (tableMatch && method === 'GET') {
    if (!isAdmin(req)) return send(res, 403, { error: 'Forbidden' }, req);
    const tableName = tableMatch[1];
    // Basic validation to prevent SQL injection for table name (though parameterized queries protect values)
    db.get('SELECT name FROM sqlite_master WHERE type=? AND name = ?', ['table', tableName], (err, row) => {
      if (err || !row) return send(res, 404, { error: 'Table not found' }, req);

      db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
        if (err) return send(res, 500, { error: 'Database error fetching table data', details: err.message }, req);
        return send(res, 200, { tableName, data: rows }, req);
      });
    });
    return;
  }

  // Serve static files from /uploads
  if (req.url.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, decodeURIComponent(req.url));
    console.log('[STATIC SERVE] Looking for file:', filePath);
    // Security: ensure the file is within the uploads directory
    if (!filePath.startsWith(path.join(__dirname, 'uploads'))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    // Guess content type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // add more as needed
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    // For images and pdfs, use inline; for others, use attachment
    const inlineTypes = ['image/png','image/jpeg','image/gif','image/webp','image/bmp','image/svg+xml','application/pdf'];
    const disposition = inlineTypes.includes(contentType) ? 'inline' : 'attachment';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${path.basename(filePath)}"`,
      'Access-Control-Allow-Origin': getOrigin(req),
      'Access-Control-Allow-Credentials': 'true',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // No route matched
  console.log(`No route matched for: ${method} ${requestPath}. Sending 404.`);
  send(res, 404, { error: 'Not found' }, req);
});

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Start ngrok only if authtoken is provided
  if (process.env.NGROK_AUTHTOKEN) {
    log('ngrok', 'Starting ngrok...', 'magenta');
    await startNgrok(PORT);
  }
});
