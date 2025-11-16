# Build Fixes Applied

This document tracks the fixes applied to resolve build errors in the LevelUp project.

## Issues Fixed

### 1. Tailwind CSS v4 Compatibility
**Error**: `Cannot apply unknown utility class 'border-border'`

**Fix**: 
- Installed `@tailwindcss/postcss` package
- Updated `postcss.config.js` to use `@tailwindcss/postcss` instead of separate `tailwindcss` and `autoprefixer` plugins
- Simplified `app/globals.css` to use `@import "tailwindcss"` instead of `@tailwind` directives
- Removed `@apply` directives that were incompatible with Tailwind v4
- Converted custom utilities to plain CSS

### 2. Next.js 16 Async Params
**Error**: Type error in dynamic route handlers - params must be Promise

**Fix**: Updated all API route handlers with dynamic segments to handle async params:
- `app/api/chapters/[id]/route.ts`
- `app/api/concepts/[id]/route.ts`
- `app/api/sessions/[id]/route.ts`

Changed from:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
)
```

To:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ... rest of code
}
```

### 3. PDF Parser Import
**Error**: Module import issue with `pdf-parse`

**Fix**: Changed import statement in `lib/pdf-parser.ts`:
```typescript
// From:
import pdfParse from 'pdf-parse';

// To:
import * as pdfParse from 'pdf-parse';
```

### 4. Next.js Config Warning
**Warning**: `images.domains` is deprecated

**Fix**: Updated `next.config.js` to use `remotePatterns` instead:
```javascript
images: {
  remotePatterns: [
    {
      protocol: 'http',
      hostname: 'localhost',
    },
    {
      protocol: 'https',
      hostname: '*.supabase.co',
    },
  ],
}
```

## Dependencies Added
- `@tailwindcss/postcss` - Required for Tailwind CSS v4 compatibility

## Notes
- Client components (`'use client'`) don't need async params changes
- Only server-side API routes with dynamic segments need the async params fix
- Tailwind v4 requires different CSS syntax compared to v3
