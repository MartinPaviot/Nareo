# ⚡ Supabase Migration - Quick Start

## 🚀 3-Step Setup

### 1. Run SQL Schema (2 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `database/supabase-schema.sql`
3. Paste and click **Run**
4. ✅ Done! All tables created.

### 2. Verify Environment Variables

Check `.env.local` has:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # For migration only
```

### 3. Update Your Code

**Before:**
```typescript
const chapter = memoryStore.getChapter(id);
```

**After:**
```typescript
const chapter = await memoryStore.getChapter(id);
```

That's it! 🎉

---

## 📦 Migrate Existing Data (Optional)

### If you have data in localStorage:

**Step 1:** Export from browser console:
```javascript
const data = localStorage.getItem('levelup_data');
const blob = new Blob([data], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'memory-store-backup.json';
a.click();
```

**Step 2:** Save file to project root

**Step 3:** Run migration:
```bash
npx ts-node scripts/migrate-memory-to-supabase.ts
```

### If starting fresh:
Just start using the app - data saves automatically! ✨

---

## 🔧 Common Code Updates

### API Routes

```typescript
// ❌ OLD
export async function GET() {
  const chapters = memoryStore.getAllChapters();
  return Response.json(chapters);
}

// ✅ NEW
export async function GET() {
  const chapters = await memoryStore.getAllChapters();
  return Response.json(chapters);
}
```

### Components (Server Components)

```typescript
// ❌ OLD
export default function Page() {
  const chapter = memoryStore.getChapter(id);
  return <div>{chapter.title}</div>;
}

// ✅ NEW
export default async function Page() {
  const chapter = await memoryStore.getChapter(id);
  return <div>{chapter.title}</div>;
}
```

### Client Components

```typescript
// ❌ OLD
const handleSave = () => {
  memoryStore.addChapter(chapter);
};

// ✅ NEW
const handleSave = async () => {
  await memoryStore.addChapter(chapter);
};
```

---

## 🧪 Quick Test

After setup, test these:

1. ✅ Upload a PDF → Check Supabase `chapters` table
2. ✅ Answer a question → Check `chapter_progress` table
3. ✅ Delete a chapter → Verify related data deleted (cascade)

---

## 🆘 Troubleshooting

### "Module has no exported member"
→ Restart dev server: `npm run dev`

### "PGRST116" error
→ Normal! Means record doesn't exist (returns `undefined`)

### Migration can't find data
→ Create backup file first (see above)

### TypeScript errors in API routes
→ Add `await` to all memoryStore calls

---

## 📚 Full Documentation

See `SUPABASE_MIGRATION_GUIDE.md` for:
- Detailed explanations
- Verification queries
- Security setup (RLS)
- Performance tips
- Complete troubleshooting

---

## ✅ Checklist

- [ ] SQL schema executed in Supabase
- [ ] Environment variables verified
- [ ] (Optional) Existing data migrated
- [ ] API routes updated with `await`
- [ ] App tested and working
- [ ] Old localStorage cleared (optional)

**Done!** Your app now uses Supabase for all data persistence. 🎉
