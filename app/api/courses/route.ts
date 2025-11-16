import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memory-store';

interface Course {
  id: string;
  title: string;
  englishTitle: string;
  frenchTitle: string;
  englishDescription: string;
  frenchDescription: string;
  chapters: Array<{
    id: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    questions: any[];
  }>;
  totalQuestions: number;
  totalPoints: number;
  progress: number; // 0-100
  createdAt: Date;
}

export async function GET() {
  try {
    // Get all chapters
    const allChapters = memoryStore.getAllChapters();
    const allProgress = memoryStore.getAllChapterProgress();

    // Group chapters by course (assuming 3 chapters per course: easy, medium, hard)
    const coursesMap = new Map<string, Course>();

    // Sort chapters by creation date to group them properly
    const sortedChapters = allChapters.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Group chapters into courses (3 chapters per course)
    for (let i = 0; i < sortedChapters.length; i += 3) {
      const courseChapters = sortedChapters.slice(i, i + 3);

      if (courseChapters.length > 0) {
        // Use the first chapter's ID as course ID (they're grouped together)
        const courseId = courseChapters[0].id;

        // Calculate total points and progress for this course
        let totalPoints = 0;
        let completedChapters = 0;

        courseChapters.forEach(chapter => {
          const progress = allProgress.find(p => p.chapterId === chapter.id);
          if (progress) {
            totalPoints += progress.score;
            if (progress.completed) completedChapters++;
          }
        });

        const progress = courseChapters.length > 0 ? (completedChapters / courseChapters.length) * 100 : 0;

        const course: Course = {
          id: courseId,
          title: courseChapters[0].title, // Backward compatibility
          englishTitle: courseChapters[0].englishTitle,
          frenchTitle: courseChapters[0].frenchTitle,
          englishDescription: courseChapters[0].englishDescription,
          frenchDescription: courseChapters[0].frenchDescription,
          chapters: courseChapters.map(ch => ({
            id: ch.id,
            title: ch.title,
            difficulty: ch.difficulty || 'medium',
            questions: ch.questions || [],
          })),
          totalQuestions: courseChapters.reduce((sum, ch) => sum + (ch.questions?.length || 0), 0),
          totalPoints,
          progress,
          createdAt: courseChapters[0].createdAt,
        };

        coursesMap.set(courseId, course);
      }
    }

    const courses = Array.from(coursesMap.values());

    return NextResponse.json({
      success: true,
      courses,
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}
