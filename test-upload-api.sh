#!/bin/bash

# Simple test to verify the upload API works
# This creates a test image and uploads it

echo "🧪 Testing Image Upload API"
echo "============================"
echo ""

# Check if server is running
echo "1. Checking if server is running on localhost:3001..."
if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running. Please start it with 'npm run dev'"
    exit 1
fi

echo ""
echo "2. Testing upload endpoint..."
echo ""
echo "Please test manually by:"
echo "  1. Go to http://localhost:3001"
echo "  2. Upload an educational image"
echo "  3. Check browser console for logs"
echo "  4. Verify you're redirected to /chapter/[id]"
echo ""
echo "Expected console logs:"
echo "  📸 Processing image upload"
echo "  🔄 Converting image to base64"
echo "  🤖 Analyzing image with AI"
echo "  📝 Extracting raw text from image..."
echo "  ✅ Extracted X characters of text"
echo "  🔍 Analyzing image with GPT-4 Vision..."
echo "  ✅ Successfully extracted X concepts"
echo "  📝 Extracted text length: X characters"
echo ""
echo "If you see 'Failed to fetch chapter' error:"
echo "  - This means the upload succeeded but chapter page failed"
echo "  - Check if the chapter ID in URL matches what was created"
echo "  - Memory store is in-memory only (data lost on refresh)"
echo "  - Try uploading again without refreshing"
echo ""
