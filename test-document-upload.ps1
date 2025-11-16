# PowerShell Test Script for Document Upload API
# Tests PDF and DOCX file uploads

Write-Host "🧪 Testing Document Upload API" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$apiUrl = "http://localhost:3000/api/upload"

# Test 1: PDF Upload
Write-Host "📋 Test 1: Upload PDF Document" -ForegroundColor Yellow
Write-Host "--------------------------------"
if (Test-Path "test-sample.pdf") {
    Write-Host "Uploading test-sample.pdf..."
    try {
        $pdfFile = Get-Item "test-sample.pdf"
        $boundary = [System.Guid]::NewGuid().ToString()
        $LF = "`r`n"
        
        $bodyLines = (
            "--$boundary",
            "Content-Disposition: form-data; name=`"file`"; filename=`"$($pdfFile.Name)`"",
            "Content-Type: application/pdf$LF",
            [System.IO.File]::ReadAllText($pdfFile.FullName),
            "--$boundary--$LF"
        ) -join $LF
        
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyLines
        
        Write-Host "✅ PDF upload successful!" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "❌ PDF upload failed" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  test-sample.pdf not found, skipping PDF test" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Test 2: Invalid File Type" -ForegroundColor Yellow
Write-Host "--------------------------------"
Write-Host "Testing with invalid file type..."
"This is a test file" | Out-File -FilePath "test-invalid.txt" -Encoding ASCII

try {
    $txtFile = Get-Item "test-invalid.txt"
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$($txtFile.Name)`"",
        "Content-Type: text/plain$LF",
        [System.IO.File]::ReadAllText($txtFile.FullName),
        "--$boundary--$LF"
    ) -join $LF
    
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyLines
    
    Write-Host "❌ Should have rejected invalid file type" -ForegroundColor Red
    $response | ConvertTo-Json
} catch {
    Write-Host "✅ Correctly rejected invalid file type" -ForegroundColor Green
    Write-Host "Error message: $($_.Exception.Message)" -ForegroundColor Cyan
}

Remove-Item "test-invalid.txt" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "🎉 Testing Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: For full testing including DOCX and images, use a REST client like Postman or Insomnia"
Write-Host "Or test directly through the web UI at http://localhost:3000"
