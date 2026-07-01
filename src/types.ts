export interface TestCase {
  input: string;
  expectedOutput: string;
}

export interface Challenge {
  id: string;
  level: number;
  title: string;
  category: string;
  difficulty: number;
  xp: string;
  filesToSubmit: string;
  allowedFunctions: string;
  instructions: string[];
  expectedSignature: string;
  testTemplate: string;
  initialStudentCode: string;
  testCases: TestCase[];
  expectedOutput?: string; // computed: joined expectedOutputs for display
}

export interface ExecutionResult {
  success: boolean;
  compilationError?: string;
  stdout?: string;
  testResults?: {
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
  }[];
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
  rank: number;
  completedCount: number;
  currentStreak: number;
  isCurrentUser?: boolean;
}


export interface User {
  id: string;
  username: string;
  email: string;
  role: "student" | "admin";
  xp: number;
  completed: string[];
}

export type AppView = "landing" | "home" | "practice" | "exam";

export interface ExamResult {
  totalQuestions: number;
  correctAnswers: number;
  score: number; // percentage
  timeTaken: number; // seconds
  details: {
    challengeId: string;
    title: string;
    passed: boolean;
  }[];
}

export interface GuestSession {
  isGuest: true;
}
