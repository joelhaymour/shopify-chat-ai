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
        
        // Check if this is a sizing request
        if (message.toLowerCase().includes('size') || message.toLowerCase().includes('sizing')) {
            return res.json({
                response: "Let's find your perfect size! 👕\n\nWhat's your gender? This helps us with sizing calculations.",
                showOptions: true,
                options: [
                    { text: "👨 Male", value: "male" },
                    { text: "👩 Female", value: "female" }
                ]
            });
        }

        // Check for gender selection
        if (message.toLowerCase().includes('male') || message.toLowerCase().includes('female')) {
            return res.json({
                response: "📏 What's your height and weight?\n\n💡 Example: If you're 5 feet 10 inches and 160 pounds, type:\n5'10\" 160lbs",
                expectMeasurements: true
            });
        }

        // Check if message contains height and weight
        const measurementPattern = /(\d+'?\d*\"?)\s*(\d+)\s*(?:lbs?|pounds?)/i;
        if (measurementPattern.test(message)) {
            return res.json({
                response: "🛍️ What type of item are you looking for?",
                showOptions: true,
                options: [
                    { text: "👕 Tops", value: "tops" },
                    { text: "👖 Bottoms", value: "bottoms" },
                    { text: "🧥 Outerwear", value: "outerwear" }
                ]
            });
        }

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

        const systemPrompt = `You are a friendly, helpful shopping assistant named Rouqe. 

        RESPONSE STRUCTURE:
        - Always use clear headings in CAPS with emoji icons
        - Separate different topics with line breaks
        - Use bullet points for lists
        - Keep paragraphs short (2-3 lines max)
        - Use emojis to highlight key points
        
        FORMATTING EXAMPLES:
        For shipping questions, structure like this:
        
        🚚 SHIPPING TIMES
        ----------------------------------------
        • Canada & US: 5-10 business days
        • International: 10-18 business days
        
        ⏱️ PROCESSING TIME
        ----------------------------------------
        • All orders ship within 48 hours
        • Tracking number provided via email
        
        For return questions, structure like this:
        
        📦 RETURN WINDOW
        ----------------------------------------
        • 14 days from delivery
        • Must be unworn with tags attached
        
        ✨ HOW TO RETURN
        ----------------------------------------
        1. Contact our support team
        2. Get your return label
        3. Drop off at any post office

        BRAND VOICE:
        - Be warm and conversational, like a knowledgeable friend
        - Use casual, modern language
        - Add occasional emojis to keep things light 😊
        - Show enthusiasm for our products
        - Be reassuring about fit and style choices
        
        STORE INFORMATION:
        ${JSON.stringify(storeData, null, 2)}

        Remember: Always end with a friendly offer for additional help! 💬`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                ...conversationHistory,
                { role: "user", content: message }
            ],
            temperature: 0.7
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
