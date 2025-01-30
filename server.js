const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');

// Import configurations
const config = require('./config/config');
const setupMiddleware = require('./config/middleware');
const systemPrompt = require('./config/systemPrompt');
const storeData = require('./config/storeData');

const app = express();

// Initialize OpenAI with config
const openai = new OpenAI({
    apiKey: config.openai.apiKey
});

// Setup middleware
setupMiddleware(app);
app.use(express.json());
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
        console.log('Conversation logged:', conversation);
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
                        content: `Use this sizing data: ${JSON.stringify(storeData.sizingLogic)}` 
                    },
                    { role: "user", content: message }
                ],
                temperature: 0.7
            });

            return res.json({ response: sizingCompletion.choices[0].message.content });
        }

        // Regular chat completion using store data
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                { 
                    role: "system", 
                    content: `Use this store data: ${JSON.stringify(storeData)}. ${systemPrompt}` 
                },
                ...conversationHistory.slice(-4),
                { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 500
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
