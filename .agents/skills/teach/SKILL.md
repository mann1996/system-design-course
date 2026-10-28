---
name: teach
description: Teach the user a new skill or concept, within this workspace.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

The user has asked you to teach them something. This is a stateful request - they intend to learn the topic over multiple sessions.

## Teaching Workspace

Treat the current directory as a teaching workspace. Workspace paths (`./lessons/` and the rest) resolve from the directory `/teach` was run in; only the `*-FORMAT.md` links resolve from this skill's folder. The state of their learning is captured in this directory in several files:

- `MISSION.md`: A document capturing the _reason_ the user is interested in the topic. This should be used to ground all teaching. Use the format in [MISSION-FORMAT.md](./MISSION-FORMAT.md).
- `./src/pages/lessons/LessonXXXX.tsx`: The primary unit of teaching in this workspace. Each lesson is a React component within the Vite PWA application.
- `curriculum.json` and `src/data/curriculum.ts`: The curriculum source of truth. Every lesson must have an entry in `curriculum.json` under its module.
- `src/pages/LessonDispatcher.tsx`: The router dispatcher mapping lesson IDs to their React component.
- `./reference/*.html` / `src/pages/reference/*`: Reference materials and cheat sheets.
- `RESOURCES.md`: Ground-truth sources (Martin Kleppmann, Alex Xu, AWS Builders' Library) to cite in lessons.
- `./learning-records/*.md`: Learning records capturing non-obvious lessons and key insights.
- `NOTES.md`: Scratchpad for user preferences and pedagogical notes.

## Philosophy

To learn at a deep level, the user needs three things:

- **Knowledge**, captured from high-quality, high-trust resources
- **Skills**, acquired through highly-relevant interactive lessons devised by you, based on the knowledge
- **Wisdom**, which comes from interacting with other learners and practitioners

Before the `RESOURCES.md` is well-populated, your focus should be to find high-quality resources which will help the user acquire knowledge. Never trust your parametric knowledge.

Some topics may require more skills than knowledge. Learning more about theoretical physics might be more knowledge-based. For yoga, more skills-based.

### Fluency vs Storage Strength

You should be careful to split between two types of learning:

- **Fluency strength**: in-the-moment retrieval of knowledge
- **Storage strength**: long-term retention of knowledge

Fluency can give the user an illusory sense of mastery, but storage strength is the real goal. Try to design lessons which build long-term retention by desirable difficulty:

- Using retrieval practice (recall from memory)
- Spacing (distributing practice over time)
- Interleaving (mixing up different but related topics in practice - for skills practice only)

## Lessons (React PWA)

A lesson is the primary unit of learning: the component in which knowledge and skills reach the user. In this repository, lessons are authored as **React components within the Vite PWA application** at `src/pages/lessons/LessonXXXX.tsx` (e.g., `Lesson0007.tsx`).

### Required Component Architecture
Every lesson component must be clean, modular, and use the workspace UI component suite:
- `<BadgeRow lessonId="XXXX" lessonBadge="Lesson XXXX" moduleBadge="..." time="..." tag="..." />`
- `<LessonHeaderStatus lessonId="XXXX" />`
- `<PrimarySourceCallout sourceText={...} />`: Cites verified texts from `RESOURCES.md` (e.g., Martin Kleppmann DDIA, Alex Xu).
- System architecture breakdowns and high-level trade-off analyses (prioritize latency, throughput, failure modes).
- `<CodeWindowCard title="..." code="..." />`: Technical implementation samples in **TypeScript / Node.js**.
- `<AIPitfallCallout title="...">`: Highlights common naive traps AI models produce (e.g., cache stampedes, dual writes, unindexed fan-outs).
- Optional interactive simulator (e.g. from `src/components/Simulators/`).
- Active retrieval quizzes via `<Quiz id="quiz_XXXX_N" question="..." options={[...]} />`. Quizzes must follow strict difficulty discipline (equal option lengths, non-obvious distractors).
- `<LessonNavButtons currentLessonId="XXXX" />`
- `<AgentReminder title="..." promptText="..." />`

### Registration & Verification Workflow
For every new lesson authored:
1. **Create component**: Write `src/pages/lessons/LessonXXXX.tsx`.
2. **Register in dispatcher**: In `src/pages/LessonDispatcher.tsx`, import `LessonXXXX`, update `resolveCanonicalLessonId` to recognize `'XXXX'`, and add `if (canonicalId === 'XXXX') return <LessonXXXX />;`.
3. **Register in curriculum**: Add the lesson object to `curriculum.json` in the appropriate module (`id`, `filename`, `title`, `navTitle`, `badge`, `time`, `tag`, `summary`).
4. **Sync static pages (Optional parity)**: Optionally run `python3 scripts/sync_curriculum.py` to keep legacy reference/HTML synchronized.
5. **Verify Build**: Run `npm run build` (`tsc && vite build`) to verify that the TypeScript compiler passes with 0 errors and Vite generates the PWA bundle successfully.

## Assets

Lessons are built from reusable **components**, stored in `./assets/`: stylesheets, quiz widgets, simulators, diagram helpers, and anything else a second lesson could reuse.

Reuse is the default, not the exception. Before authoring a lesson, read `./assets/` and build from the components already there. When a lesson needs something new and reusable, write it as a component in `./assets/` and link to it; never inline code a future lesson would duplicate.

A shared stylesheet is the first component every workspace earns: every lesson links it, so the lessons look like one consistent course rather than a pile of one-offs. As the workspace grows, so should the component library.

## The Mission

Every lesson should be tied into the mission - the reason that the user is interested in learning about the topic.

If the user is unclear about the mission, or the `MISSION.md` is not populated, your first job should be to question the user on why they want to learn this.

Failing to understand the mission will mean knowledge acquisition is not grounded in real-world goals. Lessons will feel too abstract. You will have no way of judging what the user should do next.

Missions may change as the user develops more skills and knowledge. This is normal - make sure to update the `MISSION.md` and add a learning record to capture the change. Confirm with the user before changing the mission.

## Zone Of Proximal Development

Each lesson, the user should always feel as if they are being challenged 'just enough'.

The user may specify an exact thing they want to learn. If they don't, figure out their zone of proximal development by:

- Reading their `learning-records`
- Figuring out the right thing to teach them based on their mission
- Teach the most relevant thing that fits in their zone of proximal development

## Knowledge

Lessons should be designed around a skill the user is going to learn. The knowledge in the lesson should be only what's required to acquire that skill. You teach the knowledge first, then get the user to practice the skills via an interactive feedback loop.

Knowledge should first be gathered from trusted resources. Use `RESOURCES.md` to keep track of them. Lessons should be littered with citations - links to external resources to back up any claim made. This increases the trustworthiness of the lesson.

For acquiring knowledge, difficulty is the enemy. It eats working memory you need for understanding.

## Skills

If knowledge is all about acquisition, skills are about durability and flexibility. Make the knowledge stick.

For skill acquisition, difficulty is the tool. Effortful retrieval is what builds storage strength. Skills should be taught through interactive lessons. There are several tools at your disposal:

- Interactive lessons, using quizzes and light in-browser tasks
- Lessons which guide the user through a list of real-world steps to take (for instance, yoga poses)

Each of these should be based on a **feedback loop**, where the user receives feedback on their performance. This feedback loop should be as tight as possible, giving feedback immediately - and ideally automatically.

For quizzes, each answer should be exactly the same number of words (and characters, if possible). Vary which position holds the correct answer across questions. Don't give the user any clues about the answer through formatting or order.

## Acquiring Wisdom

Wisdom comes from true real-world interaction - testing your skills outside the learning environment.

When the user asks a question that appears to require wisdom, your default posture should be to attempt to answer - but to ultimately delegate to a **community**.

A community is a place (online or offline) where the user can test their skills in the real world. This might be a forum, a subreddit, a real-world class (budget permitting) or a local interest group.

You should attempt to find high-reputation communities the user can join. If the user expresses a preference that they don't want to join a community, respect it.

## Reference Documents

While creating lessons, you should also create reference documents. Lessons can reference these documents - they are useful for tracking raw units of knowledge useful across lessons. Reference documents MUST strictly follow the design system defined in `DESIGN.md` and be created from `reference/TEMPLATE.html` with the shared stylesheet `assets/style.css`.

Lessons will rarely be revisited later - reference documents will be. They should be the compressed essence of the lesson, in a format designed for quick reference.

Some learning topics lend themselves to reference:

- Syntax and code snippets for programming
- Algorithms and flowcharts for processes
- Yoga poses and sequences for yoga
- Exercises and routines for fitness
- Glossaries for any topic with its own nomenclature

Glossaries, in particular, are an essential reference. Once one is created, it should be adhered to in every lesson.

## `NOTES.md`

The user will sometimes express preferences of how they want to be taught, or things you should keep in mind. This is the place to record those preferences, so you can refer back to them when designing lessons or working with the user.
