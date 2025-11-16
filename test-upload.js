// Node.js Test Script for Document Upload API
const fs = require('fs');
const path = require('path');

async function testUpload(filePath, description) {
  console.log(`\n📋 Testing: ${description}`);
  console.log('--------------------------------');
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  try {
    const FormData = require('form-data');
    const fetch = require('node-fetch');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    
    console.log(`Uploading ${path.basename(filePath)}...`);
    
    const response = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Upload successful!');
      console.log('Response:', JSON.stringify(data, null, 2));
      
      // Validate response structure
      if (data.success && data.chapterId && data.chapters) {
        console.log(`✓ Created ${data.chapters.length} chapters`);
        console.log(`✓ Total questions: ${data.totalQuestions}`);
        data.chapters.forEach((ch, i) => {
          console.log(`  Chapter ${i + 1}: ${ch.title} (${ch.difficulty}) - ${ch.questionCount} questions`);
        });
      }
    } else {
      console.log('❌ Upload failed');
      console.log('Error:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing Document Upload API');
  console.log('================================\n');
  
  // Test 1: PDF Upload
  await testUpload('test-sample.pdf', 'PDF Document Upload');
  
  // Test 2: Invalid file type
  console.log('\n📋 Testing: Invalid File Type');
  console.log('--------------------------------');
  fs.writeFileSync('test-invalid.txt', 'This is a test file');
  await testUpload('test-invalid.txt', 'Invalid File Type (should fail)');
  fs.unlinkSync('test-invalid.txt');
  
  console.log('\n================================');
  console.log('🎉 Testing Complete!\n');
  console.log('Note: Install dependencies if needed:');
  console.log('  npm install form-data node-fetch@2');
}

runTests().catch(console.error);
