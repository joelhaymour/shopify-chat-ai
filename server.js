const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Shopify = require('shopify-api-node');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI with new syntax
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Shopify
const shopify = new Shopify({
    shopName: process.env.SHOP_NAME,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: '2024-01'
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationHistory } = req.body;
        
        // Get store data
        const storeData = {
            shipping: {
                methods: [
                    { name: 'Canada Standard', time: '5-10 business days' },
                    { name: 'US Standard', time: '5-10 business days' },
                    { name: 'Australia and UK', time: '10-18 business days' },
                    { name: 'Rest of World', time: '10-22 business days' }
                ],
                processing: '48 hours for in-stock items'
            },
            returns: {
                timeframe: '14 days',
                conditions: [
                    'Items must be in original condition',
                    'Must be unworn',
                    'All tags must be attached'
                ]
            },
            sizing: {
                tops: {
                    xs: { weightRange: [45, 60], heightRange: [150, 165] },
                    s: { weightRange: [55, 70], heightRange: [160, 175] },
                    m: { weightRange: [65, 80], heightRange: [170, 180] },
                    l: { weightRange: [75, 90], heightRange: [175, 185] },
                    xl: { weightRange: [85, 100], heightRange: [180, 190] }
                }
            }
        };

        // Enhanced system prompt with brand voice instructions
        const systemPrompt = `You are a friendly, helpful shopping assistant named Rouqe. Here's how you should communicate:

        BRAND VOICE:
        - Be warm and conversational, like a knowledgeable friend
        - Use casual, modern language (it's okay to use "hey" instead of "hello")
        - Add occasional emojis to keep things light 😊
        - Show enthusiasm for our products
        - Be reassuring about fit and style choices
        - If someone seems unsure, offer extra encouragement
        - Share little tips and insights when relevant
        - Use phrases like:
          * "I've got you covered!"
          * "Let me help you find the perfect fit"
          * "That's a great choice"
          * "Don't worry, we can figure this out together"
        
        COMMUNICATION STYLE:
        - Break up long responses into easy-to-read sections
        - If someone seems frustrated, show extra empathy
        - Always end on a positive note
        - Offer specific recommendations when possible
        - If you're not sure about something, be honest and suggest reaching out to our support team

        STORE INFORMATION:
        ${JSON.stringify(storeData, null, 2)}

        Remember: You're not just providing information - you're creating a friendly, reassuring shopping experience! 🛍️`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                ...conversationHistory,
                { role: "user", content: message }
            ],
            temperature: 0.8  // Slightly increased for more personality
        });

        res.json({ response: completion.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

// Add a test endpoint
app.get('/', (req, res) => {
    res.json({ status: 'Server is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
