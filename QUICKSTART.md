# ⚡ LevelUp Quick Start Guide

Get LevelUp running in 5 minutes!

## 🚀 Fast Setup

### 1. Install Dependencies (2 min)

```bash
npm install
```

### 2. Configure Environment (1 min)

Create `.env.local`:

```bash
# Minimum required to start
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=sk-your_key
```

### 3. Setup Database (1 min)

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy `database/schema.sql` into SQL Editor
4. Run the query

### 4. Start Development Server (30 sec)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## ✅ Verify It Works

### Test 1: Upload Screen
- ✓ Page loads
- ✓ Aristo mascot visible (or emoji)
- ✓ Can drag/drop files

### Test 2: Upload PDF
- ✓ Select a PDF file
- ✓ Processing animation shows
- ✓ Redirects to chapter overview

### Test 3: Start Learning
- ✓ Click "Start Learning"
- ✓ Chat interface loads
- ✓ Aristo asks first question

## 🎯 What You Get

### 8 Complete Screens
1. ✅ Upload Screen - PDF drop zone
2. ✅ Chapter Overview - Concept list
3. ✅ Learning Interface - AI chat
4. ✅ Phase 1 - MCQ questions
5. ✅ Phase 2 - Short answers
6. ✅ Phase 3 - Reflective questions
7. ✅ Progress Tracking - Real-time scores
8. ✅ Session Recap - Performance summary

### Core Features
- ✅ PDF upload & parsing
- ✅ AI concept extraction (GPT-4)
- ✅ Interactive chat learning
- ✅ 3-phase progressive learning
- ✅ Gamification (badges, scores)
- ✅ Voice input (Whisper)
- ✅ Real-time progress tracking
- ✅ Mobile responsive design

## 📁 Key Files

```
app/page.tsx              → Upload screen
app/chapter/[id]/page.tsx → Chapter overview
app/learn/[conceptId]/    → Learning interface
app/recap/[sessionId]/    → Session recap

app/api/upload/           → PDF processing
app/api/chat/question/    → Generate questions
app/api/chat/evaluate/    → Evaluate answers

components/chat/          → Chat components
components/concepts/      → Concept cards
lib/openai.ts            → AI integration
database/schema.sql      → Database setup
```

## 🐛 Quick Troubleshooting

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Supabase connection failed"
- Check `.env.local` has correct values
- Verify Supabase project is active
- Run `database/schema.sql` in Supabase

### "OpenAI API error"
- Verify API key is valid
- Check account has credits
- Ensure GPT-4 access enabled

### "PDF parsing failed"
- PDF must contain text (not scanned images)
- File size under 10MB
- Not password-protected

## 🎨 Customization

### Change Theme Colors
Edit `tailwind.config.ts`:
```typescript
colors: {
  primary: { ... } // Change orange to your color
}
```

### Modify AI Behavior
Edit `lib/openai.ts`:
```typescript
// Adjust prompts, temperature, etc.
```

### Add Mascot Images
Place in `public/mascot/`:
- mascotte.png
- Processing.png
- Talking.png
- Happy.png
- Disappointed.png
- adcdebda.png

## 📚 Next Steps

1. **Read Full Docs**: [README.md](./README.md)
2. **Detailed Setup**: [SETUP.md](./SETUP.md)
3. **Project Structure**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
4. **Test with Real PDFs**: Upload course materials
5. **Deploy**: Push to Vercel

## 💡 Pro Tips

- Use GPT-4 for best results (GPT-3.5 works but less accurate)
- Start with small PDFs (5-10 pages) for testing
- Voice input requires HTTPS (works on localhost)
- Check browser console for detailed errors
- Supabase has generous free tier

## 🎓 Example Usage

1. Upload a course PDF (e.g., "Introduction to React")
2. AI extracts concepts (e.g., "Components", "Props", "State")
3. Start learning first concept
4. Answer MCQ questions (Phase 1)
5. Explain in your own words (Phase 2)
6. Apply to real scenarios (Phase 3)
7. Earn badges and track progress
8. Review session recap

## 🔗 Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🆘 Need Help?

1. Check console for errors
2. Review [SETUP.md](./SETUP.md) troubleshooting
3. Verify all environment variables
4. Test API keys separately
5. Check Supabase logs

---

**Ready to Level Up? 🚀**

```bash
npm run dev
```

Happy Learning! 🎓
