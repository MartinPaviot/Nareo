/**
 * Test Script for Upload Robustness
 * 
 * Tests the upload and text extraction pipeline with the 4 test files:
 * - Beginner's guide - Cities_ Skylines Wiki.pdf
 * - Philosophy 101_ From Plato and Socrates to Ethics and Metaphysics, an Essential Primer on the History of Thought - PDFDrive.com.pdf
 * - Projet bac à sable.pdf
 * - Presentation Alter coloc Nov2024.docx
 * 
 * Usage:
 * 1. Make sure you have the test files in public/test_files/
 * 2. Run: npx ts-node scripts/test-upload-robustness.ts
 * 
 * Or use this code as a reference for manual testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { parsePDF } from '../lib/pdf-parser';
import { parseDocx } from '../lib/document-parser';
import { validateExtractedText } from '../lib/openai-fallback';

const TEST_FILES = [
  {
    name: "Beginner's guide - Cities_ Skylines Wiki.pdf",
    type: 'pdf',
    path: 'public/test_files/Beginner\'s guide - Cities_ Skylines Wiki.pdf',
  },
  {
    name: 'Philosophy 101_ From Plato and Socrates to Ethics and Metaphysics, an Essential Primer on the History of Thought - PDFDrive.com.pdf',
    type: 'pdf',
    path: 'public/test_files/Philosophy 101_ From Plato and Socrates to Ethics and Metaphysics, an Essential Primer on the History of Thought - PDFDrive.com.pdf',
  },
  {
    name: 'Projet bac à sable.pdf',
    type: 'pdf',
    path: 'public/test_files/Projet bac à sable.pdf',
  },
  {
    name: 'Presentation Alter coloc Nov2024.docx',
    type: 'docx',
    path: 'public/test_files/Presentation Alter coloc Nov2024.docx',
  },
];

async function testFile(file: typeof TEST_FILES[0]) {
  console.log('\n' + '='.repeat(80));
  console.log(`📄 Testing: ${file.name}`);
  console.log('='.repeat(80));
  
  try {
    // Check if file exists
    if (!fs.existsSync(file.path)) {
      console.error(`❌ File not found: ${file.path}`);
      return {
        success: false,
        error: 'File not found',
      };
    }
    
    // Read file
    const buffer = fs.readFileSync(file.path);
    console.log(`✅ File loaded: ${buffer.length} bytes`);
    
    // Parse based on type
    let extractedText = '';
    const startTime = Date.now();
    
    if (file.type === 'pdf') {
      extractedText = await parsePDF(buffer);
    } else if (file.type === 'docx') {
      extractedText = await parseDocx(buffer);
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`⏱️  Parsing took: ${duration} seconds`);
    console.log(`📝 Extracted text length: ${extractedText.length} characters`);
    
    // Validate text quality
    const validation = validateExtractedText(extractedText, 300);
    
    if (validation.isValid) {
      console.log(`✅ Validation PASSED: ${validation.length} characters`);
    } else {
      console.log(`❌ Validation FAILED: ${validation.reason}`);
    }
    
    // Show text preview
    console.log('\n📋 Text Preview (first 500 characters):');
    console.log('-'.repeat(80));
    console.log(extractedText.substring(0, 500));
    console.log('-'.repeat(80));
    
    // Show text statistics
    const words = extractedText.split(/\s+/).filter(w => w.length > 0);
    const sentences = extractedText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const lines = extractedText.split('\n').filter(l => l.trim().length > 0);
    
    console.log('\n📊 Text Statistics:');
    console.log(`   Characters: ${extractedText.length}`);
    console.log(`   Words: ${words.length}`);
    console.log(`   Sentences: ${sentences.length}`);
    console.log(`   Lines: ${lines.length}`);
    
    return {
      success: validation.isValid,
      length: extractedText.length,
      words: words.length,
      sentences: sentences.length,
      duration: parseFloat(duration),
      validation,
    };
    
  } catch (error: any) {
    console.error(`❌ Error testing file: ${error.message}`);
    console.error(error.stack);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runAllTests() {
  console.log('\n🚀 Starting Upload Robustness Tests');
  console.log('Testing 4 files from public/test_files/\n');
  
  const results = [];
  
  for (const file of TEST_FILES) {
    const result = await testFile(file);
    results.push({
      file: file.name,
      ...result,
    });
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Successful Files:');
    successful.forEach(r => {
      console.log(`   - ${r.file}`);
      console.log(`     Length: ${r.length} chars, Words: ${r.words}, Duration: ${r.duration}s`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Files:');
    failed.forEach(r => {
      console.log(`   - ${r.file}`);
      console.log(`     Error: ${r.error || r.validation?.reason || 'Unknown'}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  if (failed.length === 0) {
    console.log('🎉 All tests passed! The upload system is robust.');
  } else {
    console.log('⚠️  Some tests failed. Review the errors above.');
  }
  
  console.log('='.repeat(80) + '\n');
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { testFile, runAllTests };
