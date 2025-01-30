const express = require('express');
const OpenAI = require('openai');
const Shopify = require('shopify-api-node');
const fs = require('fs');

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

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationHistory } = req.body;
        console.log('Received message:', message);

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
