require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Use port 3000 for the API server
const PORT = 3000;

// Configure body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Log all incoming requests
app.use((req, res, next) => {
    console.log(`\n=== New ${req.method} Request ===`);
    console.log('URL:', req.url);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
});

// Configure CORS to allow requests from the dashboard
app.use((req, res, next) => {
    // Log all incoming requests
    console.log(`\n=== New ${req.method} Request ===`);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    // Allow requests from the dashboard on port 3001
    const allowedOrigins = ['http://localhost:3001'];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS preflight request');
        return res.status(200).end();
    }
    
    console.log('Proceeding to route handler...');
    
    next();
});

// Simple in-memory user
const users = [
    {
        id: 1,
        email: 'admin@blockchain.com',
        password: 'admin123', // Hardcoded for now to avoid env issues
        role: 'admin'
    }
];

// Log the users at startup
console.log('Starting server with users:', JSON.stringify(users, null, 2));

// Basic routes
app.get('/', (req, res) => {
    res.json({ message: 'Basic API Server is running' });
});

// Login endpoint
app.post('/auth/login', (req, res) => {
    console.log('\n=== New Login Attempt ===');
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request body:', req.body);
    
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            const error = 'Missing email or password';
            console.log('Error:', error);
            return res.status(400).json({ error });
        }
        
        console.log('Looking for user with email:', email);
        console.log('Available users:', JSON.stringify(users, null, 2));
        
        // Normalize email for comparison
        const normalizedEmail = email.trim().toLowerCase();
        const user = users.find(u => u.email.toLowerCase() === normalizedEmail);
        
        if (!user) {
            const error = `User not found with email: ${email}`;
            console.log('Error:', error);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('User found:', JSON.stringify(user, (k, v) => k === 'password' ? '***' : v, 2));
        console.log('Password check:', { 
            provided: password, 
            stored: user.password, 
            match: password === user.password,
            providedLength: password.length,
            storedLength: user.password.length
        });
        
        if (user.password !== password) {
            const error = 'Password does not match';
            console.log('Error:', error);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
    
    const { password: _, ...userWithoutPassword } = user;
    
    // Generate a token (in a real app, use JWT or similar)
    const token = `dummy-token-${Date.now()}`;
    
    // In a real app, you would generate a proper JWT token here
    console.log('Login successful, generated token:', token);
    
    res.json({
        token,
        user: userWithoutPassword,
        message: 'Login successful'
    });
    } catch (error) {
        console.error('Error in login handler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: 'basic-server' });
});

// Keep process alive
process.stdin.resume();

// Handle different ways the process might end
process.on('SIGINT', () => {
    console.log('\nSIGINT received. Keeping server running. Press Ctrl+C again to force exit.');
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit on uncaught exceptions
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit on unhandled promise rejections
});

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Basic server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}`);
    console.log('\nAdmin credentials:');
    console.log(`Email: ${users[0].email}`);
    console.log(`Password: ${users[0].password}`);
    console.log('\nPress Ctrl+C to stop the server');
});

// Keep the connection alive
server.keepAliveTimeout = 120 * 1000; // 2 minutes
server.headersTimeout = 125 * 1000; // 2.5 minutes

// Handle shutdown gracefully
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully');
    process.exit(0);
});

module.exports = app;
