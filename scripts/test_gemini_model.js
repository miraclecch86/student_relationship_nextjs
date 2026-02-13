const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('API Key not found');
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Explicitly test the requested model
    const modelName = 'gemini-3-flash-preview';
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Testing model: ${modelName}`);

    try {
        const result = await model.generateContent('Hello, are you there?');
        const response = await result.response;
        console.log('Success! Response:', response.text());
    } catch (error) {
        console.error('Error testing model:', error.message);
        if (error.response) {
            console.error('Error details:', JSON.stringify(error.response, null, 2));
        }
    }
}

testGemini();
