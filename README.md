# Teach Me: System Design & Distributed Architecture

> An interactive, pedagogical Progressive Web App (PWA) designed to transform engineers into authoritative technical architects who rigorously evaluate trade-offs, anticipate failure modes, size capacity from first principles, and dictate sound distributed architectures.

[![Live Application](https://img.shields.io/badge/Live%20Demo-system--design--course--one.vercel.app-cc785c?style=for-the-badge&logo=vercel)](https://system-design-course-one.vercel.app/)
[![React 18](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-success?style=flat-square)](https://vite-pwa-org.netlify.app/)

---

> [!NOTE]
> **Disclaimer & Attribution**: All content, curriculum, interactive simulations, and lessons in this course were generated using **[Matt Pocock's `teach` skill](https://www.aihero.dev/skills-teach)** and **Gemini 3.8 Flash** using **Antigravity 2.0**.

## 🌐 Live URL

The application is deployed and available at:

👉 **[https://system-design-course-one.vercel.app/](https://system-design-course-one.vercel.app/)**

---

## 🧭 Why This Exists

In an era of ubiquitous AI code generators, passive prompt-committing creates fragile, unscalable systems riddled with subtle distributed system traps—such as dual-write inconsistencies, cache stampedes, unindexed fan-outs, and unhandled replication lag.

**Teach Me: System Design** bridges high-level distributed systems down to low-level modular software design in TypeScript and Node.js. It focuses on:
- **First-Principles Estimation**: Converting product scale into exact QPS, I/O bandwidth, and memory sizing before committing code.
- **Concrete Failure Modes**: Identifying split-brain conditions, cascade failures, thundering herds, and network partitions.
- **Interactive Retrieval Practice**: Visual architecture simulators, capacity calculators, and end-of-module practical design reviews.

---

## ✨ Features

- **🧮 Interactive Architectural Calculators**: Perform back-of-the-envelope estimation for DAU, peak QPS, storage bandwidth, and cluster memory sizing with immediate feedback.
- **🧪 Visual Architecture Simulators**:
  - Load balancer traffic distribution & sticky sessions.
  - Consistent hashing rings with virtual node redistribution.
  - Cache stampede prevention (Probabilistic Early Expiration / XFetch vs Mutex Locking).
  - Transactional Outbox CDC vs Dual-Write race conditions.
  - Saga orchestration vs choreography compensating workflows.
- **🎯 Milestone Practical Challenges**:
  - High-stakes real-world production scenarios (flash sales, high-QPS ingestion gateways, financial ledgers).
  - Integrated solution workspace with auto-save to `localStorage`.
  - Senior Architect AI review prompt generators with one-click copy.
- **📚 Architectural Quick Reference Sheets**:
  - *Numbers Every Engineer Should Know* (L1 cache to cross-datacenter round trips).
  - *Load Balancing Patterns* (L4 vs L7, Layered Ingress).
  - *Caching Strategies* (Write-through, Cache-aside, Refresh-ahead).
  - *Database Replication & Failover* (Synchronous vs Asynchronous, Consensus).
  - *Database Sharding & Consistent Hashing*.
  - *Message Queues & Streaming Decoupling* (Kafka vs RabbitMQ, Backpressure).
- **🎨 Warm Editorial Design System**: Styled according to a clean editorial aesthetic with a cream canvas (`#faf9f5`), product-chrome code windows (`#181715`), and signature warm coral accents (`#cc785c`).
- **📱 Progressive Web App (PWA)**: Installable on desktop and mobile with offline caching and instant state persistence.

---

## 📖 Curriculum Structure

### Module 1: Distributed Foundations & Compute Scaling
- **Lesson 0001: The Architect's Filter: Back-of-the-Envelope Estimation**
  *QPS math, peak multiplier modeling, RAM vs Disk capacity, and latency hierarchies.*
- **Lesson 0002: Scaling the Compute Layer: Horizontal Scaling & Statelessness**
  *Node.js event-loop bottlenecks, externalizing state to Redis, sticky session traps, and connection pooling.*
- **🏆 Milestone 1 Practical Test**: Tier-1 Ingestion Gateway & Peak Capacity Sizing (12M DAU Flash Sale).

### Module 2: Distributed State, Caching & Persistence
- **Lesson 0003: Caching Strategies & Distributed Invalidation**
  *Cache-aside, write-through, write-behind, dogpiling/stampede mitigation, and TTL jitter.*
- **Lesson 0004: Scaling the Database: Replication, Read Replicas & Failover**
  *Async vs semi-sync replication, replication lag anomalies (read-your-own-writes), and split-brain recovery.*
- **Lesson 0005: Database Partitioning, Sharding & Consistent Hashing**
  *Range vs hash partitioning, cross-shard fan-out overhead, and virtual node consistent hashing.*
- **🏆 Milestone 2 Practical Test**: High-Throughput E-Commerce Inventory & Order State Store.

### Module 3: Asynchronous Decoupling & Event Streams
- **Lesson 0006: Asynchronous Processing: Message Queues, Streams & Backpressure**
  *Point-to-point queues vs event log streams (RabbitMQ vs Kafka), consumer group lag, and backpressure.*
- **Lesson 0007: Reliable Event Publishing: The Dual-Write Problem & Transactional Outbox**
  *Atomicity across DB and message brokers, Transactional Outbox pattern, CDC (Debezium), and idempotent consumers.*
- **Lesson 0008: Distributed Transactions: The Saga Pattern & Compensating Workflows**
  *Choreography vs Orchestration, semantic rollbacks, compensating actions, and forward-recovery.*
- **🏆 Milestone 3 Practical Test**: Resilient Global Payment & Order Fulfillment Pipeline.

---

## 🛠️ Tech Stack

- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 5](https://vitejs.dev/)
- **Routing**: [React Router DOM v6](https://reactrouter.com/)
- **PWA**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) + [Workbox](https://developer.chrome.com/docs/workbox)
- **Syntax Highlighting**: [PrismJS](https://prismjs.com/)
- **Typography**: Inter & JetBrains Mono

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm (or yarn / pnpm)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/teach-me-system-design.git
cd "Teach Me/System Design"

# Install dependencies
npm install
```

### Development Server

Start the local Vite development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

Type-check and compile the production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## 📚 Key References & Primary Sources

- **Designing Data-Intensive Applications** — Martin Kleppmann (O'Reilly)
- **System Design Interview (Volumes 1 & 2)** — Alex Xu & Sahn Lam (ByteByteGo)
- **AWS Architecture Center & Builders' Library** — Amazon Web Services
- **Site Reliability Engineering (SRE) Book** — Google
- **Enterprise Integration Patterns** — Gregor Hohpe & Bobby Woolf

---

## 🤖 Disclaimer & Attribution

All content, curriculum structure, architectural deep dives, interactive simulators, code implementations, and quizzes across this project were generated using:
- **[Matt Pocock's `teach` skill](https://www.aihero.dev/skills-teach)**
- **Gemini 3.8 Flash**
- Powered by **Antigravity 2.0**

---

## 📄 License

MIT
