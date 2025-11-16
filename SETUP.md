# 🚀 LevelUp Setup Guide

Complete step-by-step guide to get LevelUp running locally.

## 📋 Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] Supabase account created
- [ ] OpenAI API key obtained
- [ ] Git installed (optional)

## 🔧 Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js 14
- React 19
- Tailwind CSS
- Supabase client
- OpenAI SDK
- PDF parsing libraries
- UI components

### 2. Set Up Supabase

#### A. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details
4. Wait for project to be created

#### B. Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `database/schema.sql`
4. Paste and click "Run"
5. Verify all tables are created in the **Table Editor**

#### C. Get API Keys

1. Go to **Settings** → **API**
2. Copy the following:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### 3. Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in or create account
3. Go to **API Keys**
4. Click "Create new secret key"
5. Copy the key (you won't see it again!)
6. Ensure you have credits/billing set up

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Copy from example
cp .env.local.example .env.local
```

Edit `.env.local` with your actual values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# OpenAI
OPENAI_API_KEY=sk-your_openai_key_here

# Optional: ElevenLabs for voice synthesis
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Add Mascot Images (Optional)

Place mascot images in `public/mascot/`:

```
public/mascot/
├── mascotte.png       (Default/listening)
├── Processing.png     (Reading/thinking)
├── Talking.png        (Speaking)
├── Happy.png          (Correct answer)
├── Disappointed.png   (Confused)
└── adcdebda.png       (Trophy/success)
```

**Note:** If images are not available, the app will use emoji fallbacks.

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You should see the upload screen with Aristo!

## ✅ Verification Steps

### Test 1: Upload Screen
- [ ] Page loads without errors
- [ ] Aristo mascot is visible (or emoji fallback)
- [ ] Drag & drop zone is functional

### Test 2: PDF Upload
- [ ] Upload a sample PDF
- [ ] Processing animation appears
- [ ] Redirects to chapter overview

### Test 3: Chapter Overview
- [ ] Chapter title and summary display
- [ ] Concepts are listed with difficulty badges
- [ ] "Start Learning" button works

### Test 4: Learning Interface
- [ ] Chat interface loads
- [ ] Aristo asks first question
- [ ] Can type and send answers
- [ ] Receives feedback from AI

### Test 5: Voice Input (Optional)
- [ ] Microphone button appears
- [ ] Can record audio
- [ ] Audio is transcribed to text

## 🐛 Troubleshooting

### Issue: "Module not found" errors

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Supabase connection fails

**Check:**
- [ ] Environment variables are correct
- [ ] No extra spaces in `.env.local`
- [ ] Supabase project is active
- [ ] Database schema is applied

### Issue: OpenAI API errors

**Check:**
- [ ] API key is valid
- [ ] Account has credits
- [ ] No rate limits exceeded
- [ ] Using GPT-4 model (requires access)

### Issue: PDF parsing fails

**Check:**
- [ ] PDF is not password-protected
- [ ] PDF contains extractable text (not scanned images)
- [ ] File size is under 10MB

### Issue: Images not loading

**Solution:**
- Images will fallback to emojis automatically
- Check `public/mascot/` folder exists
- Verify image file names match exactly

## 🔒 Security Notes

### Important: Never commit `.env.local`

The `.gitignore` file already excludes it, but double-check:

```bash
git status
# Should NOT show .env.local
```

### API Key Security

- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- **NEVER** commit API keys to version control
- Use environment variables for all secrets
- Rotate keys if accidentally exposed

## 📊 Database Management

### View Data in Supabase

1. Go to **Table Editor**
2. Select table (chapters, concepts, etc.)
3. View/edit data directly

### Reset Database

To start fresh:

```sql
-- In Supabase SQL Editor
DROP TABLE IF EXISTS chat_history CASCADE;
DROP TABLE IF EXISTS user_progress CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS concepts CASCADE;
DROP TABLE IF EXISTS chapters CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Then re-run schema.sql
```

## 🚀 Next Steps

Once everything is working:

1. **Test with real PDFs** - Upload course materials
2. **Customize Aristo** - Add your own mascot images
3. **Adjust prompts** - Modify AI behavior in `lib/openai.ts`
4. **Add authentication** - Implement Supabase Auth
5. **Deploy** - Push to Vercel or your preferred platform

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 💬 Need Help?

- Check the main [README.md](./README.md)
- Review code comments
- Open an issue on GitHub
- Check console for error messages

---

Happy Learning! 🎓
