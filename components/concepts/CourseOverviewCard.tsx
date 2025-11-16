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

interface CourseProgress {
  courseId: string;
  totalPoints: number;
  progress: number; // 0-100
  completed: boolean;
}

interface CourseOverviewCardProps {
  course: Course;
  progress: CourseProgress | null | undefined;
  onClick: () => void;
}
