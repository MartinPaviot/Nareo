# Authentication System Implementation Guide

## Overview
Complete Supabase authentication system with session tracking and admin dashboard for the LevelUp application.

## 🎯 Features Implemented

### 1. **Authentication Components**
- ✅ Sign Up with email validation
- ✅ Sign In with session tracking
- ✅ Forgot Password with email reset
- ✅ Reset Password with token validation
- ✅ Auth Guard for protected routes

### 2. **Session Tracking**
- ✅ Automatic session start on sign in
- ✅ Session end on sign out or page unload
- ✅ Duration calculation in seconds
- ✅ User stats aggregation

### 3. **Admin Dashboard**
- ✅ Restricted access by email whitelist
- ✅ Total users count
- ✅ Active users count
- ✅ Average time spent per user
- ✅ User table with statistics

### 4. **Global State Management**
- ✅ AuthContext for user state
- ✅ AuthProvider wrapping entire app
- ✅ useAuth hook for easy access

## 📁 Files Created

### Core Files
1. `contexts/AuthContext.tsx` - Global auth state management
2. `hooks/useSessionTracker.ts` - Automatic session tracking
3. `database/auth-schema.sql` - Database schema for sessions and user_stats

### Components
4. `components/auth/SignUp.tsx` - Registration form
5. `components/auth/SignIn.tsx` - Login form with session creation
6. `components/auth/ForgotPassword.tsx` - Password reset request
7. `components/auth/ResetPassword.tsx` - Password reset form
8. `components/auth/AuthGuard.tsx` - Route protection wrapper

### Pages
9. `app/auth/signin/page.tsx` - Sign in route
10. `app/auth/signup/page.tsx` - Sign up route
11. `app/auth/forgot-password/page.tsx` - Forgot password route
12. `app/auth/reset-password/page.tsx` - Reset password route
13. `app/admin/page.tsx` - Admin dashboard

### Modified Files
14. `app/layout.tsx` - Added AuthProvider wrapper
15. `app/page.tsx` - Added AuthGuard protection

## 🚀 Setup Instructions

### Step 1: Run Database Schema
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `database/auth-schema.sql`
4. Run the SQL script
5. Verify tables are created: `sessions` and `user_stats`

### Step 2: Configure Environment Variables
Ensure your `.env.local` file has:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 3: Configure Admin Access
Edit `app/admin/page.tsx` and update the `ADMIN_EMAILS` array:
```typescript
const ADMIN_EMAILS = [
  'your-admin-email@example.com',
  'another-admin@example.com',
];
```

### Step 4: Install Dependencies (if needed)
```bash
npm install @supabase/supabase-js
```

### Step 5: Run the Application
```bash
npm run dev
```

## 🔐 Authentication Flow

### Sign Up Flow
1. User visits `/auth/signup`
2. Enters email, password, and confirms password
3. Client-side validation checks:
   - All fields filled
   - Valid email format
   - Password minimum 6 characters
   - Passwords match
4. Calls `supabase.auth.signUp()`
5. Supabase sends verification email
6. User redirected to sign in page

### Sign In Flow
1. User visits `/auth/signin`
2. Enters email and password
3. Calls `supabase.auth.signInWithPassword()`
4. On success:
   - Creates new session record in `sessions` table
   - Redirects to home page (protected by AuthGuard)
5. Session tracking begins automatically

### Password Reset Flow
1. User visits `/auth/forgot-password`
2. Enters email address
3. Calls `supabase.auth.resetPasswordForEmail()`
4. Supabase sends reset link to email
5. User clicks link → redirected to `/auth/reset-password`
6. Enters new password
7. Calls `supabase.auth.updateUser()`
8. Redirected to sign in page

### Session Tracking Flow
1. User signs in → session record created
2. `useSessionTracker` hook monitors user activity
3. On page unload or sign out:
   - Updates session with `ended_at` timestamp
   - Calculates `duration_seconds`
   - Updates or creates `user_stats` record
   - Aggregates total time spent

## 📊 Database Schema

