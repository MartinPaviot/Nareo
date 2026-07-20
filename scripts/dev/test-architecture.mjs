import fs from 'fs';

const files = fs.readdirSync('public/Test');
const coursFile = files.find(f => f.toLowerCase().includes('initiation'));
console.log('Testing:', coursFile);

const buffer = fs.readFileSync('public/Test/' + coursFile);
console.log('File size:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');

const { parsePDF } = await import('./lib/pdf-parser.js');
console.log('Parsing...');
const result = await parsePDF(buffer);
console.log('\n✅ SUCCESS!');
console.log('Length:', result.length, 'chars');
console.log('First 400 chars:', result.substring(0, 400));
