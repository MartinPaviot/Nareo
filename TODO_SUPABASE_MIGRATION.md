# 📋 Supabase Migration TODO

## ✅ Completed (By AI)

- [x] Created SQL schema (`database/supabase-schema.sql`)
- [x] Rewrote memory-store.ts with Supabase
- [x] Created migration script (`scripts/migrate-memory-to-supabase.ts`)
- [x] Created comprehensive documentation
- [x] Preserved all business logic
- [x] Maintained same API (just async)

---

## 🔧 Required Actions (By You)

### Step 1: Execute SQL Schema ⏱️ 2 minutes

- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor
- [ ] Copy entire contents of `database/supabase-schema.sql`
- [ ] Paste and click "Run"
- [ ] Verify success message
- [ ] Run verification query:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' ORDER BY table_name;
  ```
- [ ] Confirm you see: chapters, chapter_progress, chat_history, concepts, translations, user_progress

### Step 2: Update API Routes ⏱️ 10-30 minutes

Files that need `await` added to memoryStore calls:

- [ ] `app/api/study-plan/generate/route.ts`
  - [ ] Add `await` to `memoryStore.getAllChapters()`
  - [ ] Add `await` to any other memoryStore calls
  - [ ] Ensure handler is `async`

- [ ] `app/api/chapters/[id]/route.ts`
  - [ ] Add `await` to `memoryStore.getChapter()`
  - [ ] Add `await` to `memoryStore.deleteChapter()`
  - [ ] Add `await` to any other memoryStore calls
  - [ ] Ensure handlers are `async`

- [ ] Search for other files importing memoryStore:
  ```bash
  grep -r "from '@/lib/memory-store'" app/
  ```
  - [ ] Update each file found
  - [ ] Add `await` to all memoryStore method calls
  - [ ] Make functions `async` if needed

### Step 3: Test Application ⏱️ 10 minutes

- [ ] Start dev server: `npm run dev`
- [ ] Test: Upload a new PDF/document
- [ ] Test: View chapters list on dashboard
- [ ] Test: Start a chapter (chapter-based learning)
- [ ] Test: Answer questions in a chapter
- [ ] Test: View chapter progress
- [ ] Test: Delete a chapter
- [ ] Test: Verify cascade delete (check Supabase dashboard)
- [ ] Test: View concepts for a chapter
- [ ] Test: Start learning a concept
- [ ] Test: Chat with Aristo
- [ ] Test: View progress/badges
- [ ] Test: Language toggle (translations cache)

### Step 4: Verify Data in Supabase ⏱️ 5 minutes

- [ ] Open Supabase Dashboard → Table Editor
- [ ] Check `chapters` table has data
- [ ] Check `concepts` table has data (if applicable)
- [ ] Check `chapter_progress` table has data (if applicable)
- [ ] Run verification query:
  ```sql
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
  ```

---

## 📦 Optional Actions

### Migrate Existing Data (If you have localStorage data) ⏱️ 5 minutes

- [ ] Open app in browser
- [ ] Open browser console (F12)
- [ ] Run backup script:
  ```javascript
  const data = localStorage.getItem('levelup_data');
  if (data) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'memory-store-backup.json';
    a.click();
    console.log('✅ Backup downloaded!');
  }
  ```
- [ ] Save downloaded file to project root
- [ ] Run migration script:
  ```bash
  npx ts-node scripts/migrate-memory-to-supabase.ts
  ```
- [ ] Review migration output
- [ ] Verify data in Supabase dashboard

### Clean Up (After successful migration) ⏱️ 2 minutes

- [ ] Clear localStorage (optional):
  ```javascript
  localStorage.removeItem('levelup_data');
  console.log('✅ localStorage cleared');
  ```
- [ ] Delete backup file (optional):
  ```bash
  rm memory-store-backup.json
  ```
- [ ] Remove old TODO files (optional)

---

## 🐛 Troubleshooting

### If you see TypeScript errors:

- [ ] Restart TypeScript server in VSCode
  - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
  - Type "TypeScript: Restart TS Server"
  - Press Enter
- [ ] Or restart dev server:
  ```bash
  # Stop server (Ctrl+C)
  npm run dev
  ```

### If migration script fails:

- [ ] Check environment variables are set:
  ```bash
  echo $NEXT_PUBLIC_SUPABASE_URL
  echo $SUPABASE_SERVICE_ROLE_KEY
  ```
- [ ] Check backup file exists in project root
- [ ] Check SQL schema was executed first
- [ ] Review error message and check foreign key constraints

### If data doesn't appear in Supabase:

- [ ] Check browser console for errors
- [ ] Check server console for errors
- [ ] Check Supabase Dashboard → Logs
- [ ] Verify environment variables are correct
- [ ] Try manual insert in SQL Editor to test connection

---

## 📚 Documentation Reference

- **Quick Start:** `SUPABASE_QUICK_START.md` - Fast setup guide
- **Full Guide:** `SUPABASE_MIGRATION_GUIDE.md` - Complete documentation
- **Summary:** `SUPABASE_MIGRATION_COMPLETE.md` - What was delivered

---

## ✅ Final Checklist

Before marking migration complete:

- [ ] SQL schema executed successfully
- [ ] All API routes updated with `await`
- [ ] No TypeScript errors
- [ ] App runs without errors
- [ ] Can create new data (uploads work)
- [ ] Can read existing data (dashboard shows data)
- [ ] Can update data (progress saves)
- [ ] Can delete data (chapter deletion works)
- [ ] Data persists after browser refresh
- [ ] Data persists after server restart
- [ ] Cascade deletes work correctly

---

## 🎉 When Complete

- [ ] Mark this TODO as complete
- [ ] Update project README if needed
- [ ] Consider adding RLS policies for multi-user (see full guide)
- [ ] Consider setting up database backups
- [ ] Celebrate! 🎊 You now have persistent, scalable storage!

---

## 📊 Progress Tracking

**Estimated Total Time:** 30-45 minutes

- Setup (SQL + env): ~5 minutes
- Code updates: ~15-30 minutes  
- Testing: ~10 minutes
- Optional migration: ~5 minutes

**Current Status:** Ready to begin

**Next Step:** Execute SQL schema in Supabase (Step 1)

---

**Need help?** Check the documentation files or review code comments.