### `sessions` Table
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- started_at: TIMESTAMPTZ
- ended_at: TIMESTAMPTZ (nullable)
- duration_seconds: INTEGER (nullable)
- created_at: TIMESTAMPTZ
```

### `user_stats` Table
```sql
- user_id: UUID (primary key, foreign key to auth.users)
- total_duration_seconds: INTEGER (default 0)
- last_seen_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

## 🛡️ Security Features

### Row Level Security (RLS)
- ✅ Enabled on both tables
- ✅ Users can only access their own data
- ✅ Policies for SELECT, INSERT, UPDATE operations

### Authentication
- ✅ Email verification required
- ✅ Password minimum length validation
- ✅ Secure password reset flow
- ✅ Protected routes with AuthGuard

### Admin Access
- ✅ Hardcoded email whitelist
- ✅ Automatic redirect for non-admin users
- ✅ No sensitive data exposed to regular users

## 🎨 UI/UX Features

### Consistent Design
- Orange theme matching LevelUp branding
- Responsive layouts for all screen sizes
- Loading states for async operations
- Clear error and success messages

### User Feedback
- Inline validation errors
- Success messages with auto-redirect
- Loading spinners during operations
- Helpful placeholder text

## 🧪 Testing Checklist

### Authentication
- [ ] Sign up with valid credentials
- [ ] Sign up with invalid email
- [ ] Sign up with mismatched passwords
- [ ] Sign in with valid credentials
- [ ] Sign in with invalid credentials
- [ ] Sign out functionality

### Password Reset
- [ ] Request password reset
- [ ] Receive reset email
- [ ] Reset password with valid token
- [ ] Try to access reset page without token

### Session Tracking
- [ ] Session created on sign in
- [ ] Session updated on sign out
- [ ] Session updated on page close
- [ ] User stats updated correctly

### Protected Routes
- [ ] Unauthenticated users redirected to sign in
- [ ] Authenticated users can access main app
- [ ] Admin users can access dashboard
- [ ] Non-admin users cannot access dashboard

### Admin Dashboard
- [ ] Displays correct user count
- [ ] Shows active users
- [ ] Calculates average time correctly
- [ ] User table displays data

## 🔧 Customization

### Styling
All components use Tailwind CSS. Modify classes in component files to match your design system.

### Admin Emails
Update the `ADMIN_EMAILS` array in `app/admin/page.tsx`:
```typescript
const ADMIN_EMAILS = ['admin@example.com'];
```

### Session Tracking
Modify `hooks/useSessionTracker.ts` to customize:
- Session duration calculation
- Stats aggregation logic
- Error handling

### Redirect URLs
Update redirect URLs in:
- `components/auth/SignUp.tsx` - After sign up
- `components/auth/SignIn.tsx` - After sign in
- `components/auth/ResetPassword.tsx` - After password reset
- `components/auth/ForgotPassword.tsx` - Reset password URL

## 📝 Notes

### Supabase Configuration
- Email confirmation is enabled by default in Supabase
- Configure email templates in Supabase dashboard
- Set up custom SMTP for production (optional)

### Session Tracking Limitations
- Sessions are tracked client-side
- Page refresh creates new session
- Consider server-side tracking for production

### Admin Dashboard Limitations
- Cannot directly access auth.users table from client
- User emails shown as placeholders
- Consider creating a server-side API route for full user data

## 🚨 Important Security Notes

1. **Never expose service role key** - Only use anon key in frontend
2. **Enable RLS** - Always enable Row Level Security on tables
3. **Validate on server** - Add server-side validation for critical operations
4. **Rate limiting** - Consider adding rate limiting for auth endpoints
5. **Email verification** - Ensure email verification is enabled in Supabase

## 📚 Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🎉 Success!

Your authentication system is now fully implemented and ready to use. Users must sign in before accessing the main application, and their session time is automatically tracked.

To test:
1. Visit `http://localhost:3000`
2. You'll be redirected to `/auth/signin`
3. Click "Sign Up" to create an account
4. Check your email for verification
5. Sign in and start using the app!
