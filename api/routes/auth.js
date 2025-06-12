const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken'); // Import jsonwebtoken

const JWT_SECRET = process.env.JWT_SECRET; // Your JWT secret from .env

// Register new user
router.post('/register', async (req, res) => {
    const { db } = req; // Access the SQLite database instance
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Email, password, and role are required' });
    }

    if (!JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables.');
        return res.status(500).json({ error: 'Server configuration error: JWT secret missing.' });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10); // 10 salt rounds

        // Generate a UUID for the user
        const userId = uuidv4();

        // Insert user into SQLite database (wrapped in Promise)
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)`, 
                [userId, email, hashedPassword, role],
                function(err) {
                    if (err) {
                        // Handle unique constraint violation for email
                        if (err.message.includes('UNIQUE constraint failed: users.email')) {
                            return reject(new Error('User with this email already exists'));
                        }
                        return reject(err);
                    }
                    resolve();
                }
            );
        });

        // Log in the user immediately after registration
        const token = jwt.sign({ userId: userId, role: role }, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour from now

        // Store session in database (wrapped in Promise)
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`, 
                [sessionId, userId, token, expiresAt],
                function(sessionErr) {
                    if (sessionErr) {
                        console.error('Error saving session:', sessionErr.message);
                        // We'll resolve even if session saving fails to allow user registration to complete.
                        // This error might be logged but not block the user from being created.
                        resolve(); 
                    } else {
                        resolve();
                    }
                }
            );
        });

        res.status(201).json({ message: 'User registered and logged in successfully', userId: userId, token: token });

    } catch (error) {
        console.error('Server error during registration:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Login user
router.post('/login', (req, res) => {
    const { db } = req; // Access the SQLite database instance
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
        return res.status(400).json({ 
            success: false,
            error: 'Email and password are required' 
        });
    }

    // Check if JWT_SECRET is set
    if (!JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables');
        return res.status(500).json({ 
            success: false,
            error: 'Server configuration error' 
        });
    }

    // Find user by email
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        try {
            if (err) {
                console.error('Database error during login:', err.message);
                return res.status(500).json({ 
                    success: false,
                    error: 'Internal server error' 
                });
            }

            // Check if user exists
            if (!user) {
                return res.status(401).json({ 
                    success: false,
                    error: 'Invalid email or password' 
                });
            }


            // Compare provided password with hashed password
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(401).json({ 
                    success: false,
                    error: 'Invalid email or password' 
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    role: user.role,
                    email: user.email
                }, 
                JWT_SECRET, 
                { 
                    expiresIn: '1h',
                    issuer: 'blockchain-expense-tracker',
                    audience: 'blockchain-expense-tracker-web'
                }
            );

            // Store session in database
            const sessionId = uuidv4();
            const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

            db.run(
                `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`, 
                [sessionId, user.id, token, expiresAt],
                (sessionErr) => {
                    if (sessionErr) {
                        console.error('Error saving session:', sessionErr.message);
                        // Continue with login even if session save fails
                    }

                    // Successful login response
                    res.json({ 
                        success: true,
                        message: 'Login successful', 
                        data: {
                            userId: user.id, 
                            email: user.email,
                            role: user.role,
                            token: token,
                            expiresIn: 3600 // 1 hour in seconds
                        }
                    });
                }
            );
        } catch (error) {
            console.error('Unexpected error during login:', error);
            res.status(500).json({ 
                success: false,
                error: 'An unexpected error occurred' 
            });
        }
    });
});

module.exports = router;