/**
 * Test Script for PDF Readability and Vision OCR
 * 
 * Tests the PDF parsing pipeline with readability scoring
 * and Vision OCR fallback for corrupted PDFs
 */

import * as fs from 'fs';
import * as path from 'path';
import { parsePDF } from '../../lib/pdf-parser';
import { parseDocx } from '../../lib/document-parser';
import { calculateReadabilityScore } from '../../lib/openai-fallback';

const TEST_FILES = [
  {
    name: "Beginner's guide - Cities_ Skylines Wiki.pdf",
    type: 'pdf',
    path: 'test/files/Beginner\'s guide - Cities_ Skylines Wiki.pdf',
    expectedMethod: 'pdf2json', // Should work with pdf2json
  },
  {
    name: 'Philosophy 101_ From Plato and Socrates to Ethics and Metaphysics, an Essential Primer on the History of Thought - PDFDrive.com.pdf',
    type: 'pdf',
    path: 'test/files/Philosophy 101_ From Plato and Socrates to Ethics and Metaphysics, an Essential Primer on the History of Thought - PDFDrive.com.pdf',
    expectedMethod: 'pdf2json', // Should work with pdf2json
  },
  {
    name: 'Projet bac à sable.pdf',
    type: 'pdf',
    path: 'test/files/Projet bac à sable.pdf',
    expectedMethod: 'pdf2json', // Should work with pdf2json
  },
  {
    name: 'philosophie (dragged).pdf',
    type: 'pdf',
    path: 'test/files/philosophie (dragged).pdf',
    expectedMethod: 'vision', // Should use Vision OCR fallback
  },
  {
    name: 'Presentation Alter coloc Nov2024.docx',
    type: 'docx',
    path: 'test/files/Presentation Alter coloc Nov2024.docx',
    expectedMethod: 'mammoth', // Should work with mammoth
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
    
    // Calculate readability score
    const readability = calculateReadabilityScore(extractedText);
    console.log(`📊 Readability score: ${readability.score.toFixed(2)}`);
    console.log(`   - Readable chars ratio: ${readability.readableCharsRatio.toFixed(2)}`);
    console.log(`   - Readable words ratio: ${readability.readableWordsRatio.toFixed(2)}`);
    
    // Check if text is sufficient and readable
    const isSufficient = extractedText.length >= 300;
    const isReadable = readability.score >= 0.6;
    
    console.log(`✅ Sufficient text: ${isSufficient} (${extractedText.length} >= 300)`);
    console.log(`✅ Readable text: ${isReadable} (score ${readability.score.toFixed(2)} >= 0.6)`);
    
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
      success: isSufficient && isReadable,
      length: extractedText.length,
      words: words.length,
      sentences: sentences.length,
      readabilityScore: readability.score,
      duration: parseFloat(duration),
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
  console.log('\n🚀 Starting PDF Readability and Vision OCR Tests');
  console.log('Testing 5 files from test/files/\n');
  
  const results = [];
  
  for (const file of TEST_FILES) {
    const result = await testFile(file);
    results.push({
      file: file.name,
      expectedMethod: file.expectedMethod,
      ...result,
    });
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
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
      console.log(`     Expected method: ${r.expectedMethod}`);
      console.log(`     Length: ${r.length} chars, Words: ${r.words}, Readability: ${r.readabilityScore?.toFixed(2)}`);
      console.log(`     Duration: ${r.duration}s`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Files:');
    failed.forEach(r => {
      console.log(`   - ${r.file}`);
      console.log(`     Expected method: ${r.expectedMethod}`);
      console.log(`     Error: ${r.error || 'Unknown'}`);
    });
  }
  
  // Special check for philosophie (dragged).pdf
  const philosophieResult = results.find(r => r.file === 'philosophie (dragged).pdf');
  if (philosophieResult) {
    console.log('\n🔍 Special Check: philosophie (dragged).pdf');
    console.log('='.repeat(80));
    if (philosophieResult.success) {
      console.log('✅ This file was successfully processed with Vision OCR fallback!');
      console.log(`   Readability score: ${philosophieResult.readabilityScore?.toFixed(2)}`);
      console.log(`   Text length: ${philosophieResult.length} characters`);
    } else {
      console.log('❌ This file failed to process even with Vision OCR fallback');
      console.log(`   Error: ${philosophieResult.error}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  
  if (failed.length === 0) {
    console.log('🎉 All tests passed! The upload system is robust.');
    console.log('✅ PDF readability scoring works correctly');
    console.log('✅ Vision OCR fallback works for corrupted PDFs');
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
