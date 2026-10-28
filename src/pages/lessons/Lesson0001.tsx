import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { EnvelopeCalc } from '../../components/Simulators/EnvelopeCalc';

export const Lesson0001: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0001"
            lessonBadge="Lesson 0001"
            moduleBadge="Module 1: Foundations & Compute"
            time="15 mins"
            tag="Interactive Calc"
          />
          <h1>The Architect's Filter: Back-of-the-Envelope Estimation</h1>
          <p className="lead-text">
            How to stop rubber-stamping AI-generated architectures and know with mathematical certainty whether a design makes sense.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0001" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Alex Xu, <em>System Design Interview – An Insider's Guide</em>, Chapter 2: "Back-of-the-envelope Estimation" and Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 1: "Reliable, Scalable, and Maintainable Applications".
            </p>
          }
        />

        <h2>1. The Dilemma: Why AI Sounds Convincing but Proposes Overkill</h2>
        <p>
          When you ask an AI model, <em>"How should I design the backend for an e-commerce order tracker?"</em>, it will almost certainly suggest:
        </p>

        <CodeWindowCard
          title="ai-architecture-suggestion.txt"
          code="Client → API Gateway → Node.js Microservices → Apache Kafka → Redis Cache → Cassandra Cluster"
        />

        <p>
          It sounds sophisticated, modern, and impressive. But without sizing calculations, this architecture is often an operational catastrophe costing thousands of dollars a month in maintenance and cloud bills for a system handling only 5 requests a second.
        </p>
        <p>
          <strong>A Senior System Architect never evaluates an architecture based on how cool the buzzwords sound.</strong> The very first step is always: <em>What are the numbers?</em>
        </p>

        <AIPitfallCallout title="AI Pitfall: Architecture by Keyword Association">
          <p style={{ margin: 0 }}>
            LLMs are trained on millions of blog posts. Because tech giants (Uber, Netflix, LinkedIn) write 90% of the public engineering blogs, AI associates basic problems with massive hyperscale tooling (Kafka, Cassandra, Kubernetes, microservice meshes). Your job as the human architect is to apply the <strong>sizing filter</strong>.
          </p>
        </AIPitfallCallout>

        <h2>2. The Core Sizing Formula: From Users to QPS</h2>
        <p>
          To evaluate any system, you must convert human activity into computer work. Keep this mental arithmetic handy:
        </p>

        <CodeWindowCard
          title="mental-math-rules.txt"
          code={`1 Day = 86,400 seconds ≈ 100,000 seconds (for rapid mental calculation)
Average QPS = Total Daily Requests / 86,400
Peak QPS    ≈ Average QPS × 2 (to 5x depending on flash spikes)`}
        />

        <p>Let's walk through a realistic freelance client scenario:</p>
        <ul>
          <li><strong>Daily Active Users (DAU):</strong> 100,000 users.</li>
          <li><strong>User Behavior:</strong> Each user performs an average of 10 reads and 1 write per day.</li>
          <li><strong>Total Daily Requests:</strong> 1,000,000 reads and 100,000 writes.</li>
        </ul>

        <p>Now convert this to QPS (Queries Per Second):</p>
        <ul>
          <li><strong>Read QPS:</strong> <code>1,000,000 / 86,400 ≈ 11.5 QPS</code> (Peak: ~25–35 QPS).</li>
          <li><strong>Write QPS:</strong> <code>100,000 / 86,400 ≈ 1.15 QPS</code> (Peak: ~3–5 QPS).</li>
        </ul>

        <div className="callout callout-source">
          <div className="callout-title">The Architectural Revelation</div>
          <p style={{ margin: 0 }}>
            A single vanilla PostgreSQL or MySQL database on a $20/month VPS comfortably handles <strong>5,000+ writes/second and 20,000+ reads/second</strong>. 
            Proposing Kafka, distributed sharding, or NoSQL clusters for a 35 QPS system is engineering negligence. A simple monolith with a single relational database will serve this client with zero downtime and sub-millisecond response times.
          </p>
        </div>

        <h2>3. Interactive Calculator: Test Any Workload</h2>
        <p>Use this tool to calculate traffic and storage footprints before designing or prompting for architecture:</p>

        <EnvelopeCalc />

        <h2>4. Storage Footprint &amp; Memory Feasibility</h2>
        <p>
          The second question an architect asks: <em>Does the hot working set fit in memory?</em>
        </p>
        <p>
          Reading from RAM takes ~100 nanoseconds, while reading from NVMe SSD takes ~20–50 microseconds (<strong>500x slower</strong>).
        </p>
        <p>
          <strong>The 80/20 Caching Rule (Pareto Principle):</strong> In almost all real-world applications, 20% of the content generates 80% of the traffic.
          If your daily working data set is 20 GB, caching 20% requires only <strong>4 GB of RAM</strong>. A $15/month Redis instance can hold your entire hot dataset in memory!
        </p>

        <h2>5. Active Knowledge Retrieval</h2>
        <p>Test your storage strength on the concepts covered today. Click an option to see immediate feedback.</p>

        <Quiz
          id="quiz_0001_1"
          question="1. An AI tool suggests building a multi-region distributed Cassandra cluster with Kafka message streaming for a service with 50,000 daily active users, each performing 20 operations per day. What is the primary flaw in this recommendation?"
          options={[
            {
              text: 'It introduces extreme over-engineering.',
              isCorrect: true,
              explanation: 'At 50,000 users × 20 actions = 1,000,000 daily requests, the average throughput is only ~12 QPS (peak ~35 QPS). A single standard database handles this easily, making distributed clustering massive unnecessary overhead.'
            },
            {
              text: 'It triggers severe concurrency deadlocks.',
              isCorrect: false,
              explanation: 'Deadlocks occur in relational transactions with conflicting row locks, which is not the issue here. The issue is building massive distributed infrastructure for a tiny 12 QPS workload.'
            },
            {
              text: 'It violates basic network encapsulation.',
              isCorrect: false,
              explanation: 'Encapsulation is an object-oriented software design concept, not a distributed throughput issue.'
            },
            {
              text: 'It exceeds hardware memory capabilities.',
              isCorrect: false,
              explanation: 'A 50,000 user service consumes negligible RAM; the problem is operational complexity rather than hardware exhaustion.'
            }
          ]}
        />

        <Quiz
          id="quiz_0001_2"
          question="2. A Node.js backend must fetch a customer's profile, past orders, and loyalty balance. Based on the latency hierarchy, which approach minimizes the primary latency bottleneck?"
          options={[
            {
              text: 'Execute distinct sequential queries individually.',
              isCorrect: false,
              explanation: 'Executing 3 distinct round-trips multiplies network latency (~0.5ms to 2ms per round-trip) unnecessarily.'
            },
            {
              text: 'Batch related database queries together into a single round-trip.',
              isCorrect: true,
              explanation: 'Network round-trips (~0.5ms in datacenter) dominate microsecond compute times. Batching queries into one network round trip eliminates sequential network overhead.'
            },
            {
              text: 'Replicate database tables across continents.',
              isCorrect: false,
              explanation: 'Cross-continental replication adds massive latency (~100ms WAN ping) rather than solving local query latency.'
            },
            {
              text: 'Increase physical machine processor count.',
              isCorrect: false,
              explanation: 'The bottleneck is network I/O waiting time, which additional CPU cores cannot speed up.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0001" />

        <AgentReminder
          title="Your Personal Tutor is Standing By"
          promptText={`Did anything in the calculation or the latency numbers feel surprising? Ask: "Hey tutor, let's calculate capacity for my next system!"`}
        />
      </div>
    </div>
  );
};
