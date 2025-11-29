# Quick Start: Deploy Gamification Features

## 🎯 Summary

This guide helps you deploy the new gamification features to Aristo'Chat in **3 simple steps**.

## Step 1: Run Database Migration ⚡

### Option A: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **+ New Query**
4. Copy the entire contents of `database/migrations/004_gamification_features.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl+Enter)

### Option B: Command Line

```bash
# If you have the Supabase CLI installed
supabase db push --include-all
```

### ✅ Verify Migration Success

Run this query in the SQL editor:

```sql
-- Should return 10 rows (the default badges)
SELECT count(*) FROM badges;

-- Should show the new tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('daily_activity', 'user_gamification', 'badges', 'user_badges');
```

## Step 2: Deploy Code 🚀

### Development Environment

```bash
# Install dependencies (if any new ones were added)
npm install

# Run development server
npm run dev
```

### Production Deployment

```bash
# Build the application
npm run build

# Test the build locally
npm start

# Deploy to your hosting platform
# (Vercel, Netlify, or your preferred platform)
```

## Step 3: Test Features 🧪

### Test Dashboard

1. Navigate to `/dashboard`
2. **Expected**: You should see:
   - Welcome section with mascot
   - Daily Ritual Card showing "0 day streak" (if first time)
   - Enhanced course cards with progress bars

### Test Quiz Completion

1. Start a quiz from any chapter
2. Complete all questions
3. On the results page, **Expected**:
   - Mascot appears (celebrating if score ≥75%)
   - "Premier Pas" badge modal appears (if first quiz)
   - Stats are updated

### Test Streak

1. Complete a quiz today
2. Come back tomorrow and complete another quiz
3. **Expected**: Daily Ritual Card shows "2 days streak" 🔥

## 🎨 What Changed Visually

### Dashboard Page (`/dashboard`)
- **Before**: Simple list of courses
- **After**:
  - Mascot greeting
  - Streak tracker with fire emoji
  - Course cards with progress bars and stats
  - Color-coded completion status

### Results Page (`/courses/.../results`)
- **Before**: Basic score display
- **After**:
  - Badge celebration modal
  - Mascot reactions
  - Perfect score badge
  - Automatic activity tracking

## 🔍 Troubleshooting

### "Cannot find module '@supabase/auth-helpers-nextjs'"

**Fixed** ✅ - The gamification API routes now use the existing `createSupabaseServerClient` helper.

### No badges appearing after quiz

**Check**:
1. Verify badges were inserted: `SELECT * FROM badges;`
2. Check if triggers are enabled: `SELECT * FROM pg_trigger WHERE tgname LIKE '%badge%';`
3. Look at browser console for API errors

### Streak not updating

**Check**:
1. Complete a quiz (not just view results)
2. Wait a few seconds for triggers to fire
3. Refresh the dashboard
4. Query directly: `SELECT * FROM user_gamification WHERE user_id = 'your-user-id';`

### Dashboard loading forever

**Check**:
1. Open browser console
2. Look for errors in `/api/gamification/stats`
3. Verify RLS policies allow your user to read gamification tables

## 📊 Database Schema Quick Reference

```
daily_activity
├── user_id (UUID, FK to auth.users)
├── activity_date (DATE, unique with user_id)
├── quizzes_completed (INT)
├── questions_answered (INT)
├── questions_correct (INT)
└── points_earned (INT)

user_gamification
├── user_id (UUID, PK, FK to auth.users)
├── current_streak (INT)
├── longest_streak (INT)
├── last_activity_date (DATE)
└── total_* (various INT fields)

badges
├── id (UUID, PK)
├── code (TEXT, unique)
├── name_fr, name_en, name_de (TEXT)
├── description_fr, description_en, description_de (TEXT)
├── icon (TEXT - emoji)
└── rarity (TEXT - common/rare/epic/legendary)

user_badges
├── user_id (UUID, FK)
├── badge_id (UUID, FK)
└── earned_at (TIMESTAMP)
```

## 🎯 Quick Test Commands

```sql
-- Check your own stats
SELECT * FROM user_gamification
WHERE user_id = auth.uid();

-- Check your badges
SELECT ub.*, b.name_en, b.icon
FROM user_badges ub
JOIN badges b ON ub.badge_id = b.id
WHERE ub.user_id = auth.uid();

-- Check today's activity
SELECT * FROM daily_activity
WHERE user_id = auth.uid()
AND activity_date = CURRENT_DATE;
```

## ✅ Success Criteria

After deployment, you should be able to:

- [x] See mascot on dashboard
- [x] View streak tracker (starts at 0)
- [x] Complete a quiz and earn "Premier Pas" badge
- [x] See badge celebration modal
- [x] View progress bars on course cards
- [x] Complete quiz on consecutive days and see streak increase
- [x] Earn additional badges based on achievements

## 🆘 Need Help?

1. Check `GAMIFICATION_IMPLEMENTATION.md` for detailed technical documentation
2. Review browser console for errors
3. Check Supabase logs for database errors
4. Verify all migration SQL ran successfully

## 🎉 You're Done!

The gamification system is now live. Users will automatically start earning badges and building streaks as they use the app!
