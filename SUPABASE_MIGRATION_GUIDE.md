# 🚀 Supabase Migration Guide

Complete guide for migrating from MemoryStore to Supabase persistence.

## 📋 Overview

This migration replaces the in-memory Map-based storage (localStorage + globalThis) with Supabase database persistence. All data structures remain the same, but operations are now async and persisted in PostgreSQL.

## ✅ What's Been Done

### 1. SQL Schema (`database/supabase-schema.sql`)
- ✅ 6 tables created: `chapters`, `concepts`, `user_progress`, `chat_history`, `chapter_progress`, `translations`
- ✅ All foreign keys with `ON DELETE CASCADE`
- ✅ Proper indexes for performance
- ✅ JSONB columns for complex data (questions, messages, answers)
- ✅ Timestamptz for all dates

### 2. Rewritten MemoryStore (`lib/memory-store.ts`)
- ✅ All Map operations replaced with Supabase queries
- ✅ All methods converted to async
- ✅ Date handling (ISO string conversion)
- ✅ JSONB field handling
- ✅ Same API surface (method names unchanged)
- ✅ Cascade deletes handled by database

### 3. Migration Script (`scripts/migrate-memory-to-supabase.ts`)
- ✅ Reads old localStorage/backup data
- ✅ Migrates all 6 data types
- ✅ Respects foreign key order
- ✅ Progress logging
- ✅ Error handling

## 🔧 Configuration Required

### Step 1: Execute SQL Schema in Supabase

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `database/supabase-schema.sql`
5. Paste and click **Run**
6. Verify success (should see "Success. No rows returned")

**Verification:**
```sql
-- Run this to verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- chapters
- chapter_progress
- chat_history
- concepts
- translations
- user_progress

### Step 2: Environment Variables

Ensure these are set in your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For migration script
```

**No other configuration needed!** The Supabase client is already set up in `lib/supabase.ts`.

## 📦 Migration Process

### Option A: Migrate Existing Data

If you have existing data in localStorage that you want to preserve:

#### 1. Create a backup file

Run this in your browser console on the app:

```javascript
// Copy this entire block and run in browser console
const stored = localStorage.getItem('levelup_data');
if (stored) {
  const data = JSON.parse(stored);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'memory-store-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  console.log('✅ Backup downloaded!');
} else {
  console.log('⚠️ No data found in localStorage');
}
```

#### 2. Place backup file in project root

Move the downloaded `memory-store-backup.json` to your project root directory.

#### 3. Run migration script

```bash
npx ts-node scripts/migrate-memory-to-supabase.ts
```

The script will:
- Load data from the backup file
- Show a summary of what will be migrated
- Wait 3 seconds for you to cancel if needed
- Migrate all data in the correct order
- Show detailed progress and final statistics

### Option B: Start Fresh

If you don't have existing data or want to start fresh:

1. Execute the SQL schema (Step 1 above)
2. Start using the app - data will be saved to Supabase automatically
3. No migration needed!

## 🔄 Code Updates Required

### All API Routes Must Use Async/Await

Since all MemoryStore methods are now async, you need to update consuming code:

#### Before (Synchronous):
```typescript
import { memoryStore } from '@/lib/memory-store';

// In API route
const chapter = memoryStore.getChapter(id);
memoryStore.addConcept(concept);
```

#### After (Async):
```typescript
import { memoryStore } from '@/lib/memory-store';

// In API route
const chapter = await memoryStore.getChapter(id);
await memoryStore.addConcept(concept);
```

### Files That Need Updates

Based on the TypeScript errors, these files need async/await updates:

1. **`app/api/study-plan/generate/route.ts`**
   - Add `await` to all memoryStore calls
   - Make handler functions async if not already

2. **`app/api/chapters/[id]/route.ts`**
   - Add `await` to all memoryStore calls
   - Make handler functions async if not already

3. **Any other files importing memoryStore**
   - Search for `from '@/lib/memory-store'`
   - Add `await` to all method calls

### Example Fix

```typescript
// ❌ OLD (will cause errors)
export async function GET(request: Request) {
  const chapters = memoryStore.getAllChapters();
  return Response.json(chapters);
}

// ✅ NEW (correct)
export async function GET(request: Request) {
  const chapters = await memoryStore.getAllChapters();
  return Response.json(chapters);
}
```

## 🧪 Testing Checklist

After migration, test these features:

- [ ] Upload a new PDF/document
- [ ] View chapters list
- [ ] Start a chapter (chapter-based learning)
- [ ] Answer questions in a chapter
- [ ] View chapter progress
- [ ] Delete a chapter (verify cascade delete works)
- [ ] View concepts for a chapter
- [ ] Start learning a concept
- [ ] Chat with Aristo
- [ ] View progress/badges
- [ ] Language toggle (translations cache)

## 🔍 Verification Queries

Run these in Supabase SQL Editor to verify data:

