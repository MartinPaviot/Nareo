# Global Sign Out Feature Implementation

## Progress Tracker

### Step 1: Create API Endpoint for Session Closure
- [x] Create `app/api/sessions/close/route.ts`
- [x] Implement logic to find and close active session
- [x] Update user_stats with session duration

### Step 2: Update Session Tracker Hook
- [x] No changes needed - session tracking already works independently
- [x] API endpoint handles finding active sessions by user ID

### Step 3: Enhance Auth Context
- [x] Update `contexts/AuthContext.tsx` signOut function
- [x] Add session closure logic before auth sign out
- [x] Add redirect to sign-in page

### Step 4: Create SignOut Button Component
- [x] Create `components/layout/SignOutButton.tsx`
- [x] Design elegant, non-intrusive button
- [x] Add loading state
- [x] Position fixed in top-right corner

### Step 5: Integrate into Root Layout
- [x] Update `app/layout.tsx`
- [x] Add SignOutButton component
- [x] Ensure it only shows for authenticated users

### Step 6: Testing
- [ ] Test sign out on different pages
- [ ] Verify session closure in database
- [ ] Verify user_stats updates
- [ ] Test redirect functionality
- [ ] Test on mobile responsiveness

## Implementation Complete! ✅

All core components have been implemented:

1. **API Endpoint** (`app/api/sessions/close/route.ts`):
   - Finds active session by user ID
   - Calculates session duration
   - Updates session with ended_at and duration_seconds
   - Updates user_stats with total duration and last_seen_at

2. **Enhanced Auth Context** (`contexts/AuthContext.tsx`):
   - Calls session closure API before signing out
   - Signs out from Supabase auth
   - Redirects to sign-in page
   - Handles errors gracefully

3. **SignOut Button** (`components/layout/SignOutButton.tsx`):
   - Fixed position in top-right corner
   - Elegant design with hover effects
   - Loading state during sign out
   - Only visible when user is authenticated

4. **Root Layout Integration** (`app/layout.tsx`):
   - SignOutButton added to layout
   - Available on all pages automatically
   - Wrapped in AuthProvider for access to auth state

## Ready for Testing! 🚀
