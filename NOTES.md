# Teacher Working Notes

## Learner Profile
- **Background**: Computer Science degree.
- **Current Role**: Freelance developer working on client systems and personal projects.
- **Core Dilemma**: Increasing reliance on AI coding tools has created a feeling of being an "uninformed prompter" who accepts and commits AI-generated solutions without deep conviction about trade-offs, scalability, or failure modes.
- **Primary Tech Stack**: TypeScript / Node.js.
- **Time Commitment**: ~30 minutes daily.
- **Curriculum Priority**: High-Level System Design (HLD / Distributed Systems) first, followed by Low-Level Software Design Patterns (LLD / Clean Architecture / GoF).

## Pedagogical Principles for this Learner
- **Demystify "AI blind spots"**: In each topic, highlight common traps AI tools produce (e.g., naive caching without invalidation, dual writes without outbox patterns, synchronous microservice fan-out).
- **TypeScript/Node grounding**: Express high-level system flows using Node/TypeScript idioms, asynchronous paradigms (event loops, worker threads, async I/O), and standard backend components (PostgreSQL, Redis, Kafka/RabbitMQ).
- **Desirable Difficulty & Active Retrieval**: Build bite-sized, interactive visual lessons (~15–20 min read/interaction + quiz/simulation) that fit their 30-minute daily rhythm.

## Design System & Page Generation Standard
- **Design System Reference**: Always adhere strictly to `DESIGN.md`.
- **Palette**: Tinted cream canvas (`#faf9f5`), signature warm coral primary CTA (`#cc785c`, hover `#a9583e`), dark navy product chrome (`#181715`) for code blocks/mockups/footers, light cream cards (`#efe9de`).
- **Typography**: Display sans-serif headlines (`StyreneB` / `Inter`, 600 weight) with crisp tracking. Sans for body. `JetBrains Mono` for code.
- **Components**: Pinned cream top nav with Anthropic 4-spoke radial-spike mark, primary source citations, AI pitfall callouts, code-window-cards, interactive quizzes, teacher standby reminders, and dark footer.
- **Templates**: Always generate new lessons using `lessons/TEMPLATE.html` and new reference sheets using `reference/TEMPLATE.html`. Link to the unified `assets/style.css`.

