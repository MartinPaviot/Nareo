# 📁 LevelUp Project Structure

Complete overview of the LevelUp AI-powered learning platform.

## 🏗️ Architecture Overview

```
LevelUp/
├── 📱 Frontend (Next.js 14 App Router)
├── 🔌 API Routes (Backend Logic)
├── 🗄️ Database (Supabase PostgreSQL)
├── 🤖 AI Integration (OpenAI GPT-4, Whisper)
└── 🎨 UI Components (React + Tailwind)
```

## 📂 Complete File Structure

```
LevelUp/
│
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (Backend)
│   │   ├── upload/
│   │   │   └── route.ts         # PDF upload & concept extraction
│   │   ├── chapters/[id]/
│   │   │   └── route.ts         # Get chapter data
│   │   ├── concepts/[id]/
│   │   │   └── route.ts         # Get concept data
│   │   ├── chat/
│   │   │   ├── question/
│   │   │   │   └── route.ts     # Generate quiz questions
│   │   │   └── evaluate/
│   │   │       └── route.ts     # Evaluate student answers
│   │   ├── voice/
│   │   │   └── transcribe/
│   │   │       └── route.ts     # Whisper transcription
│   │   └── sessions/[id]/
│   │       └── route.ts         # Get session recap data
│   │
│   ├── chapter/[id]/
│   │   └── page.tsx             # 📚 Chapter Overview Screen
│   ├── learn/[conceptId]/
│   │   └── page.tsx             # 💬 Learning Interface (Chat)
│   ├── recap/[sessionId]/
│   │   └── page.tsx             # 📊 Session Recap Screen
│   │
│   ├── layout.tsx               # Root layout with metadata
│   ├── page.tsx                 # 🏠 Upload Screen (Home)
│   └── globals.css              # Global styles + Tailwind
│
├── components/                   # React Components
│   ├── chat/
│   │   ├── AristoAvatar.tsx    # 🐱 Mascot with state animations
│   │   ├── ChatBubble.tsx      # Message bubble (user/AI)
│   │   ├── QuickActionButtons.tsx # "Simplify", "Example" buttons
│   │   └── VoiceInput.tsx      # 🎙️ Voice recording component
│   │
│   ├── concepts/
│   │   ├── ConceptCard.tsx     # Concept display card
│   │   ├── PhaseIndicator.tsx  # 3-phase progress display
│   │   └── BadgeDisplay.tsx    # 🥉🥈🥇 Badge component
│   │
│   └── layout/
│       ├── ConceptTracker.tsx  # Left sidebar tracker
│       └── ScoreBar.tsx        # Top score bar
│
├── lib/                         # Utility Libraries
│   ├── supabase.ts             # Supabase client setup
│   ├── openai.ts               # OpenAI integration
│   ├── pdf-parser.ts           # PDF text extraction
│   ├── scoring.ts              # Scoring & badge logic
│   └── utils.ts                # Helper functions
│
├── types/                       # TypeScript Definitions
│   ├── database.types.ts       # Database schema types
│   ├── concept.types.ts        # Learning concept types
│   └── chat.types.ts           # Chat & Aristo types
│
├── database/
│   └── schema.sql              # Supabase database schema
│
├── public/
│   └── mascot/                 # Aristo mascot images
│       ├── mascotte.png        # Default/listening
│       ├── Processing.png      # Reading/thinking
│       ├── Talking.png         # Speaking
│       ├── Happy.png           # Correct answer
│       ├── Disappointed.png    # Confused
│       ├── adcdebda.png        # Trophy/success
│       └── README.md           # Image specifications
│
├── .env.local.example          # Environment variables template
├── .gitignore                  # Git ignore rules
├── next.config.js              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS config
├── tsconfig.json               # TypeScript config
├── postcss.config.js           # PostCSS config
├── package.json                # Dependencies & scripts
│
├── README.md                   # Main documentation
├── SETUP.md                    # Setup instructions
└── PROJECT_STRUCTURE.md        # This file
```

## 🎯 Key Features by File

### 1. Upload Screen (`app/page.tsx`)
- Drag & drop PDF upload
- File validation
- Aristo greeting animation
- Processing state with loading

### 2. Chapter Overview (`app/chapter/[id]/page.tsx`)
- Chapter summary display
- Concept list with difficulty badges
- Progress tracking
- "Start Learning" CTA

### 3. Learning Interface (`app/learn/[conceptId]/page.tsx`)
- Chat-based interaction
- 3-phase learning flow
- Real-time AI responses
- Voice input support
- Quick action buttons
- Score tracking

### 4. Session Recap (`app/recap/[sessionId]/page.tsx`)
- Performance statistics
- Concept results table
- Badge achievements
- Retry suggestions
- Motivational feedback

## 🔌 API Routes

### Upload API (`/api/upload`)
**POST** - Upload PDF and extract concepts
- Accepts: `multipart/form-data` with PDF file
- Returns: Chapter ID and extracted concepts
- Process:
  1. Parse PDF text
  2. Send to GPT-4 for concept extraction
  3. Store in Supabase
  4. Return structured data