```sql
-- Count records in each table
SELECT 'chapters' as table_name, COUNT(*) as count FROM chapters
UNION ALL
SELECT 'concepts', COUNT(*) FROM concepts
UNION ALL
SELECT 'user_progress', COUNT(*) FROM user_progress
UNION ALL
SELECT 'chat_history', COUNT(*) FROM chat_history
UNION ALL
SELECT 'chapter_progress', COUNT(*) FROM chapter_progress
UNION ALL
SELECT 'translations', COUNT(*) FROM translations;

-- View recent chapters
SELECT id, title, created_at 
FROM chapters 
ORDER BY created_at DESC 
LIMIT 5;

-- View concepts with their chapters
SELECT c.id, c.title, ch.title as chapter_title
FROM concepts c
JOIN chapters ch ON c.chapter_id = ch.id
LIMIT 10;

-- Check cascade delete setup
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

## 🚨 Troubleshooting

### "Module has no exported member 'memoryStore'"

**Cause:** TypeScript cache issue after file update.

**Fix:**
```bash
# Restart TypeScript server in VSCode
# Or restart your dev server
npm run dev
```

### "PGRST116" Error (Not Found)

**Cause:** Normal - means record doesn't exist yet.

**Fix:** This is handled in the code - returns `undefined` as expected.

### Migration Script Can't Find Data

**Cause:** No backup file or localStorage data.

**Fix:** 
1. Create backup from browser console (see Option A above)
2. Or start fresh (see Option B above)

### Foreign Key Violation During Migration

**Cause:** Data being inserted in wrong order.

**Fix:** The script already handles this by migrating in order:
1. Chapters (no dependencies)
2. Concepts (depends on chapters)
3. Progress (depends on concepts)
4. Chat history (depends on concepts)
5. Chapter progress (depends on chapters)
6. Translations (no dependencies)

If you still get errors, check that chapter IDs in concepts match existing chapters.

## 🎯 Performance Considerations

### Indexes Created

The schema includes indexes on:
- `chapters.order_index` - Fast chapter ordering
- `concepts.chapter_id` - Fast concept lookups by chapter
- `concepts(chapter_id, order_index)` - Fast ordered concept queries
- `user_progress.completed` - Fast filtering of completed concepts
- `chapter_progress.completed` - Fast filtering of completed chapters
- JSONB GIN indexes on `messages` and `answers` - Fast JSON queries

### Query Optimization

All queries use:
- Single-row lookups with `.single()`
- Proper ordering with `.order()`
- Efficient filtering with `.eq()`

### Caching

The `translations` table acts as a cache for translated content, reducing API calls.

## 🔐 Security Notes

### Current Setup (No RLS)

The current schema has **no Row Level Security (RLS)** policies. This is fine for:
- Single-user applications
- Development/testing
- Internal tools

### Adding RLS (Optional)

If you need multi-user support with data isolation:

```sql
-- Enable RLS on all tables
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Example: Allow users to see only their own data
-- (Requires adding user_id column to tables first)
CREATE POLICY "Users can view own chapters"
  ON chapters FOR SELECT
  USING (auth.uid() = user_id);
```

## 📊 Data Structure Reference

### Tables and Relationships

```
chapters (1) ──→ (many) concepts
    │                      │
    │                      ├──→ (1) user_progress
    │                      └──→ (1) chat_history
    │
    └──→ (1) chapter_progress

translations (standalone key-value store)
```

### JSONB Fields

1. **chapters.questions**: Array of ChapterQuestion objects
   ```json
   [
     {
       "id": "q1",
       "chapterId": "ch1",
       "questionNumber": 1,
       "type": "mcq",
       "question": "What is...",
       "options": ["A", "B", "C", "D"],
       "correctAnswer": "A",
       "points": 10
     }
   ]
   ```

2. **chat_history.messages**: Array of message objects
   ```json
   [
     {
       "role": "user",
       "content": "Hello",
       "timestamp": "2024-01-01T12:00:00Z"
     }
   ]
   ```

3. **chapter_progress.answers**: Array of answer objects
   ```json
   [
     {
       "questionId": "q1",
       "questionNumber": 1,
       "answer": "A",
       "correct": true,
       "score": 10,
       "feedback": "Correct!"
     }
   ]
   ```

## ✨ Benefits of This Migration

1. **True Persistence**: Data survives browser clears, server restarts
2. **Scalability**: Can handle large datasets efficiently
3. **Multi-device**: Same data accessible from any device
4. **Backup**: Automatic backups via Supabase
5. **Querying**: Powerful SQL queries available
6. **Real-time**: Can add real-time subscriptions later
7. **Security**: Can add RLS for multi-user support

## 🎉 Summary

**What you need to do:**

1. ✅ Run SQL schema in Supabase (one-time)
2. ✅ (Optional) Migrate existing data using the script
3. ✅ Update API routes to use async/await
4. ✅ Test the application
5. ✅ Enjoy persistent, scalable storage!

**What's automatic:**

- ✅ All data operations now use Supabase
- ✅ Cascade deletes handled by database
- ✅ Date conversions handled automatically
- ✅ JSONB serialization handled automatically
- ✅ No changes needed to UI components

---

**Questions or issues?** Check the troubleshooting section or review the code comments in the migration files.
