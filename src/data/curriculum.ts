import curriculumData from '../../curriculum.json';

export interface LessonInfo {
  id: string;
  filename: string;
  title: string;
  navTitle: string;
  badge: string;
  time: string;
  tag: string;
  summary: string;
  moduleId?: string;
  moduleBadge?: string;
  moduleNumber?: number;
}

export interface DeliverableSection {
  section: string;
  description: string;
  tasks: string[];
}

export interface MilestoneQuestion {
  scenario: string;
  trafficAndScale: string[];
  requirements: string[];
  deliverables: DeliverableSection[];
  evaluationCriteria: string[];
}

export interface MilestoneInfo {
  id: string;
  number: number;
  title: string;
  navTitle: string;
  badge: string;
  time: string;
  tag: string;
  summary: string;
  question: MilestoneQuestion;
  customPrompt: string;
  moduleId?: string;
  moduleBadge?: string;
  moduleNumber?: number;
}

export interface ModuleInfo {
  id: string;
  number: number;
  title: string;
  badge: string;
  description: string;
  lessons: LessonInfo[];
  milestone?: MilestoneInfo;
}

export interface ReferenceInfo {
  id: string;
  filename: string;
  title: string;
  navTitle: string;
  badge: string;
  category: string;
  summary: string;
}

export interface Curriculum {
  curriculumTitle: string;
  modules: ModuleInfo[];
  references: ReferenceInfo[];
}

export const curriculum: Curriculum = curriculumData as Curriculum;

export const allLessons: LessonInfo[] = curriculum.modules.flatMap((mod) =>
  mod.lessons.map((les) => ({
    ...les,
    moduleId: mod.id,
    moduleBadge: mod.badge,
    moduleNumber: mod.number,
  }))
);

export const allMilestones: MilestoneInfo[] = curriculum.modules
  .filter((mod) => !!mod.milestone)
  .map((mod) => ({
    ...mod.milestone!,
    moduleId: mod.id,
    moduleBadge: mod.badge,
    moduleNumber: mod.number,
  }));

export const allReferences: ReferenceInfo[] = curriculum.references;

export function getLessonById(id: string): LessonInfo | undefined {
  const cleanId = id.replace(/^0+/, '').padStart(4, '0');
  return allLessons.find(
    (l) => l.id === id || l.id === cleanId || l.filename === id || l.filename.startsWith(id)
  );
}

export function getMilestoneById(id: string): MilestoneInfo | undefined {
  const cleanId = id.replace(/\.html$/, '');
  return allMilestones.find(
    (m) =>
      m.id === id ||
      m.id === cleanId ||
      m.id === `milestone-${id}` ||
      cleanId.endsWith(m.id)
  );
}

export function getMilestoneForModule(moduleId: string): MilestoneInfo | undefined {
  return allMilestones.find((m) => m.moduleId === moduleId);
}

export function getReferenceById(id: string): ReferenceInfo | undefined {
  const cleanId = id.replace(/\.html$/, '');
  return allReferences.find(
    (r) => r.id === id || r.id === cleanId || r.filename === id || r.filename.replace(/\.html$/, '') === cleanId
  );
}

export interface CourseTimelineItem {
  id: string;
  type: 'lesson' | 'milestone';
  title: string;
  navTitle: string;
  path: string;
  badge: string;
}

// Build unified course sequence: Lessons with their concluding Milestone test
export const courseTimeline: CourseTimelineItem[] = curriculum.modules.flatMap((mod) => {
  const items: CourseTimelineItem[] = mod.lessons.map((les) => ({
    id: les.id,
    type: 'lesson' as const,
    title: les.title,
    navTitle: les.navTitle,
    path: `/lessons/${les.id}`,
    badge: les.badge,
  }));

  if (mod.milestone) {
    items.push({
      id: mod.milestone.id,
      type: 'milestone' as const,
      title: mod.milestone.title,
      navTitle: mod.milestone.navTitle,
      path: `/milestones/${mod.milestone.id}`,
      badge: mod.milestone.badge,
    });
  }

  return items;
});

export function getAdjacentCourseItem(id: string, type: 'lesson' | 'milestone' = 'lesson') {
  const cleanId = type === 'lesson' ? (getLessonById(id)?.id || id) : (getMilestoneById(id)?.id || id);
  const index = courseTimeline.findIndex((item) => item.id === cleanId && item.type === type);

  if (index === -1) {
    return { prev: null, next: null };
  }

  return {
    prev: index > 0 ? courseTimeline[index - 1] : null,
    next: index < courseTimeline.length - 1 ? courseTimeline[index + 1] : null,
  };
}

// Backward-compatible helper for lessons
export function getAdjacentLessons(currentId: string) {
  const adj = getAdjacentCourseItem(currentId, 'lesson');
  return {
    prev: adj.prev
      ? { id: adj.prev.id, navTitle: adj.prev.navTitle, path: adj.prev.path, badge: adj.prev.badge }
      : null,
    next: adj.next
      ? { id: adj.next.id, navTitle: adj.next.navTitle, path: adj.next.path, badge: adj.next.badge }
      : null,
  };
}
