import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';

export const QueuesRef: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonBadge="Reference: Async"
            moduleBadge="Decoupling &amp; Event Streams"
            time="Asynchronous Systems"
          />
          <h1>Message Queues &amp; Event Streaming Cheat Sheet</h1>
          <p className="lead-text">
            Architectural comparison between point-to-point queues and distributed append logs, delivery semantics, consumer backpressure recipes, and failure recovery.
          </p>
        </header>

        <h2>1. Point-to-Point Queues vs. Log-Based Streams</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Point-to-Point Queue (RabbitMQ, SQS)</th>
                <th>Log-Based Stream (Kafka, Redpanda)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Primary Abstraction</strong></td>
                <td>Ephemeral task queue buffer</td>
                <td>Durable, ordered, partitioned commit log</td>
              </tr>
              <tr>
                <td><strong>Message Lifecycle</strong></td>
                <td><strong>Destructive:</strong> Deleted upon consumer <code>ACK</code></td>
                <td><strong>Immutable:</strong> Persisted for retention window; re-readable</td>
              </tr>
              <tr>
                <td><strong>Consumer Scaling</strong></td>
                <td><strong>Competing Consumers:</strong> Any idle worker picks the next message</td>
                <td><strong>Partition-bound:</strong> Max 1 active consumer per partition per group</td>
              </tr>
              <tr>
                <td><strong>Ordering Guarantees</strong></td>
                <td>Queue-level order, but broken by concurrent consumers or retries</td>
                <td>Strict total ordering guaranteed <strong>per partition key</strong></td>
              </tr>
              <tr>
                <td><strong>Backpressure Model</strong></td>
                <td>Prefetch count (<code>channel.prefetch(N)</code>) throttles broker push</td>
                <td>Pull-based polling (<code>consumer.poll()</code>); consumer regulates rate</td>
              </tr>
              <tr>
                <td><strong>Ideal Use Cases</strong></td>
                <td>Long-running jobs, background tasks, email dispatch, PDF processing</td>
                <td>Audit logs, event sourcing, telemetry, real-time analytics, event backbone</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. Delivery Semantics &amp; Consumer Idempotency</h2>
        <div className="callout callout-coral">
          <h3>The Fallacy of Exactly-Once Processing</h3>
          <p style={{ margin: 0 }}>
            If a worker completes processing a job but crashes milliseconds before transmitting its <code>ACK</code> back to the broker, the broker unreserves the message and redelivers it to a peer. Therefore: <strong>All distributed queue consumers MUST be strictly idempotent</strong>.
          </p>
        </div>

        <CodeWindowCard
          title="src/workers/idempotent-consumer.ts"
          code={`import { Redis } from 'ioredis';
import { Channel, ConsumeMessage } from 'amqplib';

const redis = new Redis(process.env.REDIS_URL!);

export async function consumePayment(channel: Channel, msg: ConsumeMessage | null) {
  if (!msg) return;
  const payload = JSON.parse(msg.content.toString());
  const dedupKey = \`processed:event:\${payload.eventId}\`;

  // Atomic Redis lock (NX = only set if Not eXists, EX = 24h expiration)
  const acquired = await redis.set(dedupKey, 'LOCKED', 'EX', 86400, 'NX');
  if (!acquired) {
    console.log(\`[Dedup] Event \${payload.eventId} already processed. Dropping duplicate.\`);
    channel.ack(msg);
    return;
  }

  try {
    await processPaymentTransaction(payload);
    channel.ack(msg);
  } catch (err) {
    // Release dedup key on failure so retries can execute
    await redis.del(dedupKey);
    channel.nack(msg, false, false); // Route to Dead-Letter Queue
  }
}`}
        />

        <h2>3. Dead-Letter Queues (DLQ) &amp; Retry Strategies</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>Exponential Backoff &amp; Jitter</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Avoid retry storms on degraded downstream databases by exponentially increasing delay: <code>delay = min(max_delay, base × 2^attempt + rand(0, 1000ms))</code>.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>Poison Pill Isolation</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              If a malformed payload crashes a worker on JSON parse, it will fail indefinitely. Route to a Dead-Letter Queue (DLQ) after 3–5 attempts to keep the pipeline moving.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '40px 0 20px' }}>
          <Link to="/reference/ref-sharding" className="btn btn-secondary">
            ← Sharding Cheat Sheet
          </Link>
          <Link to="/lessons/0006" className="btn btn-primary">
            Back to Lesson 0006 →
          </Link>
        </div>

        <AgentReminder
          title="Questions about Kafka vs RabbitMQ or SQS?"
          promptText='Ask an AI chat of your choice: "How should I structure message retries and dead-letter queues in my TypeScript backend?"'
        />
      </div>
    </div>
  );
};
