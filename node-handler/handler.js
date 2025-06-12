require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ngrok = require('ngrok');
const NodeCache = require('node-cache');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.HANDLER_PORT || 3000;

// Cache for storing service URLs (5 minute TTL)
const serviceCache = new NodeCache({ stdTTL: 300 });

app.use(cors());
app.use(express.json());

// Service registry endpoint - called by API nodes to register themselves
app.post('/register-service', (req, res) => {
    const { serviceName, serviceUrl } = req.body;
    
    if (!serviceName || !serviceUrl) {
        return res.status(400).json({ error: 'serviceName and serviceUrl are required' });
    }
    
    // Store or update the service URL
    serviceCache.set(serviceName, serviceUrl);
    console.log(`Registered service: ${serviceName} at ${serviceUrl}`);
    
    res.json({ 
        success: true, 
        message: `Service ${serviceName} registered successfully` 
    });
});

// Heartbeat endpoint - called by API nodes to keep themselves marked as active
app.post('/heartbeat', (req, res) => {
    const { serviceName, serviceUrl } = req.body;
    if (!serviceName || !serviceUrl) {
        return res.status(400).json({ error: 'serviceName and serviceUrl are required' });
    }
    // Refresh the service in the cache (reset TTL)
    serviceCache.set(serviceName, serviceUrl);
    console.log(`[Heartbeat] Received heartbeat from service: ${serviceName} at ${serviceUrl}`);
    res.json({ success: true, message: `Heartbeat received for ${serviceName}` });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const services = serviceCache.keys().map(key => ({
        service: key,
        url: serviceCache.get(key),
        status: 'active'
    }));
    
    res.json({
        status: 'ok',
        services
    });
});

// Main request handler - routes requests to appropriate services
app.all('/api/:service/*', async (req, res) => {
    // Log incoming request details
    console.log('[Node Handler] Incoming request:', {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body
    });
    const { service } = req.params;
    const serviceUrl = serviceCache.get(service);
    if (!serviceUrl) {
        return res.status(503).json({ 
            error: 'Service unavailable',
            message: `Service '${service}' is not registered`
        });
    }
    // Liveness check before proxying
    try {
        const isHttps = serviceUrl.startsWith('https://');
        const agent = isHttps
            ? new https.Agent({ rejectUnauthorized: false })
            : new http.Agent();
        const healthResp = await axios.get(`${serviceUrl}/health`, {
            timeout: 3000,
            ...(isHttps ? { httpsAgent: agent } : { httpAgent: agent })
        });
        console.log('[Node Handler] Health check response:', {
            status: healthResp.status,
            data: healthResp.data
        });
        if (healthResp.status !== 200) {
            throw new Error('Service health check failed: non-200 status');
        }
    } catch (err) {
        console.warn(`Service ${service} at ${serviceUrl} failed health check. Removing from cache.`, err.message);
        serviceCache.del(service);
        return res.status(503).json({
            error: 'Service unavailable',
            message: `Service '${service}' is not reachable (health check failed)`
        });
    }
    try {
        const isHttps = serviceUrl.startsWith('https://');
        const agent = isHttps
            ? new https.Agent({ rejectUnauthorized: false })
            : new http.Agent();
        const response = await axios({
            method: req.method,
            url: `${serviceUrl}${req.originalUrl.replace(`/api/${service}`, '')}`,
            data: req.body,
            headers: {
                ...req.headers,
                'x-forwarded-from': 'node-handler'
            },
            validateStatus: () => true, // Pass through all status codes
            ...(isHttps ? { httpsAgent: agent } : { httpAgent: agent })
        });
        if (typeof response.data === 'object') {
            res.status(response.status).json(response.data);
        } else {
            res.status(response.status).send(response.data);
        }
    } catch (error) {
        console.error(`Error forwarding to ${service}:`, error.message);
        res.status(502).json({ 
            error: 'Bad Gateway',
            message: `Error communicating with ${service} service`
        });
    }
});

// Start the server and ngrok
async function startServer() {
    const server = app.listen(PORT, () => {
        console.log(`Handler node running on port ${PORT}`);
    });

    try {
        // Start ngrok to expose the handler
        const ngrokConfig = {
            addr: PORT,
            authtoken: process.env.NGROK_AUTHTOKEN,
            region: 'us' // You can change the region
        };

        // Use custom domain if specified
        if (process.env.NGROK_DOMAIN) {
            ngrokConfig.hostname = process.env.NGROK_DOMAIN;
            console.log(`Using custom ngrok domain: ${process.env.NGROK_DOMAIN}`);
        }

        const url = await ngrok.connect(ngrokConfig);
        
        console.log(`Handler node is accessible via ngrok: ${url}`);
        console.log('Use this URL to register your API nodes');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('Shutting down...');
            await ngrok.disconnect();
            await ngrok.kill();
            server.close(() => {
                console.log('Server stopped');
                process.exit(0);
            });
        });
    } catch (error) {
        console.error('Failed to start ngrok:', error);
        process.exit(1);
    }
}

startServer();
