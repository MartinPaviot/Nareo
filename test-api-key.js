// Test script to verify OpenAI API key
require('dotenv').config({ path: '.env.local' });
const OpenAI = require('openai');

async function testAPIKey() {
  console.log('🔍 Testing OpenAI API Key...\n');
  
  // Check if key exists
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No API key found in .env.local');
    console.log('Please add: OPENAI_API_KEY=sk-your-key-here');
    return;
  }
  
  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
  console.log('   Key starts with:', apiKey.substring(0, 3));
  console.log('   Key length:', apiKey.length, 'characters\n');
  
  // Test the API
  try {
    console.log('📡 Testing API connection...');
    
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: 'Say "API works!" if you can read this.',
        },
      ],
      max_tokens: 10,
    });
    
    console.log('✅ API Response:', response.choices[0].message.content);
    console.log('\n🎉 SUCCESS! Your API key works correctly!');
    console.log('The image analysis should work now.');
    
  } catch (error) {
    console.error('\n❌ API Error:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Invalid API key format');
    console.error('2. API key doesn\'t have access to gpt-4o');
    console.error('3. Billing/quota issues');
    console.error('4. Network/firewall blocking OpenAI');
    
    if (error.message.includes('401')) {
      console.error('\n⚠️  Authentication failed - check your API key');
    }
  }
}

testAPIKey();
