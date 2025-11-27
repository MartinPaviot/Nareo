# Course Auto-Polling Implementation

## Overview

This implementation adds automatic polling to the course page to dynamically update chapters and questions as they become available from the backend processing.

## Files Modified

### 1. **`hooks/useCourseChapters.ts`** (New)
A custom React hook that manages course data fetching with intelligent polling.

**Key Features:**
- Automatically polls the API every 3 seconds when needed
- Stops polling when:
  - Course status changes to "ready" or "failed"
  - At least one chapter is received
  - Component unmounts
- Prevents unnecessary API calls when data is already available
- Provides loading states and error handling

**Configuration:**
```typescript
const {
  loading,
  course,
  chapters,
  accessTier,
  error,
  isPolling,
} = useCourseChapters({
  courseId: 'your-course-id',
  enabled: true,          // Set to false to disable (e.g., for demo courses)
  pollingInterval: 3000,  // Adjust polling delay here (in ms)
});
```

### 2. **`app/courses/[courseId]/learn/page.tsx`** (Modified)
Updated the course page to use the new polling hook.

**Changes:**
- Integrated `useCourseChapters` hook for API-based courses
- Kept demo course logic separate (no polling for demos)
- Added visual indicators for:
  - Processing state with spinner
  - Failed state with error message
  - Polling status ("Checking for updates...")
- Added skeleton loading placeholders while waiting for chapters
- Automatic course view tracking when data loads

## How It Works

### Polling Logic

1. **Initial Load**: When the page loads, it fetches course data once
2. **Polling Decision**: After the initial fetch, it checks if polling is needed:
   - Course status is "pending" OR
   - Course status is "processing" OR
   - No chapters are available yet
3. **Polling Loop**: If needed, fetches data every 3 seconds
4. **Stop Condition**: Polling stops when:
   - Status becomes "ready" or "failed"
   - At least one chapter is received
   - User navigates away (cleanup)

### User Experience

#### Scenario 1: Course Already Ready
- User lands on page
- Single API call fetches chapters
- Chapters displayed immediately
- No polling occurs

#### Scenario 2: Course Still Processing
- User lands on page
- "Preparation of chapters" banner shown
- Polling starts automatically
- Banner shows "Checking for updates..."
- When chapters become available:
  - Chapters appear automatically
  - Banner disappears
  - Polling stops

#### Scenario 3: Processing Failed
- Polling detects "failed" status
- Shows error banner
- Polling stops
- User sees clear error message

## Customization

### Adjust Polling Interval

In `hooks/useCourseChapters.ts`, line 67:
```typescript
pollingInterval: number; // Default: 3000ms (3 seconds)
```

Or when calling the hook:
```typescript
const {...} = useCourseChapters({
  courseId,
  pollingInterval: 5000, // Poll every 5 seconds instead
});
```

### Modify Polling Conditions

In `hooks/useCourseChapters.ts`, function `shouldPoll` (lines 63-73):
```typescript
const shouldPoll = useCallback((currentCourse, currentChapters) => {
  // Add your custom conditions here
  const statusRequiresPolling =
    currentCourse.status === 'pending' ||
    currentCourse.status === 'processing';

  const noChapters = currentChapters.length === 0;

  return statusRequiresPolling || noChapters;
}, []);
```

## Testing

### Test Scenarios

1. **Upload a new document**
   - Navigate to course page while processing
   - Verify polling banner appears
   - Verify chapters appear automatically when ready

2. **Navigate to completed course**
   - Verify single API call only
   - Verify no polling occurs
   - Verify chapters display immediately

3. **Navigate away during polling**
   - Start on processing course
   - Navigate to different page
   - Verify no console errors
   - Verify polling cleanup

4. **Demo course**
   - Verify no API calls occur
   - Verify demo data loads instantly

## Performance Considerations

- **Polling Only When Needed**: The hook intelligently starts/stops polling
- **Cleanup on Unmount**: Prevents memory leaks and unnecessary requests
- **Demo Course Optimization**: Demo courses bypass all API calls
- **Single Fetch for Ready Courses**: No polling overhead for completed courses

## Future Enhancements

Consider these improvements:

1. **WebSocket Support**: Replace polling with real-time updates
2. **Exponential Backoff**: Increase interval over time to reduce server load
3. **User Notification**: Toast notification when chapters become available
4. **Optimistic Updates**: Show estimated progress while processing

## API Endpoint

The hook consumes: `GET /api/courses/[courseId]/chapters`

Expected response:
```json
{
  "success": true,
  "course": {
    "id": "...",
    "title": "...",
    "status": "pending" | "processing" | "ready" | "failed"
  },
  "chapters": [...],
  "access_tier": "free" | "paid" | null
}
```
