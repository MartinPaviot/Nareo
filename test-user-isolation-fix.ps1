# User Isolation Fix - Test Script
# This script helps verify that the user isolation fix is working correctly

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "User Isolation Fix - Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if /api/chapters requires authentication
Write-Host "Test 1: Testing /api/chapters authentication..." -ForegroundColor Yellow
Write-Host "Expected: 401 Unauthorized (without auth)" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/chapters" -Method GET -ErrorAction Stop
    Write-Host "❌ FAIL: Got status $($response.StatusCode) - Should be 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ PASS: Got 401 Unauthorized as expected" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Got unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 2: Check if /api/courses requires authentication
Write-Host "Test 2: Testing /api/courses authentication..." -ForegroundColor Yellow
Write-Host "Expected: 401 Unauthorized (without auth)" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/courses" -Method GET -ErrorAction Stop
    Write-Host "❌ FAIL: Got status $($response.StatusCode) - Should be 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ PASS: Got 401 Unauthorized as expected" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Got unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Manual Testing Instructions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Manual Testing Required" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Please perform the following manual tests:" -ForegroundColor Yellow
Write-Host ""

Write-Host "Test 3: New User Signup" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:3000 in an incognito window" -ForegroundColor Gray
Write-Host "  2. Sign up with a NEW email (e.g., testuser1@example.com)" -ForegroundColor Gray
Write-Host "  3. Navigate to the dashboard" -ForegroundColor Gray
Write-Host "  4. ✅ Expected: You should see ZERO courses" -ForegroundColor Green
Write-Host "  5. ✅ Expected: You should see the 'Get Started' empty state" -ForegroundColor Green
Write-Host ""

Write-Host "Test 4: User A Creates Content" -ForegroundColor Yellow
Write-Host "  1. As the new user (testuser1), upload a document" -ForegroundColor Gray
Write-Host "  2. Wait for processing to complete" -ForegroundColor Gray
Write-Host "  3. ✅ Expected: You should see YOUR course on the dashboard" -ForegroundColor Green
Write-Host "  4. Note the course title for verification" -ForegroundColor Gray
Write-Host ""

Write-Host "Test 5: User B Isolation" -ForegroundColor Yellow
Write-Host "  1. Sign out from testuser1" -ForegroundColor Gray
Write-Host "  2. Open a NEW incognito window" -ForegroundColor Gray
Write-Host "  3. Sign up with a DIFFERENT email (e.g., testuser2@example.com)" -ForegroundColor Gray
Write-Host "  4. Navigate to the dashboard" -ForegroundColor Gray
Write-Host "  5. ✅ Expected: You should see ZERO courses" -ForegroundColor Green
Write-Host "  6. ✅ Expected: You should NOT see testuser1's course" -ForegroundColor Green
Write-Host ""

Write-Host "Test 6: User B Creates Content" -ForegroundColor Yellow
Write-Host "  1. As testuser2, upload a DIFFERENT document" -ForegroundColor Gray
Write-Host "  2. Wait for processing to complete" -ForegroundColor Gray
Write-Host "  3. ✅ Expected: You should see ONLY YOUR course" -ForegroundColor Green
Write-Host "  4. ✅ Expected: You should NOT see testuser1's course" -ForegroundColor Green
Write-Host ""

Write-Host "Test 7: User A Data Persistence" -ForegroundColor Yellow
Write-Host "  1. Sign out from testuser2" -ForegroundColor Gray
Write-Host "  2. Sign back in as testuser1" -ForegroundColor Gray
Write-Host "  3. Navigate to the dashboard" -ForegroundColor Gray
Write-Host "  4. ✅ Expected: You should see ONLY YOUR original course" -ForegroundColor Green
Write-Host "  5. ✅ Expected: You should NOT see testuser2's course" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server Logs to Monitor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Watch for these log messages in your server console:" -ForegroundColor Yellow
Write-Host "  📊 Fetching chapters for user: [user-id]" -ForegroundColor Gray
Write-Host "  ✅ Returning X chapters and Y progress records for user [user-id]" -ForegroundColor Gray
Write-Host "  📊 Fetching courses for user: [user-id]" -ForegroundColor Gray
Write-Host "  ✅ Returning X courses for user [user-id]" -ForegroundColor Gray
Write-Host ""
Write-Host "Warning logs to watch for:" -ForegroundColor Yellow
Write-Host "  ⚠️ Unauthorized access attempt to /api/chapters" -ForegroundColor Gray
Write-Host "  ⚠️ Unauthorized access attempt to /api/courses" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database Verification (Optional)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run these SQL queries in Supabase SQL Editor:" -ForegroundColor Yellow
Write-Host ""
Write-Host "-- Check RLS is enabled" -ForegroundColor Gray
Write-Host "SELECT tablename, rowsecurity FROM pg_tables" -ForegroundColor Gray
Write-Host "WHERE schemaname = 'public' AND tablename IN ('chapters', 'chapter_progress');" -ForegroundColor Gray
Write-Host ""
Write-Host "-- Check user_id is set on all chapters" -ForegroundColor Gray
Write-Host "SELECT id, title, user_id FROM chapters;" -ForegroundColor Gray
Write-Host ""
Write-Host "-- Verify each user only sees their data" -ForegroundColor Gray
Write-Host "SELECT user_id, COUNT(*) as chapter_count FROM chapters GROUP BY user_id;" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Success Criteria" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ All automated tests pass (401 responses)" -ForegroundColor Green
Write-Host "✅ New users see zero courses on first login" -ForegroundColor Green
Write-Host "✅ Each user only sees their own courses" -ForegroundColor Green
Write-Host "✅ No data leakage between users" -ForegroundColor Green
Write-Host "✅ Server logs show correct user_id filtering" -ForegroundColor Green
Write-Host ""

Write-Host "If all tests pass, the user isolation fix is working correctly! 🎉" -ForegroundColor Cyan
Write-Host ""
