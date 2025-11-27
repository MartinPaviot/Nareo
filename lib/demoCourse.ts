export type DemoQuestionType = 'mcq' | 'short';

export interface DemoQuestion {
  id: string;
  prompt: string;
  type: DemoQuestionType;
  options?: Record<string, string>;
  answer: string;
  explanation: string;
}

export interface DemoChapter {
  id: string;
  title: string;
  summary: string;
  index: number;
  questions: DemoQuestion[];
}

export interface DemoCourse {
  id: string;
  title: string;
  description: string;
  chapters: DemoChapter[];
}

const STORAGE_KEY = 'levelup_demo_course';

function randomizeLabel(text: string, idx: number) {
  return `${text}${idx + 1}`;
}

export function buildDemoCourseFromFiles(fileNames: string[]): DemoCourse {
  const titleSource = fileNames[0] || 'Your course';
  const title = `${titleSource.replace(/\.[^/.]+$/, '')} (Preview)`;
  const description = `Quick preview generated from ${fileNames.length || 1} file(s). The first chapter is fully unlocked so you can start right away.`;

  const topics = fileNames.slice(0, 3).map((name, idx) => randomizeLabel(name.split('.')[0], idx));

  const chapters: DemoChapter[] = [
    {
      id: 'demo-ch1',
      title: 'Chapter 1 · Foundations',
      index: 1,
      summary: `Core ideas detected from your upload: ${topics.join(', ')}. Short, friendly recap to get you started.`,
      questions: [
        {
          id: 'demo-q1',
          prompt: 'What is the primary objective of this chapter based on your upload?',
          type: 'mcq',
          options: {
            A: 'Identify the main themes and vocabulary',
            B: 'Memorize dates only',
            C: 'Skip to the hardest parts',
            D: 'Focus exclusively on diagrams',
          },
          answer: 'A',
          explanation: 'We start by mapping the main themes so you build a solid base before diving deeper.',
        },
        {
          id: 'demo-q2',
          prompt: 'Name one key concept mentioned in your document.',
          type: 'short',
          answer: 'custom',
          explanation: 'Pull one of the highlighted concepts so you anchor it in memory.',
        },
        {
          id: 'demo-q3',
          prompt: 'How would you apply the chapter concepts in a practical example?',
          type: 'short',
          answer: 'custom',
          explanation: 'Applying the ideas to a concrete example cements understanding.',
        },
      ],
    },
    {
      id: 'demo-ch2',
      title: 'Chapter 2 · Deepen & connect',
      index: 2,
      summary: 'Link the earlier ideas together and test yourself with slightly harder questions.',
      questions: [
        {
          id: 'demo-q4',
          prompt: 'Which statement best connects two of the chapter ideas?',
          type: 'mcq',
          options: {
            A: 'They oppose each other completely',
            B: 'They build on the same core principle',
            C: 'They are unrelated',
            D: 'They cancel each other out',
          },
          answer: 'B',
          explanation: 'Good learning connects ideas so you can recall them faster under pressure.',
        },
        {
          id: 'demo-q5',
          prompt: 'Write a quick summary linking the key ideas.',
          type: 'short',
          answer: 'custom',
          explanation: 'Summarizing in your own words is proven to improve retention.',
        },
      ],
    },
    {
      id: 'demo-ch3',
      title: 'Chapter 3 · Exam mode',
      index: 3,
      summary: 'Premium chapter with full coverage and tougher questions.',
      questions: [
        {
          id: 'demo-q6',
          prompt: 'Which approach helps you retain this chapter best?',
          type: 'mcq',
          options: {
            A: 'Reread without testing',
            B: 'Spaced retrieval with quizzes',
            C: 'Only highlight text',
            D: 'Wait until the night before the exam',
          },
          answer: 'B',
          explanation: 'Active recall and spaced practice lead to stronger memory formation.',
        },
        {
          id: 'demo-q7',
          prompt: 'List two weaknesses you want to improve in this chapter.',
          type: 'short',
          answer: 'custom',
          explanation: 'Identifying weak spots early lets you focus practice where it matters most.',
        },
      ],
    },
  ];

  return {
    id: `demo-${Date.now()}`,
    title,
    description,
    chapters,
  };
}

export function persistDemoCourse(course: DemoCourse) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(course));
}

export function loadDemoCourse(courseId?: string): DemoCourse | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DemoCourse;
    if (courseId && parsed.id !== courseId) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to parse demo course', error);
    return null;
  }
}
