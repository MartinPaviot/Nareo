#!/bin/bash

# Test Document Upload API
# Tests PDF and DOCX file uploads

echo "🧪 Testing Document Upload API"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API endpoint
API_URL="http://localhost:3000/api/upload"

echo "📋 Test 1: Upload PDF Document"
echo "--------------------------------"
if [ -f "test-sample.pdf" ]; then
    echo "Uploading test-sample.pdf..."
    response=$(curl -s -X POST "$API_URL" \
        -F "file=@test-sample.pdf" \
        -H "Accept: application/json")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ PDF upload successful!${NC}"
        echo "Response:"
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ PDF upload failed${NC}"
        echo "Response:"
        echo "$response" | jq '.'
    fi
else
    echo -e "${YELLOW}⚠️  test-sample.pdf not found, skipping PDF test${NC}"
fi

echo ""
echo "📋 Test 2: Upload DOCX Document"
echo "--------------------------------"
if [ -f "test-sample.docx" ]; then
    echo "Uploading test-sample.docx..."
    response=$(curl -s -X POST "$API_URL" \
        -F "file=@test-sample.docx" \
        -H "Accept: application/json")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ DOCX upload successful!${NC}"
        echo "Response:"
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ DOCX upload failed${NC}"
        echo "Response:"
        echo "$response" | jq '.'
    fi
else
    echo -e "${YELLOW}⚠️  test-sample.docx not found, skipping DOCX test${NC}"
    echo "You can create a test DOCX file with sample educational content"
fi

echo ""
echo "📋 Test 3: Upload Image (for comparison)"
echo "--------------------------------"
if [ -f "test-ml-image.png" ] || [ -f "test-image.jpg" ]; then
    test_image=""
    if [ -f "test-ml-image.png" ]; then
        test_image="test-ml-image.png"
    elif [ -f "test-image.jpg" ]; then
        test_image="test-image.jpg"
    fi
    
    echo "Uploading $test_image..."
    response=$(curl -s -X POST "$API_URL" \
        -F "file=@$test_image" \
        -H "Accept: application/json")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Image upload successful!${NC}"
        echo "Response:"
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ Image upload failed${NC}"
        echo "Response:"
        echo "$response" | jq '.'
    fi
else
    echo -e "${YELLOW}⚠️  No test image found, skipping image test${NC}"
fi

echo ""
echo "📋 Test 4: Invalid File Type"
echo "--------------------------------"
echo "Testing with invalid file type..."
echo "This is a test file" > test-invalid.txt
response=$(curl -s -X POST "$API_URL" \
    -F "file=@test-invalid.txt" \
    -H "Accept: application/json")

if echo "$response" | grep -q '"error"'; then
    echo -e "${GREEN}✅ Correctly rejected invalid file type${NC}"
    echo "Response:"
    echo "$response" | jq '.'
else
    echo -e "${RED}❌ Should have rejected invalid file type${NC}"
    echo "Response:"
    echo "$response" | jq '.'
fi
rm -f test-invalid.txt

echo ""
echo "================================"
echo "🎉 Testing Complete!"
echo ""
echo "Summary:"
echo "- PDF upload: Check results above"
echo "- DOCX upload: Check results above"
echo "- Image upload: Check results above"
echo "- Invalid file rejection: Check results above"
echo ""
echo "Note: Make sure your Next.js dev server is running on http://localhost:3000"
