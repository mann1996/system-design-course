import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { allLessons, allMilestones, LessonInfo, getLessonById } from '../data/curriculum';

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';
export type MilestoneStatus = 'not_started' | 'completed';

export type LessonProgressMap = Record<string, LessonStatus>;
export type MilestoneProgressMap = Record<string, MilestoneStatus>;

export interface ProgressStats {
  totalLessons: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  percentCompleted: number;
  totalMilestones: number;
  completedMilestones: number;
}

export interface LessonProgressContextValue {
  progress: LessonProgressMap;
  milestoneProgress: MilestoneProgressMap;
  getStatus: (lessonId: string) => LessonStatus;
  setStatus: (lessonId: string, status: LessonStatus) => void;
  markCompleted: (lessonId: string) => void;
  markInProgress: (lessonId: string) => void;
  markNotStarted: (lessonId: string) => void;
  cycleStatus: (lessonId: string) => void;
  getMilestoneStatus: (milestoneId: string) => MilestoneStatus;
  markMilestoneCompleted: (milestoneId: string) => void;
  markMilestoneNotStarted: (milestoneId: string) => void;
  toggleMilestoneStatus: (milestoneId: string) => void;
  resetProgress: () => void;
  stats: ProgressStats;
  currentlyReadingLessons: LessonInfo[];
  nextSuggestedLesson: LessonInfo | null;
}

const STORAGE_KEY = 'teach_me_system_design_lesson_progress_v1';
const MILESTONE_STORAGE_KEY = 'teach_me_system_design_milestone_progress_v1';

function normalizeLessonId(id: string): string {
  const clean = id.replace('.html', '');
  const found = getLessonById(clean);
  if (found) return found.id;
  const num = parseInt(clean, 10);
  if (!isNaN(num)) {
    return num.toString().padStart(4, '0');
  }
  return clean;
}

function loadInitialProgress(): LessonProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as LessonProgressMap;
    }
  } catch (err) {
    console.error('Failed to load lesson progress from localStorage:', err);
  }
  return {};
}

function loadInitialMilestones(): MilestoneProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MILESTONE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as MilestoneProgressMap;
    }
  } catch (err) {
    console.error('Failed to load milestone progress from localStorage:', err);
  }
  return {};
}

const LessonProgressContext = createContext<LessonProgressContextValue | undefined>(undefined);

