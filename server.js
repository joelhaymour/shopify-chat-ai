const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Shopify = require('shopify-api-node');
const fs = require('fs');

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

// Near the top of server.js, add the store data
const storeData = {
    policies: {
        shipping: {
            methods: [
                { name: 'Canada Standard', time: '5-10 business days' },
                { name: 'US Standard', time: '5-10 business days' },
                { name: 'Australia and UK', time: '10-18 business days' },
                { name: 'Rest of World', time: '10-22 business days' }
            ],
            processing: '48 hours for in-stock items',
            notes: [
                'Please double-check your shipping address before ordering',
                'We\'re not responsible for customs fees',
                'Tracking provided for all orders'
            ]
        },
        returns: {
            timeframe: '14 days',
            conditions: [
                'Items must be in original condition',
                'Must be unworn',
                'All tags must be attached'
            ],
            process: [
                'Contact via email before shipping returns',
                'Use Return Portal',
                'Ship to provided return address'
            ]
        }
    },
    sizingLogic: {
        tops: {
            xs: { weightRange: [45, 60], heightRange: [150, 165] },
            s: { weightRange: [55, 70], heightRange: [160, 175] },
            m: { weightRange: [65, 80], heightRange: [170, 180] },
            l: { weightRange: [75, 90], heightRange: [175, 185] },
            xl: { weightRange: [85, 100], heightRange: [180, 190] },
            xxl: { weightRange: [95, 120], heightRange: [185, 200] }
        }
    }
};

// Create a conversation logger and learner
const logConversation = async (question, answer, helpful = true) => {
    try {
        const conversation = {
            timestamp: new Date(),
            question,
            answer,
            helpful
        };

        // Read existing conversations
        let conversations = [];
        try {
            conversations = JSON.parse(fs.readFileSync('conversations.json', 'utf8'));
        } catch (e) {
            // File doesn't exist yet, start with empty array
        }

        // Add new conversation
        conversations.push(conversation);

        // Save back to file
        fs.writeFileSync('conversations.json', JSON.stringify(conversations, null, 2));
    } catch (error) {
        console.error('Error logging conversation:', error);
    }
};

