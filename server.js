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
        
        // Get relevant store data
        const products = await shopify.product.list({ limit: 10 });
        const policies = await shopify.shop.get();

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful shopping assistant. Store policies: ${JSON.stringify(policies)}`
                },
                ...conversationHistory,
                { role: "user", content: message }
            ]
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