### Chapter API (`/api/chapters/[id]`)
**GET** - Fetch chapter with concepts
- Returns: Chapter details + concept list
- Includes: Title, summary, concepts array

### Concept API (`/api/concepts/[id]`)
**GET** - Fetch single concept
- Returns: Concept details
- Includes: Title, difficulty, content

### Question API (`/api/chat/question`)
**POST** - Generate quiz question
- Body: `{ conceptId, phase }`
- Returns: Question text + options (for MCQ)
- Uses GPT-4 to generate contextual questions

### Evaluate API (`/api/chat/evaluate`)
**POST** - Evaluate student answer
- Body: `{ conceptId, phase, answer }`
- Returns: Feedback, score, phase completion status
- Uses GPT-4 for intelligent evaluation

### Transcribe API (`/api/voice/transcribe`)
**POST** - Transcribe audio to text
- Accepts: Audio file (webm/mp3)
- Returns: Transcribed text
- Uses OpenAI Whisper

### Session API (`/api/sessions/[id]`)
**GET** - Fetch session recap data
- Returns: Complete session statistics
- Includes: Scores, time, concepts, badges

## 🗄️ Database Schema

### Tables

1. **chapters** - Uploaded PDF courses
2. **concepts** - Extracted learning concepts
3. **user_progress** - Student progress tracking
4. **chat_history** - Conversation logs
5. **sessions** - Learning session data

See `database/schema.sql` for complete schema.

## 🎨 Component Hierarchy

```
App Layout
├── Upload Screen
│   └── AristoAvatar
│
├── Chapter Overview
│   ├── AristoAvatar
│   └── ConceptCard[]
│       ├── PhaseIndicator
│       └── BadgeDisplay
│
├── Learning Interface
│   ├── ScoreBar
│   ├── ConceptTracker (sidebar)
│   │   └── ConceptCard[]
│   ├── ChatBubble[]
│   │   └── AristoAvatar
│   ├── QuickActionButtons
│   └── VoiceInput
│
└── Session Recap
    ├── AristoAvatar
    ├── Stats Cards
    ├── Results Table
    │   └── BadgeDisplay[]
    └── Action Buttons
```

## 🔄 Data Flow

### Learning Flow
```
1. Upload PDF
   ↓
2. Extract Concepts (GPT-4)
   ↓
3. Store in Supabase
   ↓
4. Display Chapter Overview
   ↓
5. Start Learning (Chat)
   ↓
6. Phase 1: MCQ (10 pts)
   ↓
7. Phase 2: Short Answer (30 pts)
   ↓
8. Phase 3: Reflective (60 pts)
   ↓
9. Update Progress
   ↓
10. Award Badge
   ↓
11. Next Concept or Recap
```

### API Call Flow
```
Frontend Component
   ↓
API Route (/api/*)
   ↓
Supabase / OpenAI
   ↓
Process Data
   ↓
Return Response
   ↓
Update UI
```

## 🎯 State Management

### Client State (React useState)
- Chat messages
- Input values
- Loading states
- Current phase
- Local scores

### Server State (Supabase)
- User progress
- Chat history
- Concept completion
- Badge achievements

### Real-time Updates
- Score changes
- Progress updates
- Badge unlocks

## 🎨 Styling System

### Tailwind Classes
- **Colors**: Orange theme (`orange-50` to `orange-600`)
- **Spacing**: Consistent padding/margins
- **Borders**: Rounded corners (`rounded-2xl`)
- **Shadows**: Subtle elevation

### Custom Classes (globals.css)
- `.chat-bubble` - Message styling
- `.concept-card` - Concept display
- `.badge-*` - Badge animations
- `.difficulty-*` - Difficulty colors

## 🔐 Security

### Environment Variables
- API keys stored in `.env.local`
- Never committed to version control
- Service role key for server-side only

### Row Level Security (RLS)
- Enabled on all Supabase tables
- Users can only access their own data
- Policies defined in schema.sql

## 📊 Performance Optimizations

### Code Splitting
- Dynamic imports for heavy components
- Route-based code splitting (Next.js)

### Image Optimization
- Next.js Image component
- Lazy loading
- Responsive images

### API Optimization
- Efficient database queries
- Indexed columns
- Minimal data transfer

## 🧪 Testing Checklist

- [ ] PDF upload works
- [ ] Concepts extracted correctly
- [ ] Chat interface functional
- [ ] Voice input works
- [ ] Scoring accurate
- [ ] Badges awarded correctly
- [ ] Responsive on mobile
- [ ] All API routes working
- [ ] Database queries optimized
- [ ] Error handling robust

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Environment Setup
- Set all `.env.local` variables
- Configure Supabase connection
- Add OpenAI API key
- (Optional) ElevenLabs key

## 📚 Key Technologies

- **Frontend**: Next.js 14, React 19, TypeScript
- **Styling**: Tailwind CSS, ShadCN UI
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4, Whisper
- **State**: React Hooks, Zustand
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 🔗 Related Files

- [README.md](./README.md) - Main documentation
- [SETUP.md](./SETUP.md) - Setup instructions
- [database/schema.sql](./database/schema.sql) - Database schema

---

Last Updated: 2024
Version: 1.0.0
