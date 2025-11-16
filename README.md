# 🎓 LevelUp - AI-Powered Learning Platform

An AI-native edtech app that transforms PDF courses into interactive learning experiences with Aristo, your friendly AI tutor mascot.

## ✨ Features

- 📄 **PDF Upload & Processing** - Upload course PDFs and automatically extract concepts
- 🤖 **AI Tutor (Aristo)** - Interactive chat-based learning with a friendly graduation-hat cat mascot
- 📊 **Progressive Learning** - 3-phase learning system (MCQ → Short Answer → Reflective)
- 🏆 **Gamification** - Earn badges (🥉🥈🥇), track scores, and build learning streaks
- 🎙️ **Voice Input** - Speak your answers using Whisper API
- 📱 **Responsive Design** - Works seamlessly on mobile, tablet, and desktop
- 🎨 **Beautiful UX** - Intuitive interface with smooth animations

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (for database)
- OpenAI API key (for GPT-4 and Whisper)
- (Optional) ElevenLabs API key (for voice synthesis)

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# ElevenLabs (optional)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id_for_aristo

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. **Set up Supabase database:**

Run the SQL schema in `database/schema.sql` in your Supabase SQL editor.

4. **Add mascot images:**

Place mascot images in `public/mascot/`:
- `mascotte.png` - Default/listening
- `Processing.png` - Reading/thinking
- `Talking.png` - Speaking
- `Happy.png` - Correct answer
- `Disappointed.png` - Confused
- `adcdebda.png` - Trophy/success

5. **Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 How It Works

### 1. Upload Screen
- Drag & drop or select a PDF course file
- AI processes and extracts concepts with difficulty levels

### 2. Chapter Overview
- View all extracted concepts
- See chapter summary
- Start learning journey

### 3. Interactive Learning (3 Phases per Concept)

**Phase 1: Warm-up (10 points)**
- Multiple choice questions
- Test basic understanding

**Phase 2: Explain (30 points)**
- Short answer questions
- Explain concepts in your own words

**Phase 3: Reflect (60 points)**
- Open-ended questions
- Apply concepts to real-world scenarios

### 4. Scoring & Badges
- **Bronze 🥉**: 60-79 points
- **Silver 🥈**: 80-99 points
- **Gold 🥇**: 100 points
- **Streak Bonus 🔥**: Master 3 concepts in a row

### 5. Progress Tracking
- Real-time score updates
- Concept completion tracking
- Session statistics

## 🏗️ Project Structure

```
LevelUp/
├── app/
│   ├── api/              # API routes
│   │   ├── upload/       # PDF upload & processing
│   │   ├── chapters/     # Chapter data
│   │   ├── concepts/     # Concept data
│   │   ├── chat/         # Chat & evaluation
│   │   └── voice/        # Voice transcription
│   ├── chapter/[id]/     # Chapter overview page
│   ├── learn/[conceptId]/ # Learning interface
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Upload screen
├── components/
│   ├── chat/             # Chat components
│   ├── concepts/         # Concept cards & badges
│   └── layout/           # Layout components
├── lib/
│   ├── openai.ts         # OpenAI integration
│   ├── supabase.ts       # Supabase client
│   ├── pdf-parser.ts     # PDF processing
│   ├── scoring.ts        # Scoring logic
│   └── utils.ts          # Utility functions
├── types/                # TypeScript types
└── public/
    └── mascot/           # Aristo mascot images
```

## 🗄️ Database Schema

### Tables

**chapters**
- `id` (uuid, primary key)
- `user_id` (text)
- `title` (text)
- `pdf_url` (text)
- `summary` (text)
- `total_concepts` (integer)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**concepts**
- `id` (uuid, primary key)
- `chapter_id` (uuid, foreign key)
- `title` (text)
- `difficulty` (text: easy/medium/hard)
- `order_index` (integer)
- `content` (text)
- `definitions` (text[])
- `key_ideas` (text[])
- `created_at` (timestamp)
- `updated_at` (timestamp)

**user_progress**
- `id` (uuid, primary key)
- `user_id` (text)
- `concept_id` (uuid, foreign key)
- `phase_1_score` (integer)
- `phase_2_score` (integer)
- `phase_3_score` (integer)
- `total_score` (integer)
- `badge` (text: bronze/silver/gold)
- `completed` (boolean)
- `retry_count` (integer)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**chat_history**
- `id` (uuid, primary key)
- `user_id` (text)
- `concept_id` (uuid, foreign key)
- `role` (text: user/assistant)
- `content` (text)
- `phase` (integer: 1/2/3)
- `timestamp` (timestamp)

## 🎨 Tech Stack

- **Frontend**: Next.js 14, React 19, TypeScript
- **Styling**: Tailwind CSS, ShadCN UI
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4, Whisper
- **Voice**: ElevenLabs (optional)
- **State**: Zustand
- **Animations**: Framer Motion

## 🔧 Configuration

### Tailwind Configuration
Custom colors, animations, and utilities are defined in `tailwind.config.ts`.

### Next.js Configuration
API routes support file uploads up to 10MB (configurable in `next.config.js`).

## 📝 Development Notes

### Adding New Features

1. **New API Route**: Create in `app/api/[feature]/route.ts`
2. **New Component**: Add to appropriate folder in `components/`
3. **New Page**: Create in `app/[route]/page.tsx`
4. **Database Changes**: Update schema and types

### Testing

- Test PDF upload with various file sizes
- Verify AI responses are appropriate
- Check responsive design on multiple devices
- Test voice input functionality

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables in Production

Ensure all environment variables are set in your deployment platform.

## 📄 License

ISC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js and OpenAI
