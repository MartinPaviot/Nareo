import fs from 'fs';
import path from 'path';

const testDir = 'public/Test';
const filename = '1. M&A.pdf';
const filePath = path.join(testDir, filename);

console.log(`Analyzing: ${filename}\n`);

const buffer = fs.readFileSync(filePath);

const { parsePDF } = await import('./lib/pdf-parser.js');
const text = await parsePDF(buffer);

console.log('=== STATISTIQUES ===');
console.log('Longueur totale:', text.length, 'caractères');
console.log('');

// Chercher les formules clés
const formulas = ['WACC', 'FCFE', 'FCFF', 'Terminal Value', 'TV', 'DCF', 'CAPM', 'Beta', 'EV/EBITDA', 'k_wacc', 'kwacc', 'EBIT', 'NPV', 'IRR'];
console.log('=== FORMULES/TERMES TROUVÉS ===');
for (const f of formulas) {
  const regex = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const matches = text.match(regex) || [];
  console.log(`${f}: ${matches.length > 0 ? 'OUI (' + matches.length + ' occurrences)' : 'NON'}`);
}

// Chercher des patterns de formules (symboles mathématiques)
console.log('\n=== PATTERNS MATHÉMATIQUES ===');
const mathPatterns = [
  { name: 'Sigma (Σ)', pattern: /[Σ∑]/g },
  { name: 'Équations (=)', pattern: /[A-Z]+\s*=\s*[A-Z]/g },
  { name: 'Fractions (/)', pattern: /\d+\s*\/\s*\d+/g },
  { name: 'Puissances (^)', pattern: /\^/g },
  { name: 'Indices (_)', pattern: /_[a-z0-9]/gi },
  { name: 'Beta (β)', pattern: /[βBeta]/gi },
];

for (const p of mathPatterns) {
  const matches = text.match(p.pattern) || [];
  console.log(`${p.name}: ${matches.length} occurrences`);
}

// Afficher les 15000 premiers caractères (ce qui était envoyé avant)
console.log('\n=== PREMIERS 15000 CARACTÈRES (ancienne limite) ===');
const first15k = text.substring(0, 15000);
console.log('Contient WACC?', first15k.includes('WACC'));
console.log('Contient FCFE?', first15k.includes('FCFE'));
console.log('Contient Terminal?', first15k.includes('Terminal'));
console.log('Contient DCF?', first15k.includes('DCF'));

// Trouver où se trouve WACC
const waccIndex = text.indexOf('WACC');
if (waccIndex > 0) {
  console.log('\n=== WACC trouvé à la position', waccIndex, '===');
  console.log('Extrait:');
  console.log(text.substring(waccIndex - 50, waccIndex + 300));
}

// Trouver où se trouve Terminal Value
const tvIndex = text.indexOf('Terminal');
if (tvIndex > 0) {
  console.log('\n=== Terminal Value trouvé à la position', tvIndex, '===');
  console.log('Extrait:');
  console.log(text.substring(tvIndex - 50, tvIndex + 300));
}

// Écrire le texte complet dans un fichier pour analyse
fs.writeFileSync('test/ma-extracted.txt', text);
console.log('\n=== Texte complet écrit dans test/ma-extracted.txt ===');
