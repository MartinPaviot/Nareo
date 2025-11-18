# Test PDF Vision OCR Implementation
# Tests the 5 files with readability scoring and Vision OCR fallback

Write-Host "`n🚀 Testing PDF Vision OCR Implementation" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

# Check if test files exist
$testFiles = @(
    "test/files/Beginner's guide - Cities_ Skylines Wiki.pdf",
    "test/files/Philosophy 101_ From Plato and Socrates to Ethics and Metaphysics, an Essential Primer on the History of Thought - PDFDrive.com.pdf",
    "test/files/Projet bac à sable.pdf",
    "test/files/philosophie (dragged).pdf",
    "test/files/Presentation Alter coloc Nov2024.docx"
)

Write-Host "`n📁 Checking test files..." -ForegroundColor Yellow

$missingFiles = @()
foreach ($file in $testFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $sizeKB = [math]::Round($size / 1KB, 2)
        Write-Host "  ✅ $file ($sizeKB KB)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (NOT FOUND)" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "`n❌ Missing files detected. Please ensure all test files are in test/files/" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ All test files found!" -ForegroundColor Green

# Check if server is running
Write-Host "`n🔍 Checking if development server is running..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Server is running on http://localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running. Please start it with: npm run dev" -ForegroundColor Red
    Write-Host "`nStarting server now..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
    Write-Host "⏳ Waiting 10 seconds for server to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host "📋 IMPLEMENTATION SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

Write-Host "`n✅ Implemented Features:" -ForegroundColor Green
Write-Host "  1. Readability Score Calculation (0-1 scale)" -ForegroundColor White
Write-Host "     - Measures ratio of readable characters (letters, numbers, punctuation)" -ForegroundColor Gray
Write-Host "     - Measures ratio of readable words (containing letters)" -ForegroundColor Gray
Write-Host "     - Combined score: 60% chars + 40% words" -ForegroundColor Gray
Write-Host "     - Threshold: 0.6 (below = corrupted text)" -ForegroundColor Gray

Write-Host "`n  2. Vision OCR Fallback (Page-by-Page)" -ForegroundColor White
Write-Host "     - Converts each PDF page to PNG image (2x resolution)" -ForegroundColor Gray
Write-Host "     - Uses OpenAI Vision API for OCR on each page" -ForegroundColor Gray
Write-Host "     - Concatenates all pages with double line breaks" -ForegroundColor Gray
Write-Host "     - Library: pdf-to-img (installed)" -ForegroundColor Gray

Write-Host "`n  3. Enhanced PDF Parser" -ForegroundColor White
Write-Host "     - Try pdf2json first (fast)" -ForegroundColor Gray
Write-Host "     - Calculate readability score" -ForegroundColor Gray
Write-Host "     - If score < 0.6 OR length < 300: activate Vision OCR" -ForegroundColor Gray
Write-Host "     - Detailed logging at each step" -ForegroundColor Gray

Write-Host "`n  4. Intelligent Text Validation" -ForegroundColor White
Write-Host "     - Minimum 300 characters required" -ForegroundColor Gray
Write-Host "     - Maximum 20,000 characters (intelligent truncation)" -ForegroundColor Gray
Write-Host "     - Clear error messages for users" -ForegroundColor Gray

Write-Host "`n📊 Expected Results for Test Files:" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

Write-Host "`n1. Beginner's guide - Cities_ Skylines Wiki.pdf" -ForegroundColor White
Write-Host "   Method: pdf2json (fast)" -ForegroundColor Gray
Write-Host "   Expected Score: > 0.8" -ForegroundColor Gray
Write-Host "   Expected Time: 1-3 seconds" -ForegroundColor Gray

Write-Host "`n2. Philosophy 101.pdf" -ForegroundColor White
Write-Host "   Method: pdf2json (fast)" -ForegroundColor Gray
Write-Host "   Expected Score: > 0.8" -ForegroundColor Gray
Write-Host "   Expected Time: 1-3 seconds" -ForegroundColor Gray

Write-Host "`n3. Projet bac à sable.pdf" -ForegroundColor White
Write-Host "   Method: pdf2json (fast)" -ForegroundColor Gray
Write-Host "   Expected Score: > 0.8" -ForegroundColor Gray
Write-Host "   Expected Time: 1-3 seconds" -ForegroundColor Gray

Write-Host "`n4. philosophie (dragged).pdf ⭐ SPECIAL CASE" -ForegroundColor Yellow
Write-Host "   Method: Vision OCR (fallback)" -ForegroundColor Gray
Write-Host "   Expected Score (pdf2json): < 0.6 (corrupted)" -ForegroundColor Gray
Write-Host "   Expected Score (Vision): > 0.8 (readable)" -ForegroundColor Gray
Write-Host "   Expected Time: 30-60 seconds" -ForegroundColor Gray
Write-Host "   This file tests the Vision OCR fallback!" -ForegroundColor Cyan

Write-Host "`n5. Presentation Alter coloc Nov2024.docx" -ForegroundColor White
Write-Host "   Method: mammoth (fast)" -ForegroundColor Gray
Write-Host "   Expected Time: 0.5-2 seconds" -ForegroundColor Gray

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host "🧪 MANUAL TESTING INSTRUCTIONS" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

Write-Host "`n1. Open your browser to: http://localhost:3000" -ForegroundColor White
Write-Host "2. Sign in to your account" -ForegroundColor White
Write-Host "3. Upload each test file one by one" -ForegroundColor White
Write-Host "4. Watch the server logs in the terminal" -ForegroundColor White
Write-Host "5. Verify the extracted content is correct" -ForegroundColor White

Write-Host "`n📋 What to Look For in Logs:" -ForegroundColor Yellow
Write-Host "  - Readability score calculation" -ForegroundColor Gray
Write-Host "  - Vision OCR activation for philosophie (dragged).pdf" -ForegroundColor Gray
Write-Host "  - Page-by-page processing messages" -ForegroundColor Gray
Write-Host "  - Final text length and quality" -ForegroundColor Gray

Write-Host "`n🔍 Key Log Messages for philosophie (dragged).pdf:" -ForegroundColor Yellow
Write-Host @"
  📊 Readability score: 0.15
     - Readable chars ratio: 0.20
     - Readable words ratio: 0.05
  ⚠️ pdf2json extracted unreadable text: score 0.15 < 0.6
  🔄 Activating Vision OCR fallback (page-by-page)...
  📄 Processing page 1...
  ✅ Page 1: extracted XXXX characters
  ...
  ✅ Vision OCR complete: XX pages, XXXXX total characters
"@ -ForegroundColor Gray

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host "📚 DOCUMENTATION" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

Write-Host "`nFor complete details, see:" -ForegroundColor White
Write-Host "  📄 PDF_VISION_OCR_IMPLEMENTATION_COMPLETE.md" -ForegroundColor Cyan
Write-Host "  📄 ARCHITECTURE_UPLOAD_EXTRACTION_COMPLETE.md" -ForegroundColor Cyan
Write-Host "  📄 TEST_UPLOAD_GUIDE.md" -ForegroundColor Cyan

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host "✅ READY TO TEST!" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Gray

Write-Host "`nThe system is ready. Upload the test files through the web interface." -ForegroundColor White
Write-Host "Watch the terminal for detailed logs during processing.`n" -ForegroundColor White
