# Script de test complet pour tous les endpoints
# Usage: .\test-all-endpoints.ps1

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "TEST COMPLET DE TOUS LES ENDPOINTS" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"
$testResults = @()

# Fonction pour tester un endpoint
function Test-Endpoint {
    param(
        [string]$method,
        [string]$url,
        [string]$description,
        [hashtable]$body = $null
    )
    
    Write-Host "Testing: $description" -ForegroundColor Yellow
    Write-Host "  $method $url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $url
            Method = $method
            ContentType = "application/json"
            TimeoutSec = 30
        }
        
        if ($body) {
            $params.Body = ($body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-WebRequest @params
        $statusCode = $response.StatusCode
        
        if ($statusCode -ge 200 -and $statusCode -lt 300) {
            Write-Host "  [OK] Status: $statusCode" -ForegroundColor Green
            $script:testResults += @{
                Test = $description
                Status = "PASS"
                StatusCode = $statusCode
            }
            return $true
        } else {
            Write-Host "  [WARN] Status: $statusCode" -ForegroundColor Yellow
            $script:testResults += @{
                Test = $description
                Status = "WARN"
                StatusCode = $statusCode
            }
            return $false
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  [FAIL] Status: $statusCode" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:testResults += @{
            Test = $description
            Status = "FAIL"
            StatusCode = $statusCode
            Error = $_.Exception.Message
        }
        return $false
    }
    finally {
        Write-Host ""
    }
}

# =============================================================================
# TEST 1: GET /api/chapters
# =============================================================================
Write-Host "TEST 1: Recuperation des chapitres" -ForegroundColor Cyan
Write-Host "-----------------------------------------------------------"
Test-Endpoint -method "GET" -url "$baseUrl/api/chapters" -description "GET /api/chapters"

# =============================================================================
# TEST 2: GET /api/chapters/[id]
# =============================================================================
Write-Host "TEST 2: Recuperation d'un chapitre specifique" -ForegroundColor Cyan
Write-Host "-----------------------------------------------------------"

# D'abord, récupérer la liste des chapitres pour obtenir un ID
try {
    $chaptersResponse = Invoke-RestMethod -Uri "$baseUrl/api/chapters" -Method GET
    if ($chaptersResponse.Count -gt 0) {
        $chapterId = $chaptersResponse[0].id
        Write-Host "  Using chapter ID: $chapterId" -ForegroundColor Gray
        Test-Endpoint -method "GET" -url "$baseUrl/api/chapters/$chapterId" -description "GET /api/chapters/[id]"
        
        # TEST 3: GET /api/chapters/[id]/progress
        Write-Host "TEST 3: Recuperation du progres d'un chapitre" -ForegroundColor Cyan
        Write-Host "-----------------------------------------------------------"
        Test-Endpoint -method "GET" -url "$baseUrl/api/chapters/$chapterId/progress" -description "GET /api/chapters/[id]/progress"
    } else {
        Write-Host "  [SKIP] No chapters found" -ForegroundColor Yellow
        Write-Host ""
    }
}
catch {
    Write-Host "  [FAIL] Could not fetch chapters" -ForegroundColor Red
    Write-Host ""
}

# =============================================================================
# TEST 4: POST /api/translate/content
# =============================================================================
Write-Host "TEST 4: Traduction de contenu" -ForegroundColor Cyan
Write-Host "-----------------------------------------------------------"
$translateBody = @{
    text = "Hello World"
    targetLanguage = "fr"
}
Test-Endpoint -method "POST" -url "$baseUrl/api/translate/content" -description "POST /api/translate/content" -body $translateBody

# =============================================================================
# TEST 5: GET /api/courses
# =============================================================================
Write-Host "TEST 5: Recuperation des cours" -ForegroundColor Cyan
Write-Host "-----------------------------------------------------------"
Test-Endpoint -method "GET" -url "$baseUrl/api/courses" -description "GET /api/courses"

# =============================================================================
# TEST 6: Verification de l'application web
# =============================================================================
Write-Host "TEST 6: Pages web" -ForegroundColor Cyan
Write-Host "-----------------------------------------------------------"
Test-Endpoint -method "GET" -url "$baseUrl/" -description "GET / (Home page)"
Test-Endpoint -method "GET" -url "$baseUrl/dashboard" -description "GET /dashboard"

# =============================================================================
# RESULTATS
# =============================================================================
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "RESULTATS DES TESTS" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

$passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$warnCount = ($testResults | Where-Object { $_.Status -eq "WARN" }).Count
$totalCount = $testResults.Count

Write-Host "Total tests: $totalCount" -ForegroundColor White
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host ""

# Afficher les details
Write-Host "Details:" -ForegroundColor Cyan
foreach ($result in $testResults) {
    $color = switch ($result.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "WARN" { "Yellow" }
    }
    Write-Host "  [$($result.Status)] $($result.Test) - Status: $($result.StatusCode)" -ForegroundColor $color
    if ($result.Error) {
        Write-Host "    Error: $($result.Error)" -ForegroundColor Red
    }
}

Write-Host ""
if ($failCount -eq 0) {
    Write-Host "[SUCCESS] Tous les tests ont reussi!" -ForegroundColor Green
} else {
    Write-Host "[WARNING] $failCount test(s) ont echoue" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "PROCHAINES ETAPES" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour tester l'upload de PDF:" -ForegroundColor Yellow
Write-Host "  1. Ouvrez http://localhost:3000 dans votre navigateur" -ForegroundColor White
Write-Host "  2. Uploadez un fichier PDF ou image" -ForegroundColor White
Write-Host "  3. Verifiez que le chapitre est cree" -ForegroundColor White
Write-Host ""
Write-Host "Pour tester la suppression:" -ForegroundColor Yellow
Write-Host "  1. Allez sur le dashboard" -ForegroundColor White
Write-Host "  2. Cliquez sur 'Delete' pour un chapitre" -ForegroundColor White
Write-Host "  3. Verifiez que le chapitre est supprime" -ForegroundColor White
Write-Host ""
