#!/bin/bash

echo "🧪 LevelUp API Testing Suite"
echo "=============================="
echo ""

BASE_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -e "${YELLOW}Testing: $name${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ PASS${NC} - HTTP $http_code"
        echo "Response: ${body:0:100}..."
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - HTTP $http_code"
        echo "Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

echo "1. Testing Homepage"
echo "-------------------"
test_endpoint "Homepage" "GET" "/"

echo ""
echo "2. Testing API Endpoints"
echo "------------------------"

# Note: These tests will fail without actual data, but we can check if endpoints respond
echo "Note: Some tests may fail without uploaded data - this is expected"
echo ""

# Test with a dummy chapter ID
test_endpoint "Get Chapter (dummy)" "GET" "/api/chapters/test-id"

# Test with a dummy concept ID  
test_endpoint "Get Concept (dummy)" "GET" "/api/concepts/test-id"

# Test chat question endpoint
test_endpoint "Generate Question" "POST" "/api/chat/question" \
    '{"conceptId":"test-id","phase":1}'

# Test chat evaluate endpoint
test_endpoint "Evaluate Answer" "POST" "/api/chat/evaluate" \
    '{"conceptId":"test-id","phase":1,"answer":"test answer"}'

# Test session endpoint
test_endpoint "Get Session (dummy)" "GET" "/api/sessions/test-session"

echo ""
echo "=============================="
echo "Test Summary"
echo "=============================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""
echo "Note: To fully test the application:"
echo "1. Upload a PDF via the web interface"
echo "2. Use the returned IDs to test specific endpoints"
echo "3. Complete a learning flow to test all features"