export const LessonProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgressState] = useState<LessonProgressMap>(loadInitialProgress);
  const [milestoneProgress, setMilestoneProgress] = useState<MilestoneProgressMap>(loadInitialMilestones);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (err) {
      console.error('Failed to save lesson progress to localStorage:', err);
    }
  }, [progress]);

  useEffect(() => {
    try {
      localStorage.setItem(MILESTONE_STORAGE_KEY, JSON.stringify(milestoneProgress));
    } catch (err) {
      console.error('Failed to save milestone progress to localStorage:', err);
    }
  }, [milestoneProgress]);

  const getStatus = useCallback(
    (lessonId: string): LessonStatus => {
      const canonicalId = normalizeLessonId(lessonId);
      return progress[canonicalId] || 'not_started';
    },
    [progress]
  );

  const setStatus = useCallback((lessonId: string, status: LessonStatus) => {
    const canonicalId = normalizeLessonId(lessonId);
    setProgressState((prev) => {
      if (prev[canonicalId] === status) return prev;
      return {
        ...prev,
        [canonicalId]: status,
      };
    });
  }, []);

  const markCompleted = useCallback(
    (lessonId: string) => {
      setStatus(lessonId, 'completed');
    },
    [setStatus]
  );

  const markInProgress = useCallback(
    (lessonId: string) => {
      setStatus(lessonId, 'in_progress');
    },
    [setStatus]
  );

  const markNotStarted = useCallback(
    (lessonId: string) => {
      setStatus(lessonId, 'not_started');
    },
    [setStatus]
  );

  const cycleStatus = useCallback(
    (lessonId: string) => {
      const current = getStatus(lessonId);
      const nextMap: Record<LessonStatus, LessonStatus> = {
        not_started: 'in_progress',
        in_progress: 'completed',
        completed: 'not_started',
      };
      setStatus(lessonId, nextMap[current]);
    },
    [getStatus, setStatus]
  );

  // Milestone Progress Actions
  const getMilestoneStatus = useCallback(
    (milestoneId: string): MilestoneStatus => {
      return milestoneProgress[milestoneId] || 'not_started';
    },
    [milestoneProgress]
  );

  const markMilestoneCompleted = useCallback((milestoneId: string) => {
    setMilestoneProgress((prev) => ({
      ...prev,
      [milestoneId]: 'completed',
    }));
  }, []);

  const markMilestoneNotStarted = useCallback((milestoneId: string) => {
    setMilestoneProgress((prev) => {
      const updated = { ...prev };
      delete updated[milestoneId];
      return updated;
    });
  }, []);

  const toggleMilestoneStatus = useCallback((milestoneId: string) => {
    setMilestoneProgress((prev) => {
      const current = prev[milestoneId] || 'not_started';
      return {
        ...prev,
        [milestoneId]: current === 'completed' ? 'not_started' : 'completed',
      };
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProgressState({});
    setMilestoneProgress({});
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(MILESTONE_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear progress from localStorage:', err);
    }
  }, []);

  const stats = useMemo<ProgressStats>(() => {
    const totalLessons = allLessons.length;
    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;

    for (const lesson of allLessons) {
      const status = progress[lesson.id] || 'not_started';
      if (status === 'completed') {
        completedCount++;
      } else if (status === 'in_progress') {
        inProgressCount++;
      } else {
        notStartedCount++;
      }
    }

    const percentCompleted = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    const totalMilestones = allMilestones.length;
    let completedMilestones = 0;
    for (const m of allMilestones) {
      if (milestoneProgress[m.id] === 'completed') {
        completedMilestones++;
      }
    }

    return {
      totalLessons,
      completedCount,
      inProgressCount,
      notStartedCount,
      percentCompleted,
      totalMilestones,
      completedMilestones,
    };
  }, [progress, milestoneProgress]);

  const currentlyReadingLessons = useMemo<LessonInfo[]>(() => {
    return allLessons.filter((l) => (progress[l.id] || 'not_started') === 'in_progress');
  }, [progress]);

  const nextSuggestedLesson = useMemo<LessonInfo | null>(() => {
    if (currentlyReadingLessons.length > 0) {
      return currentlyReadingLessons[0];
    }
    const firstNotStarted = allLessons.find(
      (l) => (progress[l.id] || 'not_started') === 'not_started'
    );
    if (firstNotStarted) return firstNotStarted;
    return allLessons[0] || null;
  }, [currentlyReadingLessons, progress]);

  const value = useMemo<LessonProgressContextValue>(
    () => ({
      progress,
      milestoneProgress,
      getStatus,
      setStatus,
      markCompleted,
      markInProgress,
      markNotStarted,
      cycleStatus,
      getMilestoneStatus,
      markMilestoneCompleted,
      markMilestoneNotStarted,
      toggleMilestoneStatus,
      resetProgress,
      stats,
      currentlyReadingLessons,
      nextSuggestedLesson,
    }),
    [
      progress,
      milestoneProgress,
      getStatus,
      setStatus,
      markCompleted,
      markInProgress,
      markNotStarted,
      cycleStatus,
      getMilestoneStatus,
      markMilestoneCompleted,
      markMilestoneNotStarted,
      toggleMilestoneStatus,
      resetProgress,
      stats,
      currentlyReadingLessons,
      nextSuggestedLesson,
    ]
  );

  return <LessonProgressContext.Provider value={value}>{children}</LessonProgressContext.Provider>;
};

export function useLessonProgress(): LessonProgressContextValue {
  const context = useContext(LessonProgressContext);
  if (!context) {
    throw new Error('useLessonProgress must be used within a LessonProgressProvider');
  }
  return context;
}
