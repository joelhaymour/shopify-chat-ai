require('dotenv').config();

const config = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },
    shopify: {
        shopName: process.env.SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
    },
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development'
    },
    rateLimit: {
        maxRequests: process.env.MAX_REQUESTS_PER_WINDOW || 100,
        windowMs: process.env.REQUEST_WINDOW_MS || 900000
    },
    cors: {
        origins: (process.env.ALLOWED_ORIGINS || '').split(',')
    }
};

module.exports = config; 