app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationHistory } = req.body;
        
        console.log('Received message:', message); // Add logging
        
        // Check if this is a sizing calculation
        const measurementPattern = /(\d+'?\d*\"?)\s*(\d+)\s*(?:lbs?|pounds?)/i;
        if (measurementPattern.test(message)) {
            const sizingPrompt = `You are a professional clothing size expert. 
            
            CUSTOMER MEASUREMENTS:
            ${message}

            PRODUCT SIZING DATA:
            Tops:
            - XS: 45-60 lbs, 150-165 cm
            - S: 55-70 lbs, 160-175 cm
            - M: 65-80 lbs, 170-180 cm
            - L: 75-90 lbs, 175-185 cm
            - XL: 85-100 lbs, 180-190 cm
            - XXL: 95-120 lbs, 185-200 cm

            MODEL REFERENCE:
            Our model is 6'1" (185cm) and 180lbs wearing size Large

            TASK:
            1. Convert and analyze the customer's measurements
            2. Compare to our size chart
            3. Consider body proportions
            4. Make a specific size recommendation
            5. Explain the reasoning
            6. Add tips about fit preference

            FORMAT YOUR RESPONSE LIKE THIS:

            📏 YOUR MEASUREMENTS
            ----------------------------------------
            • Height: [converted to feet/inches and cm]
            • Weight: [converted to lbs and kg]

            📊 SIZE RECOMMENDATION
            ----------------------------------------
            • Recommended size: [size]
            • Confidence level: [high/medium/low]

            💡 WHY THIS SIZE
            ----------------------------------------
            [Explanation comparing to model and size chart]

            ✨ FIT TIPS
            ----------------------------------------
            [1-2 specific tips about fit]

            Need any clarification? Just ask! 😊`;

            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: sizingPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.7
            });

            return res.json({ response: completion.choices[0].message.content });
        }

        // Read previous conversations to learn from
        let previousConversations = [];
        try {
            previousConversations = JSON.parse(fs.readFileSync('conversations.json', 'utf8'));
        } catch (e) {
            // No previous conversations yet
        }

        // Find similar previous questions and their successful answers
        const relevantConversations = previousConversations
            .filter(conv => conv.helpful)
            .filter(conv => 
                conv.question.toLowerCase().includes(message.toLowerCase()) ||
                message.toLowerCase().includes(conv.question.toLowerCase())
            )
            .slice(-3); // Get last 3 relevant conversations

        // Add learning context to system prompt
        const learningContext = relevantConversations.length > 0 
            ? `\n\nPrevious successful responses to similar questions:\n${
                relevantConversations.map(conv => 
                    `Q: ${conv.question}\nA: ${conv.answer}`
                ).join('\n\n')
              }`
            : '';

        // Updated system prompt combining your existing structure with new restrictions
        const systemPrompt = `You are a customer service representative for Rouqe Golf, an online golf apparel store. Your primary role is to assist customers with inquiries about orders, shipping, returns, sizing recommendations, and general store policies.

You should also use common knowledge to provide helpful responses related to:
- Shipping delays due to postal strikes or weather
- Clothing care and fabric information
- General advice on how to measure for sizing

Restricted Topics (AI Must NOT Answer):
You must refuse and redirect any requests related to:
- Irrelevant Topics (e.g., writing stories, jokes, essays, random trivia)
- Competitors or Unrelated Brands
- Personal Advice or Opinions (e.g., golf swing tips, sports predictions)
- Sensitive Company Information (e.g., product manufacturing costs, supplier details, internal business strategies, or profit margins)

Additional Guidelines:
- Keep responses under 150 words when possible
- Use emojis sparingly (👕 for sizing, 📦 for shipping, ↩️ for returns)
- Format prices as USD with dollar sign ($29.99)
- When discussing sizing, always recommend measuring rather than guessing
- For shipping estimates, always include a note about processing time

RESPONSE STRUCTURE:
- Always use clear headings in CAPS with emoji icons
- Separate different topics with line breaks
- Use bullet points for lists
- Keep paragraphs short (2-3 lines max)

${learningContext}

If a customer asks an irrelevant or restricted question, respond with:
"I'm here to help with Rouqe Golf orders, shipping, and sizing. If you have a customer service question, I'd be happy to assist! For other inquiries, please contact us at info@rouqesupport.com."

STORE INFORMATION:
${JSON.stringify(storeData, null, 2)}`;

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
        console.log('AI Response:', response); // Add logging

        // Log the conversation for future learning
        await logConversation(message, response);

        res.json({ response });
    } catch (error) {
        console.error('Server Error:', error); // Better error logging
        res.status(500).json({ 
            error: 'An error occurred',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Add endpoint to rate answers (optional)
app.post('/api/rate-response', async (req, res) => {
    try {
        const { question, answer, helpful } = req.body;
        await logConversation(question, answer, helpful);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error rating response' });
    }
});

// Add a test endpoint
app.get('/', (req, res) => {
    res.json({ status: 'Server is running!' });
});

app.post('/api/feedback', async (req, res) => {
    try {
        const { question, answer, helpful, feedback } = req.body;
        
        // Read existing feedback file
        let feedbackData = [];
        try {
            feedbackData = JSON.parse(fs.readFileSync('feedback.json', 'utf8'));
        } catch (e) {
            // File doesn't exist yet, start with empty array
        }

        // Add new feedback
        feedbackData.push({
            timestamp: new Date(),
            question,
            answer,
            helpful,
            feedback,
            // Add metadata for better learning
            topics: extractTopics(question),
            length: answer.length,
            hasEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(answer)
        });

        // Save feedback
        fs.writeFileSync('feedback.json', JSON.stringify(feedbackData, null, 2));

        // Update the AI's learning context
        updateLearningContext(feedbackData);

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: 'Error saving feedback' });
    }
});

function extractTopics(question) {
    const topics = [];
    if (question.toLowerCase().includes('size')) topics.push('sizing');
    if (question.toLowerCase().includes('ship')) topics.push('shipping');
    if (question.toLowerCase().includes('return')) topics.push('returns');
    return topics;
}

function updateLearningContext(feedbackData) {
    // Get most helpful responses
    const bestResponses = feedbackData
        .filter(f => f.helpful)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    // Save to a learning context file
    fs.writeFileSync('learning-context.json', JSON.stringify(bestResponses, null, 2));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
