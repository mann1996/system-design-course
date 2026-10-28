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

export const allModules: ModuleInfo[] = curriculum.modules.map((mod) => ({
  ...mod,
  lessons: mod.lessons.map((les) => ({
    ...les,
    moduleId: mod.id,
    moduleBadge: mod.badge,
    moduleNumber: mod.number,
  })),
}));

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

/**
 * Generates a self-contained, generic AI review prompt.
 * Contains the complete scenario, scale metrics, deliverables, rubric, and solution draft.
 * Can be pasted into any external AI chat (ChatGPT, Claude, Gemini, DeepSeek, etc.)
 * with zero prior knowledge of the curriculum.
 */
export function generateMilestoneReviewPrompt(
  milestone: MilestoneInfo,
  solution?: string
): string {
  const deliverablesText = milestone.question.deliverables
    .map(
      (deliv, idx) =>
        `### Deliverable ${idx + 1}: ${deliv.section}\n${deliv.description}\n` +
        deliv.tasks.map((task, tIdx) => `  ${tIdx + 1}. ${task}`).join('\n')
    )
    .join('\n\n');

  const scaleText = milestone.question.trafficAndScale.map((s) => `• ${s}`).join('\n');
  const reqText = milestone.question.requirements.map((r) => `• ${r}`).join('\n');
  const rubricText = milestone.question.evaluationCriteria.map((c) => `• ${c}`).join('\n');

  const solutionBlock =
    solution && solution.trim().length > 0
      ? solution.trim()
      : '[PASTE YOUR ARCHITECTURAL SOLUTION HERE]';

  return `You are acting as an expert Principal Distributed Systems Architect conducting an authoritative, rigorous system design review. I am submitting my proposed technical architecture for the real-world production challenge detailed below. Please evaluate my solution objectively and thoroughly without superficial praise.

================================================================================
SYSTEM DESIGN PRACTICAL CHALLENGE: ${milestone.title}
================================================================================

## 1. Real-World Scenario Context
${milestone.question.scenario}

## 2. Quantitative Scale & Operational Bounds
${scaleText}

## 3. Core Architectural Requirements & Constraints
${reqText}

## 4. Required Deliverables & Questions to Address
${deliverablesText}

## 5. Architectural Evaluation Rubric
${rubricText}

================================================================================
CANDIDATE'S PROPOSED SOLUTION
================================================================================
${solutionBlock}
================================================================================

## REVIEW INSTRUCTIONS FOR THE ARCHITECT:
Evaluate the candidate's solution against the scenario constraints, required deliverables, and evaluation rubric with staff-level rigor. Be objective, technically precise, and constructively critical.

Format your review using the following exact structure:

### 🎯 Executive Verdict & Grade
- Grade: [Assign a grade: e.g., Senior Architect Grade (9/10), Pass (7/10), or Revisions Recommended]
- Summary: A 1-2 paragraph executive assessment of whether this architecture would survive production traffic without catastrophic collapse, cascading outages, or data loss.

### ✅ What is Good
- Detail sound design choices, mathematically accurate sizing calculations, correct component selections, statelessness guarantees, and effective fault isolation boundaries.
- Cite specific elements from the candidate's solution that demonstrated senior-level competence.

### ❌ What is Wrong / Risky
- Rigorously identify any flaws: sizing or unit conversion errors, single points of failure (SPOF), missing consumer backpressure, cache stampede vulnerabilities, race conditions, dual-write data loss risks, replication lag anomalies, or unhandled network partition failure modes.
- Explain the specific failure cascade that would occur under peak load if left unfixed.

### 💡 What Can Be Improved
- Recommend concrete, production-grade architectural refinements and enterprise patterns.
- Specify exact observability and alerting metrics (e.g. target p99 latency thresholds, queue consumer lag alerts, CPU/memory saturation watermarks, and error budgets).
- Highlight scaling headroom and future resilience steps.`;
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
