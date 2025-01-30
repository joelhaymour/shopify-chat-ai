const express = require('express');
const OpenAI = require('openai');
const Shopify = require('shopify-api-node');
const fs = require('fs');
const cors = require('cors');

// Import our new configurations
const config = require('./config/config');
const setupMiddleware = require('./config/middleware');
const systemPrompt = require('./config/systemPrompt');

const app = express();

// Initialize OpenAI with config
const openai = new OpenAI({
    apiKey: config.openai.apiKey
});

// Initialize Shopify with config
const shopify = new Shopify({
    shopName: config.shopify.shopName,
    accessToken: config.shopify.accessToken,
    apiVersion: '2024-01'
});

// Setup all middleware (CORS, security, rate limiting, etc.)
setupMiddleware(app);

// Parse JSON bodies
app.use(express.json());

// Update the CORS configuration at the top of server.js
app.use(cors({
    origin: ['https://rouqegolf.com', 'https://www.rouqegolf.com'],
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

// Add a preflight handler
app.options('*', cors());

// Create a conversation logger
const logConversation = async (question, answer, helpful = true) => {
    try {
        const conversation = {
            timestamp: new Date(),
            question,
            answer,
            helpful
        };

        let conversations = [];
        try {
            conversations = JSON.parse(fs.readFileSync('conversations.json', 'utf8'));
        } catch (e) {
            // File doesn't exist yet, start with empty array
        }

        conversations.push(conversation);
        fs.writeFileSync('conversations.json', JSON.stringify(conversations, null, 2));
    } catch (error) {
        console.error('Error logging conversation:', error);
    }
};

// Add predefined responses for suggested questions
const PREDEFINED_RESPONSES = {
    'Shipping Info': `Here's our shipping information:
- Free shipping on orders over $75
- Standard shipping: 3-5 business days
- Express shipping: 1-2 business days
- International shipping available`,
    
    'Return Policy': `Our Return Policy:
- 30-day return window
- Items must be unworn with original tags
- Free returns for US customers
- Email info@rouqesupport.com to initiate a return`,
    
    'Help With Sizing': `For sizing assistance:
- Please provide your height and weight
- We'll recommend the best size for you
- View our size chart for detailed measurements
- Contact us for specific product measurements`,
    
    'Track My Order': `To track your order:
- Check your order confirmation email
- Visit our website and click "Track Order"
- Email info@rouqesupport.com with your order number
- Allow 24-48 hours for tracking to update`,
    
    'Restock Questions': `About Restocks:
- Join our waitlist for notifications
- Most items restock within 2-4 weeks
- Limited editions may not be restocked
- Email info@rouqesupport.com for specific item inquiries`
};

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationHistory } = req.body;
        console.log('Received message:', message);

        // Check if it's a predefined question
        if (PREDEFINED_RESPONSES[message]) {
            const response = PREDEFINED_RESPONSES[message];
            await logConversation(message, response);
            return res.json({ response });
        }

        // Check for sizing calculation
        const measurementPattern = /(\d+'?\d*\"?)\s*(\d+)\s*(?:lbs?|pounds?)/i;
        if (measurementPattern.test(message)) {
            const sizingCompletion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { 
                        role: "system", 
                        content: systemPrompt + "\n\nFOCUS: Sizing calculation for: " + message 
                    },
                    { role: "user", content: message }
                ],
                temperature: 0.7
            });

            return res.json({ response: sizingCompletion.choices[0].message.content });
        }

        // Regular chat completion
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                { role: "system", content: systemPrompt },
                ...conversationHistory.slice(-4),
                { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 500,
            presence_penalty: 0.6,
            frequency_penalty: 0.5
        });

        const response = completion.choices[0].message.content;
        console.log('AI Response:', response);

        await logConversation(message, response);
        res.json({ response });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: 'An error occurred',
            details: config.server.env === 'development' ? error.message : undefined
        });
    }
});

// Test endpoint
app.get('/', (req, res) => {
    res.json({ status: 'Server is running!' });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
