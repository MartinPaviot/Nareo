# Message Cleaning Implementation

## Overview
A permanent text cleaning function has been integrated into the chat message renderer to automatically process all messages (both user and assistant) before display.

## Implementation Details

### Location
- **Primary File**: `components/chat/ChatBubble.tsx`
- **Affected Component**: `UserMessageBubble.tsx` (receives cleaned content)

### Cleaning Function: `cleanMessageText()`

The function applies three permanent rules to all messages:

#### Rule 1: Remove all `**` instances
- Removes all bold markdown syntax globally
- Example: `**Hello**` → `Hello`

#### Rule 2: Replace `-` with `,` (with intelligent exceptions)
- Replaces dash characters with commas
- **Exceptions** (dashes are preserved in):
  - Code blocks (triple backticks: ` ```code``` `)
  - Inline code (single backticks: `` `code` ``)
  - URLs (http://, https://, www., ftp://)
  - File paths (e.g., `src/components/file.tsx`, `C:\Users\path`)

#### Rule 3: Preserve spacing and line breaks
- All whitespace, indentation, and line breaks remain exactly as they are
- Uses string operations that maintain original formatting

### Integration Flow

```
Message Content (message.content)
    ↓
cleanMessageText() - Applied in ChatBubble component
    ↓
Cleaned Content
    ↓
    ├─→ User Messages → UserMessageBubble (receives cleaned content)
    └─→ Assistant Messages → formatMessageContent() → Display
```

### Key Features

1. **Automatic Application**: Every message is automatically cleaned without requiring any additional prompts or configuration

2. **Future-Proof**: All messages generated in the future will automatically pass through this cleaning function

3. **Context-Aware**: The function intelligently detects and preserves dashes in technical contexts (code, paths, URLs)

4. **Non-Destructive**: Preserves all spacing, line breaks, and formatting structure

### Technical Implementation

The cleaning function uses:
- **Protected Ranges**: Identifies regions (code blocks, URLs, paths) where dashes should be preserved
- **Range Merging**: Combines overlapping protected regions for efficiency
- **Selective Replacement**: Only replaces dashes outside protected ranges

### Testing Scenarios

The implementation handles:
- ✅ Regular text with dashes: `hello-world` → `hello,world`
- ✅ Bold text: `**Important**` → `Important`
- ✅ Code blocks: `` ```const x = a-b;``` `` → (dash preserved)
- ✅ Inline code: `` `x-y` `` → (dash preserved)
- ✅ URLs: `https://example.com/path-to-page` → (dash preserved)
- ✅ File paths: `src/components/chat-bubble.tsx` → (dash preserved)
- ✅ Mixed content: Correctly applies rules to appropriate sections
- ✅ Whitespace: All spacing and line breaks preserved exactly

### Files Modified

1. **components/chat/ChatBubble.tsx**
   - Added `cleanMessageText()` function
   - Applied cleaning to `message.content` before rendering
   - Passes cleaned content to both user and assistant message renderers
   - Updated MCQ formatting to work with cleaned content (removed redundant `**` removal)

## Result

All chat messages, both current and future, are now automatically processed through the permanent cleaning function before being displayed to users. The implementation is transparent, efficient, and maintains all necessary technical formatting while applying the required text transformations.
