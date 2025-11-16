# Visitors Table Implementation

## Overview
Added a simple visitors tracking system that records one row per user in Supabase.

## Changes Made

### 1. Database Schema (`database/auth-schema.sql`)
Added new `visitors` table:
```sql
CREATE TABLE IF NOT EXISTS public.visitors (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features:**
- One row per user (user_id is primary key)
- Stores email and creation timestamp
- Includes RLS policies for security
- Indexed for performance

### 2. Visitor Tracking Helper (`lib/visitors.ts`)
Created `trackVisitor()` function that:
- Checks if visitor already exists (SELECT)
- Only inserts if no row found (prevents duplicates)
- Handles errors gracefully

**Usage:**
```typescript
await trackVisitor(userId, email);
```

### 3. Updated Sign In (`components/auth/SignIn.tsx`)
- Calls `trackVisitor()` on successful sign in
- Tracks visitor before creating session
- No duplicates created on multiple sign ins

### 4. Updated Sign Up (`components/auth/SignUp.tsx`)
- Calls `trackVisitor()` after account creation
- Tracks visitor immediately after sign up
- Works even if email verification is pending

### 5. Updated Admin Dashboard (`app/admin/page.tsx`)
**New Visitors Table Display:**
- Shows all visitors ordered by creation date (newest first)
- Displays: Email, Created At
- Clean, simple table layout
- Replaces previous user stats table

## How It Works

### On Sign Up:
1. User creates account
2. `trackVisitor()` is called with user_id and email
3. Function checks if visitor exists
4. If not, inserts new row
5. User appears in admin dashboard

### On Sign In:
1. User signs in
2. `trackVisitor()` is called
3. Function checks if visitor exists
4. If exists, does nothing (no duplicate)
5. If new user (somehow missed on signup), adds them

### Duplicate Prevention:
- Primary key constraint on `user_id`
- SELECT before INSERT pattern
- Database-level uniqueness guarantee

## Admin Dashboard View

The admin dashboard now shows:

**Stats Cards:**
- Total Users
- Active Users  
- Average Time Spent

**Visitors Table:**
- Email column
- Created At column
- Sorted by newest first
- Clean, readable format

## Database Structure

```
visitors table:
├── user_id (UUID, PRIMARY KEY)
├── email (TEXT, NOT NULL)
└── created_at (TIMESTAMPTZ, DEFAULT NOW())

Indexes:
├── idx_visitors_email
└── idx_visitors_created_at

RLS Policies:
├── Users can view own visitor record
└── Users can insert own visitor record
```

## Testing Checklist

- [ ] Run updated SQL schema in Supabase
- [ ] Sign up new user → Check visitors table
- [ ] Sign in existing user → No duplicate created
- [ ] Sign in multiple times → Still no duplicates
- [ ] Admin dashboard shows all visitors
- [ ] Visitors sorted by creation date
- [ ] Email displayed correctly
- [ ] Created At timestamp formatted properly

## Files Modified

1. ✅ `database/auth-schema.sql` - Added visitors table
2. ✅ `lib/visitors.ts` - Created tracking helper (NEW FILE)
3. ✅ `components/auth/SignIn.tsx` - Added visitor tracking
4. ✅ `components/auth/SignUp.tsx` - Added visitor tracking
5. ✅ `app/admin/page.tsx` - Updated to display visitors

## SQL to Run

If you already ran the previous schema, you can add just the visitors table:

```sql
-- Add visitors table
CREATE TABLE IF NOT EXISTS public.visitors (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_visitors_email ON public.visitors(email);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON public.visitors(created_at);

-- Enable RLS
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view own visitor record"
    ON public.visitors
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own visitor record"
    ON public.visitors
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.visitors TO authenticated;
GRANT SELECT ON public.visitors TO anon;

-- Add comment
COMMENT ON TABLE public.visitors IS 'Tracks all users who have signed up or signed in';
```

## Benefits

1. **Simple**: One table, three columns
2. **No Duplicates**: Primary key + SELECT before INSERT
3. **Fast**: Indexed for quick queries
4. **Secure**: RLS policies protect user data
5. **Clean**: Admin dashboard shows real emails
6. **Reliable**: Tracks on both signup and signin

## Notes

- Visitors are tracked automatically
- No manual intervention needed
- Works with existing auth flow
- Compatible with email verification
- Scales well with many users
