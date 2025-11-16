# API Key Setup Guide

## Current Issue

The application is showing an authentication error:
```
❌ Error: 401 Authentication Error, LiteLLM Virtual Key expected.
Received=fdb7eb5d36fd4dafe3b6dce08abf83d2dc384405820a890283145365c2cc07d6, 
expected to start with 'sk-'.
```

## What This Means

The Blackbox API key format has changed or is incorrect. However, **the fallback system is working correctly** - the app generated default Machine Learning concepts when the API failed.

## Solutions

### Option 1: Update API Key (Recommended)

1. Get a valid Blackbox API key from https://www.blackbox.ai
2. Update your `.env.local` file:
```bash
OPENAI_API_KEY=sk-your-actual-blackbox-key-here
```
3. Restart the development server

### Option 2: Use OpenAI Directly

If you have an OpenAI API key, you can use it instead:

1. Update `.env.local`:
```bash
OPENAI_API_KEY=sk-your-openai-key-here
```

2. Update `lib/openai-vision.ts`:
```typescript
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Remove or comment out baseURL to use OpenAI directly
  // baseURL: 'https://api.blackbox.ai/v1',
});
```

### Option 3: Continue with Fallback (Demo Mode)

The application works without API access using fallback concepts:
- ✅ Upload still works
- ✅ Concepts are generated (default ML concepts)
- ✅ Learning flow works
- ❌ No real text extraction from images
- ❌ Generic questions instead of contextual ones

**This is fine for testing the UI and flow!**

## Current Status

### What's Working ✅
- Image upload
- Chapter creation
- Concept generation (fallback)
- localStorage persistence
- Navigation
- Learning flow

### What's Not Working ❌
- Text extraction from images (needs valid API key)
- Context-aware questions (needs valid API key)
- Context-aware feedback (needs valid API key)

## Testing Without API

You can still test the complete flow:

1. **Upload Image** - Works (uses fallback concepts)
2. **View Chapter** - Works (shows default ML concepts)
3. **Start Learning** - Works (generic questions)
4. **Answer Questions** - Works (basic evaluation)
5. **Complete Phases** - Works (scoring and badges)

## Fixing the API Key

### Step 1: Check Current Key
```bash
# In your terminal
echo $OPENAI_API_KEY
```

### Step 2: Get New Key
- Go to https://www.blackbox.ai
- Sign in / Sign up
- Navigate to API settings
- Generate new API key (should start with 'sk-')

### Step 3: Update Environment
```bash
# Create or update .env.local
OPENAI_API_KEY=sk-your-new-key-here
```

### Step 4: Restart Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 5: Test
Upload an image and check console for:
```
✅ Extracted X characters of text from image
```

## Additional Issue: Missing Mascot Images

The console also shows:
```
GET /mascot/Happy.png 404
GET /mascot/Talking.png 404
```

### Quick Fix:
The mascot images are using emoji fallback, so this doesn't break functionality. To fix:

1. Check if files exist in `public/mascot/`
2. Ensure filenames match exactly (case-sensitive)
3. Or update `AristoAvatar.tsx` to use correct filenames

## Summary

**Current State:**
- ✅ Core implementation complete
- ✅ Fallback system working
- ✅ localStorage persistence working
- ⚠️ API key needs updating for full functionality

**To Get Full Functionality:**
1. Update API key in `.env.local`
2. Restart server
3. Upload image again
4. Verify text extraction works

**For Demo/Testing:**
- Current state is sufficient to demonstrate the UI and flow
- Fallback concepts allow testing all features
- Just won't have real text extraction from images
