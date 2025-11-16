# 🚀 Authentication System - Quick Start Guide

## ⚡ Get Started in 5 Minutes

### Step 1: Set Up Database (2 minutes)

1. Open your Supabase project: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `database/auth-schema.sql`
5. Paste and click **Run**
6. ✅ Verify tables created: Go to **Table Editor** → You should see `sessions` and `user_stats`

### Step 2: Configure Admin Access (1 minute)

1. Open `app/admin/page.tsx`
2. Find line 10: `const ADMIN_EMAILS = [`
3. Add your email:
```typescript
const ADMIN_EMAILS = [
  'your-email@example.com',  // ← Add your email here
];
```
4. Save the file

### Step 3: Verify Environment Variables (30 seconds)

Check your `.env.local` file has:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 4: Start the App (30 seconds)

```bash
npm run dev
```

### Step 5: Test Authentication (1 minute)

1. Open http://localhost:3000
2. You'll be redirected to `/auth/signin`
3. Click **"Sign Up"**
4. Create an account with your email
5. Check your email for verification link
6. Click verification link
7. Return to app and sign in
8. 🎉 You're in!

## 📋 Testing Checklist

### Basic Authentication
- [ ] Visit http://localhost:3000 → Redirected to sign in
- [ ] Click "Sign Up" → Registration form appears
- [ ] Create account → Success message shown
- [ ] Check email → Verification email received
- [ ] Click verification link → Email confirmed
- [ ] Sign in with credentials → Redirected to main app
- [ ] Main app loads → Image upload screen visible

### Session Tracking
- [ ] Sign in → Check Supabase `sessions` table → New row created
- [ ] Stay signed in for 1 minute
- [ ] Sign out → Check `sessions` table → `ended_at` populated
- [ ] Check `user_stats` table → Duration recorded

### Password Reset
- [ ] Click "Forgot password?" on sign in page
- [ ] Enter email → Success message shown
- [ ] Check email → Reset link received
- [ ] Click reset link → Reset password form appears
- [ ] Enter new password → Success message shown
- [ ] Sign in with new password → Works!

### Admin Dashboard
- [ ] Sign in with admin email
- [ ] Visit http://localhost:3000/admin
- [ ] Dashboard loads with statistics
- [ ] User table shows data
- [ ] Sign in with non-admin email
- [ ] Try to visit /admin → Redirected to home

### Protected Routes
- [ ] Sign out
- [ ] Try to visit http://localhost:3000 → Redirected to sign in
- [ ] Try to visit http://localhost:3000/admin → Redirected to sign in
- [ ] Sign in → Can access main app

## 🎯 Quick Test Script

Run this test sequence to verify everything works:

```bash
# 1. Start the app
npm run dev

# 2. Open browser
# Visit: http://localhost:3000

# 3. Create account
# - Click "Sign Up"
# - Email: test@example.com
# - Password: test123
# - Confirm: test123
# - Submit

# 4. Verify email
# - Check your email inbox
# - Click verification link

# 5. Sign in
# - Return to app
# - Sign in with test@example.com / test123

# 6. Check session tracking
# - Open Supabase dashboard
# - Go to Table Editor → sessions
# - See your active session

# 7. Test admin (if you added your email)
# - Visit: http://localhost:3000/admin
# - See dashboard with stats

# 8. Sign out
# - Check sessions table
# - See ended_at timestamp
# - Check user_stats table
# - See total duration
```

## 🔍 Troubleshooting

### "Cannot read properties of undefined"
**Solution:** Make sure you ran the SQL schema in Supabase

### "Invalid login credentials"
**Solution:** Check if email is verified. Click verification link in email.

### "Failed to create session"
**Solution:** 
1. Check Supabase tables exist
2. Verify RLS policies are enabled
3. Check browser console for errors

### Redirected to sign in immediately after signing in
**Solution:**
1. Clear browser cache and cookies
2. Check Supabase project URL is correct
3. Verify anon key is correct

### Admin dashboard shows "Access Denied"
**Solution:** Add your email to `ADMIN_EMAILS` array in `app/admin/page.tsx`

### Session not tracking
**Solution:**
1. Check browser console for errors
2. Verify `sessions` table exists
3. Check RLS policies allow INSERT

## 📊 Verify in Supabase Dashboard

### Check Sessions Table
1. Go to Supabase → Table Editor → sessions
2. You should see rows with:
   - `user_id` (your user ID)
   - `started_at` (when you signed in)
   - `ended_at` (when you signed out, or NULL if still active)
   - `duration_seconds` (calculated duration)

### Check User Stats Table
1. Go to Supabase → Table Editor → user_stats
2. You should see rows with:
   - `user_id` (your user ID)
   - `total_duration_seconds` (total time spent)
   - `last_seen_at` (last activity timestamp)

### Check Auth Users
1. Go to Supabase → Authentication → Users
2. You should see your registered users
3. Check email confirmation status

## 🎨 Customization Quick Tips

### Change Theme Colors
Edit any component file and replace `orange` with your color:
```tsx
// Before
className="bg-orange-500 hover:bg-orange-600"

// After
className="bg-blue-500 hover:bg-blue-600"
```

### Change Redirect After Sign In
Edit `components/auth/SignIn.tsx` line 48:
```typescript
// Before
router.push('/');

// After
router.push('/dashboard'); // or any route
```

### Add More Admin Emails
Edit `app/admin/page.tsx`:
```typescript
const ADMIN_EMAILS = [
  'admin1@example.com',
  'admin2@example.com',
  'admin3@example.com',
];
```

## 📚 File Reference

| File | Purpose |
|------|---------|
| `database/auth-schema.sql` | Database tables and RLS policies |
| `contexts/AuthContext.tsx` | Global auth state |
| `hooks/useSessionTracker.ts` | Automatic session tracking |
| `components/auth/SignIn.tsx` | Login form |
| `components/auth/SignUp.tsx` | Registration form |
| `components/auth/AuthGuard.tsx` | Route protection |
| `app/admin/page.tsx` | Admin dashboard |

## ✅ Success Indicators

You'll know everything is working when:

1. ✅ You can create an account
2. ✅ You receive verification email
3. ✅ You can sign in
4. ✅ Main app loads (image upload screen)
5. ✅ Session appears in Supabase `sessions` table
6. ✅ You can sign out
7. ✅ Session duration is recorded
8. ✅ Admin dashboard shows statistics (if admin)
9. ✅ Unauthenticated users are redirected to sign in

## 🆘 Need Help?

1. Check `AUTH_IMPLEMENTATION_GUIDE.md` for detailed documentation
2. Review browser console for error messages
3. Check Supabase logs in dashboard
4. Verify all environment variables are set
5. Ensure SQL schema was run successfully

## 🎉 You're All Set!

Your authentication system is now fully functional. Users must sign in before accessing the app, and their session time is automatically tracked.

**Next Steps:**
- Customize the UI to match your brand
- Add more admin features
- Implement additional user profile fields
- Set up email templates in Supabase
- Configure production environment variables

Happy coding! 🚀
