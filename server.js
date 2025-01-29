const express = require('express');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');
const Shopify = require('shopify-api-node');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

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

        const completion = await openai.createChatCompletion({
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

        res.json({ response: completion.data.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
