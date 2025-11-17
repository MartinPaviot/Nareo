#!/usr/bin/env ts-node

/**
 * Migration Script: MemoryStore → Supabase
 * 
 * This script migrates all existing data from the old MemoryStore
 * (localStorage/globalThis) to Supabase tables.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-memory-to-supabase.ts
 * 
 * Prerequisites:
 *   1. SQL schema must be executed in Supabase first
 *   2. Environment variables must be set (NEXT_PUBLIC_SUPABASE_URL, etc.)
 *   3. SUPABASE_SERVICE_ROLE_KEY must be set for admin operations
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// DATA LOADING
// ============================================================================

interface OldMemoryStoreData {
  chapters: Array<[string, any]>;
  concepts: Array<[string, any]>;
  progress: Array<[string, any]>;
  chatHistory: Array<[string, any]>;
  chapterProgress: Array<[string, any]>;
  translations: Array<[string, any]>;
}

function loadOldData(): OldMemoryStoreData | null {
  try {
    // Try to load from localStorage backup (if running in browser context)
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('levelup_data');
      if (stored) {
        const data = JSON.parse(stored);
        console.log('✅ Loaded data from localStorage');
        return data;
      }
    }

    // Try to load from a backup file
    const backupPath = path.join(process.cwd(), 'memory-store-backup.json');
    if (fs.existsSync(backupPath)) {
      const data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
      console.log('✅ Loaded data from backup file:', backupPath);
      return data;
    }

    console.warn('⚠️ No data found to migrate');
    console.log('   To migrate data, either:');
    console.log('   1. Export localStorage data to memory-store-backup.json');
    console.log('   2. Run this script in a browser context with localStorage access');
    return null;
  } catch (error) {
    console.error('❌ Error loading old data:', error);
    return null;
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function migrateChapters(chapters: Array<[string, any]>): Promise<number> {
  console.log('\n📚 Migrating chapters...');
  let count = 0;

  for (const [id, chapter] of chapters) {
    try {
      const { error } = await supabase.from('chapters').upsert({
        id: chapter.id,
        title: chapter.title,
        summary: chapter.summary,
        english_title: chapter.englishTitle,
        english_description: chapter.englishDescription,
        french_title: chapter.frenchTitle,
        french_description: chapter.frenchDescription,
        pdf_text: chapter.pdfText,
        extracted_text: chapter.extractedText,
        difficulty: chapter.difficulty,
        order_index: chapter.orderIndex ?? 0,
        questions: chapter.questions ?? [],
        source_text: chapter.sourceText,
        created_at: chapter.createdAt ? new Date(chapter.createdAt).toISOString() : new Date().toISOString(),
      });

      if (error) throw error;
      count++;
      console.log(`  ✅ Chapter: ${chapter.title}`);
    } catch (error) {
      console.error(`  ❌ Failed to migrate chapter ${id}:`, error);
    }
  }

  console.log(`✅ Migrated ${count}/${chapters.length} chapters`);
  return count;
}

async function migrateConcepts(concepts: Array<[string, any]>): Promise<number> {
  console.log('\n💡 Migrating concepts...');
  let count = 0;

  for (const [id, concept] of concepts) {
    try {
      const { error } = await supabase.from('concepts').upsert({
        id: concept.id,
        chapter_id: concept.chapterId,
        title: concept.title,
        description: concept.description,
        difficulty: concept.difficulty,
        order_index: concept.orderIndex,
        source_text: concept.sourceText,
      });

      if (error) throw error;
      count++;
      console.log(`  ✅ Concept: ${concept.title}`);
    } catch (error) {
      console.error(`  ❌ Failed to migrate concept ${id}:`, error);
    }
  }

  console.log(`✅ Migrated ${count}/${concepts.length} concepts`);
  return count;
}

async function migrateProgress(progress: Array<[string, any]>): Promise<number> {
  console.log('\n📊 Migrating user progress...');
  let count = 0;

  for (const [conceptId, prog] of progress) {
    try {
      const { error } = await supabase.from('user_progress').upsert({
        concept_id: prog.conceptId,
        phase1_score: prog.phase1Score ?? 0,
        phase2_score: prog.phase2Score ?? 0,
        phase3_score: prog.phase3Score ?? 0,
        total_score: prog.totalScore ?? 0,
        badge: prog.badge,
        completed: prog.completed ?? false,
      });

      if (error) throw error;
      count++;
      console.log(`  ✅ Progress for concept: ${conceptId}`);
    } catch (error) {
      console.error(`  ❌ Failed to migrate progress for ${conceptId}:`, error);
    }
  }

  console.log(`✅ Migrated ${count}/${progress.length} progress records`);
  return count;
}

async function migrateChatHistory(chatHistory: Array<[string, any]>): Promise<number> {
  console.log('\n💬 Migrating chat history...');
  let count = 0;

  for (const [conceptId, chat] of chatHistory) {
    try {
      const messages = (chat.messages || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
      }));

      const { error } = await supabase.from('chat_history').upsert({
        concept_id: chat.conceptId,
        messages,
      });

      if (error) throw error;
      count++;
      console.log(`  ✅ Chat history for concept: ${conceptId} (${messages.length} messages)`);
    } catch (error) {
      console.error(`  ❌ Failed to migrate chat history for ${conceptId}:`, error);
    }
  }

  console.log(`✅ Migrated ${count}/${chatHistory.length} chat histories`);
  return count;
}

async function migrateChapterProgress(chapterProgress: Array<[string, any]>): Promise<number> {
  console.log('\n📝 Migrating chapter progress...');
  let count = 0;

  for (const [chapterId, progress] of chapterProgress) {
    try {
      const { error } = await supabase.from('chapter_progress').upsert({
        chapter_id: progress.chapterId,
        current_question: progress.currentQuestion ?? 1,
        questions_answered: progress.questionsAnswered ?? 0,
        score: progress.score ?? 0,
        completed: progress.completed ?? false,
        answers: progress.answers ?? [],
      });

      if (error) throw error;
      count++;
      console.log(`  ✅ Chapter progress: ${chapterId}`);
    } catch (error) {
      console.error(`  ❌ Failed to migrate chapter progress for ${chapterId}:`, error);
    }
  }

  console.log(`✅ Migrated ${count}/${chapterProgress.length} chapter progress records`);
  return count;
}

async function migrateTranslations(translations: Array<[string, any]>): Promise<number> {
  console.log('\n🌐 Migrating translations...');
  let count = 0;

  for (const [key, value] of translations) {
    try {
      const { error } = await supabase.from('translations').upsert({
        key,
        value,
      });

      if (error) throw error;
      count++;
      console.log(`  ✅ Translation: ${key}`);
    } catch (error) {
      console.error(`  ❌ Failed to migrate translation ${key}:`, error);
    }
  }

  console.log(`✅ Migrated ${count}/${translations.length} translations`);
  return count;
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function main() {
  console.log('🚀 Starting MemoryStore → Supabase Migration');
  console.log('='.repeat(60));

  // Load old data
  const oldData = loadOldData();
  if (!oldData) {
    console.log('\n⚠️ No data to migrate. Exiting.');
    return;
  }

  // Display summary
  console.log('\n📋 Data Summary:');
  console.log(`   Chapters: ${oldData.chapters?.length || 0}`);
  console.log(`   Concepts: ${oldData.concepts?.length || 0}`);
  console.log(`   Progress: ${oldData.progress?.length || 0}`);
  console.log(`   Chat History: ${oldData.chatHistory?.length || 0}`);
  console.log(`   Chapter Progress: ${oldData.chapterProgress?.length || 0}`);
  console.log(`   Translations: ${oldData.translations?.length || 0}`);

  // Confirm migration
  console.log('\n⚠️  This will upsert data into Supabase.');
  console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Perform migration in order (respecting foreign keys)
  const stats = {
    chapters: 0,
    concepts: 0,
    progress: 0,
    chatHistory: 0,
    chapterProgress: 0,
    translations: 0,
  };

  try {
    // 1. Chapters first (no dependencies)
    if (oldData.chapters?.length) {
      stats.chapters = await migrateChapters(oldData.chapters);
    }

    // 2. Concepts (depends on chapters)
    if (oldData.concepts?.length) {
      stats.concepts = await migrateConcepts(oldData.concepts);
    }

    // 3. Progress (depends on concepts)
    if (oldData.progress?.length) {
      stats.progress = await migrateProgress(oldData.progress);
    }

    // 4. Chat history (depends on concepts)
    if (oldData.chatHistory?.length) {
      stats.chatHistory = await migrateChatHistory(oldData.chatHistory);
    }

    // 5. Chapter progress (depends on chapters)
    if (oldData.chapterProgress?.length) {
      stats.chapterProgress = await migrateChapterProgress(oldData.chapterProgress);
    }

    // 6. Translations (no dependencies)
    if (oldData.translations?.length) {
      stats.translations = await migrateTranslations(oldData.translations);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration Complete!');
    console.log('='.repeat(60));
    console.log('\n📊 Final Statistics:');
    console.log(`   Chapters: ${stats.chapters}`);
    console.log(`   Concepts: ${stats.concepts}`);
    console.log(`   Progress: ${stats.progress}`);
    console.log(`   Chat History: ${stats.chatHistory}`);
    console.log(`   Chapter Progress: ${stats.chapterProgress}`);
    console.log(`   Translations: ${stats.translations}`);
    console.log('\n🎉 All data has been migrated to Supabase!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Verify data in Supabase dashboard');
    console.log('   2. Update all API routes to use async/await');
    console.log('   3. Test the application thoroughly');
    console.log('   4. Consider backing up localStorage before clearing it');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// HELPER: Create backup from localStorage
// ============================================================================

export function createBackupFile() {
  if (typeof window === 'undefined') {
    console.error('❌ This function must be run in a browser context');
    return;
  }

  const stored = localStorage.getItem('levelup_data');
  if (!stored) {
    console.error('❌ No data found in localStorage');
    return;
  }

  const data = JSON.parse(stored);
  const json = JSON.stringify(data, null, 2);
  
  // Create download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'memory-store-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('✅ Backup file created: memory-store-backup.json');
  console.log('   Place this file in the project root and run the migration script');
}

// Run migration if executed directly
if (require.main === module) {
  main().catch(console.error);
}
