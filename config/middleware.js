const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const config = require('./config');

const setupMiddleware = (app) => {
    // Security
    app.use(helmet());
    
    // Compression
    app.use(compression());
    
    // CORS
    app.use(cors({
        origin: config.cors.origins,
        methods: ['POST', 'GET', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.maxRequests
    });
    app.use('/api/', limiter);
};

module.exports = setupMiddleware; 
