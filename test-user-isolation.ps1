# Test script for user isolation with Supabase
# Usage: .\test-user-isolation.ps1

Write-Host "User Isolation Test - Supabase" -ForegroundColor Cyan
Write-Host "============================================================"

# Load environment variables
$envFile = ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "[OK] Environment variables loaded" -ForegroundColor Green
} else {
    Write-Host "[ERROR] .env.local file not found" -ForegroundColor Red
    exit 1
}

$SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
$SUPABASE_ANON_KEY = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY

if (-not $SUPABASE_URL -or -not $SUPABASE_ANON_KEY) {
    Write-Host "[ERROR] Missing environment variables" -ForegroundColor Red
    exit 1
}

Write-Host "Supabase URL: $SUPABASE_URL" -ForegroundColor Gray
Write-Host ""

# Function to create user
function Create-User {
    param([string]$email, [string]$password)
    
    Write-Host "Creating user: $email" -ForegroundColor Yellow
    
    $body = @{email = $email; password = $password} | ConvertTo-Json
    
    try {
        $headers = @{"Content-Type" = "application/json"; "apikey" = $SUPABASE_ANON_KEY}
        $response = Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/signup" -Method POST -Headers $headers -Body $body
        
        Write-Host "[OK] User created!" -ForegroundColor Green
        Write-Host "   User ID: $($response.user.id)" -ForegroundColor Gray
        return $response
    }
    catch {
        Write-Host "[ERROR] Creation failed" -ForegroundColor Red
        return $null
    }
}

# Function to login
function Login-User {
    param([string]$email, [string]$password)
    
    Write-Host "Logging in: $email" -ForegroundColor Yellow
    
    $body = @{email = $email; password = $password} | ConvertTo-Json
    
    try {
        $headers = @{"Content-Type" = "application/json"; "apikey" = $SUPABASE_ANON_KEY}
        $response = Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/token?grant_type=password" -Method POST -Headers $headers -Body $body
        
        Write-Host "[OK] Login successful!" -ForegroundColor Green
        return $response
    }
    catch {
        Write-Host "[ERROR] Login failed" -ForegroundColor Red
        return $null
    }
}

# Function to get chapters
function Get-Chapters {
    param([string]$accessToken)
    
    Write-Host "Fetching chapters..." -ForegroundColor Yellow
    
    try {
        $headers = @{"apikey" = $SUPABASE_ANON_KEY; "Authorization" = "Bearer $accessToken"}
        $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/chapters?select=*" -Method GET -Headers $headers
        
        Write-Host "[OK] Found $($response.Count) chapter(s)" -ForegroundColor Green
        return $response
    }
    catch {
        Write-Host "[ERROR] Fetch failed" -ForegroundColor Red
        return @()
    }
}

# TEST 1: Create users
Write-Host ""
Write-Host "TEST 1: Creating users" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------"

$user1Email = "test1@levelup.com"
$user2Email = "test2@levelup.com"
$password = "TestPassw0rd!"

$user1 = Create-User -email $user1Email -password $password
Start-Sleep -Seconds 2

$user2 = Create-User -email $user2Email -password $password
Start-Sleep -Seconds 2

# TEST 2: Login
Write-Host ""
Write-Host "TEST 2: Logging in" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------"

$session1 = Login-User -email $user1Email -password $password
Start-Sleep -Seconds 1

$session2 = Login-User -email $user2Email -password $password
Start-Sleep -Seconds 1

if (-not $session1 -or -not $session2) {
    Write-Host ""
    Write-Host "[ERROR] Login failed" -ForegroundColor Red
    exit 1
}

# TEST 3: Check isolation
Write-Host ""
Write-Host "TEST 3: Checking isolation" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------"

Write-Host ""
Write-Host "User 1:" -ForegroundColor Magenta
$chapters1 = Get-Chapters -accessToken $session1.access_token

Write-Host ""
Write-Host "User 2:" -ForegroundColor Magenta
$chapters2 = Get-Chapters -accessToken $session2.access_token

# RESULTS
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "RESULTS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "User 1: $($chapters1.Count) chapter(s)"
Write-Host "User 2: $($chapters2.Count) chapter(s)"

if ($chapters1.Count -eq $chapters2.Count -and $chapters1.Count -gt 0) {
    Write-Host ""
    Write-Host "[WARNING] Both users see same chapters!" -ForegroundColor Yellow
    Write-Host "Isolation is NOT enabled." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To enable isolation:" -ForegroundColor Cyan
    Write-Host "1. Run database/add-user-isolation.sql in Supabase" -ForegroundColor White
    Write-Host "2. Update memory-store.ts to add user_id" -ForegroundColor White
    Write-Host "3. See USER_ISOLATION_GUIDE.md" -ForegroundColor White
} elseif ($chapters1.Count -eq 0 -and $chapters2.Count -eq 0) {
    Write-Host ""
    Write-Host "[OK] Empty database (normal)" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[SUCCESS] Isolation works!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "- USER_ISOLATION_GUIDE.md" -ForegroundColor White
Write-Host "- QUICK_USER_ISOLATION_SETUP.md" -ForegroundColor White

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Green
