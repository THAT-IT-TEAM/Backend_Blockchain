const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, './api/database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

const runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
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

async function seedData() {
    try {
        // Ensure tables exist before inserting data
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
        await runAsync(DASHBOARD_TABLE_SQL);
        console.log('Dashboard table ensured.');

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
        console.log('Expenses table ensured.');

        // Clear existing data from dashboard and expenses tables to prevent UNIQUE constraint failures
        console.log('Clearing existing data from dashboard and expenses tables...');
        await runAsync('DELETE FROM dashboard');
        await runAsync('DELETE FROM expenses');
        console.log('Existing data cleared.');

        const jsonData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../expense_data_json.json'), 'utf8'));

        // Use a fixed user_id and trip_id for these seeded expenses for simplicity
        // You might want to fetch a real user_id from your DB or create one if needed
        const defaultUserId = '00000000-0000-0000-0000-000000000001'; 
        const defaultTripId = '00000000-0000-0000-0000-000000000002';

        console.log(`Starting data seeding for ${jsonData.length} expenses...`);

        for (const item of jsonData) {
            // Insert into dashboard table
            const dashboardSql = `INSERT INTO dashboard (
                id, vendorName, submittedBy, projectName, receiptPreview,
                expenseType, submissionDate, amount, status, onChainHash, actions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const dashboardValues = [
                parseInt(item.id), // Convert ID to integer
                item.vendorName, item.submittedBy, item.projectName, item.receiptPreview,
                item.expenseType, item.submissionDate, item.amount, item.status, item.onChainHash, item.actions
            ];
            await runAsync(dashboardSql, dashboardValues);
            console.log(`Inserted into dashboard: ID ${item.id}`);

            // Insert into expenses table
            const expensesSql = `INSERT INTO expenses (
                id, amount, currency, transaction_date, vendor_name, category,
                description, document_id, payment_method, tax_amount, document_url,
                extracted_data, summary, user_id, trip_id, blockchain_status, blockchain_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            const expensesValues = [
                item.id,
                parseFloat(item.amount), // Convert amount to REAL
                'USD', // Default currency
                item.submissionDate,
                item.vendorName,
                item.expenseType,
                item.description || '', // Use existing description or default
                item.document_id || 'no_document_id', // Use existing document_id or default
                'Unspecified', // Default payment method
                0.0, // Default tax_amount
                item.receiptPreview, // document_url
                JSON.stringify({}), // Default empty extracted_data JSON
                '', // Default summary
                defaultUserId, // User ID
                defaultTripId, // Trip ID
                item.onChainHash ? 1 : 0, // blockchain_status (1 if hash exists, 0 otherwise)
                item.onChainHash, // blockchain_id
                item.status // status from JSON
            ];
            await runAsync(expensesSql, expensesValues);
            console.log(`Inserted into expenses: ID ${item.id}`);
        }

        console.log('Data seeding completed successfully!');
    } catch (error) {
        console.error('Error during data seeding:', error.message);
        console.error(error.stack);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing database', err.message);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

seedData(); 