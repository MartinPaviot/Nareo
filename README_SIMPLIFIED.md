# 🎓 LevelUp - AI-Powered Learning Platform

Transform your PDF courses into interactive learning experiences with an AI tutor!

## ✨ Features

- 📄 **PDF Upload**: Upload any educational PDF
- 🤖 **AI Concept Extraction**: GPT-4 automatically identifies key concepts
- 💬 **Interactive Chat**: Learn through conversation with Aristo' (AI tutor mascot)
- 🎯 **3-Phase Learning**: MCQ → Short Answer → Reflective Thinking
- 🏆 **Gamification**: Earn badges and track your progress
- 📱 **Responsive Design**: Works on mobile, tablet, and desktop

## 🚀 Quick Start (No Database Required!)

### Prerequisites
- Node.js 18+
- OpenAI API key

### Installation

1. **Clone and install**
```bash
cd LevelUp
npm install
```

2. **Configure OpenAI API**

Create `.env.local`:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

Get your key at: https://platform.openai.com/api-keys

3. **Run the app**
```bash
npm run dev
```

Open http://localhost:3000 🎉

## 📖 How to Use

1. **Upload a PDF**: Drag & drop or click to select your course PDF
2. **Wait for AI**: GPT-4 extracts concepts (15-30 seconds)
3. **Start Learning**: Click "Start Learning Now"
4. **Complete 3 Phases**:
   - Phase 1: Multiple choice questions (+10 pts)
   - Phase 2: Explain in your own words (+30 pts)
   - Phase 3: Apply to real-world scenarios (+60 pts)
5. **Earn Badges**: 🥉 Bronze (60+), 🥈 Silver (80+), 🥇 Gold (100)

## 🏗️ Architecture

### Current Version (In-Memory)
- ✅ All features work
- ✅ No database setup needed
- ⚠️ Data resets on server restart
- ⚠️ Single user only

### Tech Stack
- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **AI**: OpenAI GPT-4
- **Storage**: In-memory (for demo)

## 📁 Project Structure

```
LevelUp/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Upload screen
│   ├── chapter/[id]/      # Chapter overview
│   ├── learn/[conceptId]/ # Learning interface
│   └── api/               # API routes
├── components/            # React components
│   ├── chat/             # Chat interface
│   ├── concepts/         # Concept cards
│   └── layout/           # Layout components
├── lib/                   # Utilities
│   ├── openai.ts         # OpenAI integration
│   ├── memory-store.ts   # In-memory storage
│   └── pdf-parser.ts     # PDF processing
└── types/                 # TypeScript types
```

## 🎨 Mascot Images (Optional)

Add these images to `public/mascot/` for animated Aristo':
- `mascotte.png` - Default state
- `Processing.png` - Thinking
- `Talking.png` - Speaking
- `Happy.png` - Correct answer
- `Disappointed.png` - Needs help
- `adcdebda.png` - Success

Without images, emojis are used instead! 🎓🐱

## 🔧 Troubleshooting

### "Failed to process PDF"
- Check your OpenAI API key in `.env.local`
- Ensure PDF is text-based (not scanned images)
- Try a smaller PDF (< 10 MB)

### Build errors
```bash
npm install
npm run build
```

### Styles not loading
```bash
npm run dev
```

## 📚 Documentation

- `QUICK_START_NO_DB.md` - Detailed setup guide
- `SETUP.md` - Full setup with database
- `DEPLOYMENT_CHECKLIST.md` - Production deployment

## 🚀 Upgrading to Production

For persistent storage and multi-user support:

1. Set up Supabase database
2. Update environment variables
3. Replace memory-store with Supabase client
4. Add authentication

See `SETUP.md` for details.

## 🎯 Roadmap

- [x] PDF upload and parsing
- [x] AI concept extraction
- [x] Interactive chat learning
- [x] 3-phase learning system
- [x] Scoring and badges
- [ ] Voice input/output
- [ ] User authentication
- [ ] Progress persistence
- [ ] Multi-language support

## 📄 License

ISC

## 🤝 Contributing

This is an educational project. Feel free to fork and customize!

---

**Made with ❤️ for better learning experiences**
