# AGENTS.md — Workspace Design & Architecture Standards

This document defines the strict design and coding standards for all AI agents and contributors working in this repository.

## 1. Design System Mandatory Rules (`DESIGN.md`)

All user-facing HTML pages (in `./lessons/`, `./reference/`, and `./index.html`) **MUST strictly adhere to the warm editorial design system defined in `DESIGN.md`**. Never introduce generic white backgrounds, blue bootstrap buttons, or unstyled tables.

### Brand Color Hierarchy
- **Canvas floor (`#faf9f5`)**: Tinted cream canvas. Never use pure white (`#ffffff`) or cool gray for the page background.
- **Primary CTA Coral (`#cc785c`, hover `#a9583e`)**: The signature Anthropic warm coral. Reserved for primary buttons (`.btn-primary`), active states, and full-bleed callout cards (`.callout-coral`).
- **Dark Navy Product Chrome (`#181715`)**: Used for code window cards (`.code-window-card`), terminal output, and page footers (`.footer-dark`).
- **Light Cream Cards (`#efe9de`)**: One step darker than canvas. Used for feature cards and calculators.
- **Ink & Typography (`#141413`)**: Primary text tone. Warm, off-pure-black.

### Typography Discipline
- **Display Headlines (`h1`, `h2`, `h3`, `.display-xl`, `.display-lg`, `.display-md`)**:
  - Font family: `StyreneB`, `Inter`, or system sans-serif fallback.
  - Weight: 600 for clean architectural hierarchy.
  - Letter-spacing: `-1px` to `-0.8px` for `h1`, `-0.6px` to `-0.5px` for `h2`, `-0.3px` for `h3`.
- **Body & UI Elements**:
  - Font family: `StyreneB` or `Inter`.
  - Weight 400 for running body text, 500 for titles, buttons, and badge labels.
- **Code & Numbers**:
  - Font family: `JetBrains Mono`.

### Spacing & Elevation
- Section rhythm: 96px (`--space-section`).
- Internal card padding: 32px (`--space-xl`) or 24px (`--space-lg`).
- Border radii: 8px for buttons/inputs (`--rounded-md`), 12px for cards (`--rounded-lg`), 9999px for badges (`--rounded-pill`).
- Elevation: **Color-block first, shadow rare**. Contrast comes from cream-vs-dark surfaces, not heavy drop shadows.

---

## 2. Page Structure & Components (React PWA & Lessons)

The application is structured as a high-performance **Vite React PWA**.

### Creating Lessons
Every new lesson MUST be created as a TypeScript React component in `src/pages/lessons/LessonXXXX.tsx`:
1. Use standard layout components:
   - `<BadgeRow lessonId="XXXX" lessonBadge="Lesson XXXX" moduleBadge="..." time="..." tag="..." />`
   - `<LessonHeaderStatus lessonId="XXXX" />`
   - `<PrimarySourceCallout sourceText={...} />` (citing Martin Kleppmann, Alex Xu, AWS Builders' Library)
   - `<CodeWindowCard title="..." code="..." />` (TypeScript / Node.js samples)
   - `<AIPitfallCallout title="...">` (common traps AI models produce)
   - `<Quiz id="quiz_XXXX_N" question="..." options={[...]} />` (active retrieval with balanced options)
   - `<LessonNavButtons currentLessonId="XXXX" />`
   - `<AgentReminder title="..." promptText="..." />`
2. Register the component in `src/pages/LessonDispatcher.tsx`:
   - Import `LessonXXXX`
   - Add ID resolution in `resolveCanonicalLessonId`
   - Add route render check `if (canonicalId === 'XXXX') return <LessonXXXX />;`
3. Update `curriculum.json` with the lesson metadata under its module.
4. Verify by running `npm run build` (`tsc && vite build`) to confirm zero compilation errors and clean PWA bundle generation.
5. (Optional) Run `python3 scripts/sync_curriculum.py` to keep legacy multi-page HTML synchronized.

### Reference Sheets
- Reference Sheets are authored in `src/pages/reference/` and registered in `src/pages/ReferenceDispatcher.tsx` and `curriculum.json` (or `reference/TEMPLATE.html` for static fallbacks).

---

## 3. Teaching & Pedagogical Integrity

- Always prioritize high-level system design (throughput, latency, partitioning, failure modes) before low-level software abstractions.
- Express code samples in **TypeScript / Node.js**.
- Always cite verified primary sources from `RESOURCES.md`.

---

## 4. Milestones & End-of-Milestone Practical Tests

Each module in the curriculum culminates in a mandatory **End-of-Milestone Practical Test**.

### Lesson Generation Analysis Rule
**When generating or planning new lessons**:
1. Analyze the cumulative work completed so far across the current module and overarching curriculum.
2. Check whether the newly generated lesson concludes an architectural domain/module (typically 2–4 cohesive lessons) or establishes a critical milestone.
3. If it marks the conclusion of a module or milestone, **a practical milestone test question MUST be generated along with it**:
   - Add the `milestone` object to the module in `curriculum.json` with:
     - `scenario`: High-stakes real-world production challenge (flash sales, high-QPS ingestion, financial ledger, etc.).
     - `trafficAndScale`: Explicit quantitative metrics (QPS, DAU, payload size, latency SLAs, memory budgets).
     - `requirements`: Architectural constraints and rules.
     - `deliverables`: Numbered task sections (1. Capacity Math, 2. Topology & Component Design, 3. Failure Modes & Edge Cases).
     - `evaluationCriteria`: Explicit rubric benchmarks.
     - `customPrompt`: Ready-to-copy review prompt template.
   - Verify that the milestone test is accessible via `/milestones/:id`, displayed in `Home.tsx` under the module card, and connected in `TopNav.tsx` and adjacent lesson navigation.

### Test UI Requirements
The milestone test page (`MilestoneTestPage.tsx`) must always provide:
1. Architectural scenario & system constraints.
2. Numbered practical deliverables.
3. An interactive solution workspace (with auto-save to `localStorage`).
4. A custom AI review prompt generator with one-click copy buttons (`Copy Review Prompt with My Solution` and `Copy Blank Prompt Template`).
5. A clear evaluation rubric.

---

## 5. Milestone Review Protocol (Chat Submissions)

When the student submits a milestone practical test solution in the chat (using the generated custom prompt or by direct message):
Agents **MUST NEVER provide superficial or generic praise**. Deliver an authoritative, senior-architect-grade critique following this exact structure:

1. **🎯 Executive Verdict & Grade**:
   - Grade: e.g. *Senior Architect Grade (9/10)*, *Pass (7/10)*, or *Revisions Recommended*.
   - One-paragraph executive evaluation of the architecture.
2. **✅ What is Good**:
   - Specific praise for mathematically sound sizing calculations.
   - Correct component choices, proper statelessness, sound failure isolation boundaries.
3. **❌ What is Wrong / Risky**:
   - Unforgiving identification of flaws: sizing errors, single points of failure (SPOF), missing backpressure, cache stampede risks, race conditions, dual-write data loss traps, unhandled replication lag anomalies, or missing fencing tokens.
4. **💡 What Can Be Improved**:
   - Concrete production refinements, enterprise patterns, exact observability metrics (p99 latency, queue depth, saturation alerts, error budgets), and scaling headroom.
5. **Next Steps**:
   - Explicit prompt reminding the student to click *"✓ Mark Milestone as Passed"* in the UI and advance to the next module.
