import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { QueueSimulator } from '../../components/Simulators/QueueSimulator';

export const Lesson0006: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0006"
            lessonBadge="Lesson 0006"
            moduleBadge="Module 3: Asynchronous Decoupling"
            time="20 mins"
            tag="Queue Simulator"
          />
          <h1>Asynchronous Processing: Message Queues, Streams &amp; Backpressure</h1>
          <p className="lead-text">
            Eliminate the synchronous microservice death spiral, buffer spiky write workloads, protect Node.js worker pools with prefetch backpressure, and engineer idempotent consumers.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0006" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em> (O'Reilly, 2017), Chapter 11: <em>Stream Processing</em> (Messaging Systems vs Databases); and <em>The Amazon Builders' Library</em>, <strong>Avoiding Insoluble Problems in Distributed Systems</strong> (Load shedding, backpressure, and decoupled work buffers).
            </p>
          }
        />

        <h2>1. The Synchronous Coupling Trap: Cascading Failures &amp; P99 Spikes</h2>
        <p>
          When developers build early microservices, they instinctively connect components using synchronous HTTP/REST or gRPC calls:
        </p>
        <div style={{ textAlign: 'center', margin: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-muted)' }}>
          User &rarr; API Gateway &rarr; Order Service &rarr; [Payment + Inventory + Email + Fraud API]
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>1. Compounding P99 Latency</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              If a request synchronously calls 4 downstream services with 99th percentile latencies of 100ms, the probability of an end-user experiencing a delay rises to 1 - (0.99)⁴ ≈ 4%. If you fan out to 20 microservices, <strong>18% of all requests hit extreme latency</strong>.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>2. Tight Availability Coupling</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              The availability of the system becomes the mathematical <em>product</em> of all dependencies: A_system = A₁ × A₂ × A₃. If the 3rd-party transactional email provider suffers an outage, checkout orders fail completely.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>3. Socket &amp; Memory Starvation</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              When a downstream service degrades and responds in 10s instead of 50ms, upstream API servers keep sockets open. Active connections pile up, exhausting socket handles until the API gateway crashes completely.
            </p>
          </div>
        </div>

        <AIPitfallCallout title='The Naive "Fire-and-Forget" In-Memory Trap'>
          <p>
            When asked to make an operation non-blocking, AI coding assistants routinely suggest wrapping asynchronous tasks in an unhandled Promise or an in-memory emitter (e.g., <code>setImmediate()</code> or <code>EventEmitter</code>).
          </p>
          <p style={{ margin: 0 }}>
            If the container scales down, crashes, or is redeployed milliseconds later, <strong>all pending in-memory jobs vanish permanently without an audit trail</strong>. Production decoupling requires a durable, persistent broker.
          </p>
        </AIPitfallCallout>

        <h2>2. Interactive Queue, Worker Saturation &amp; Backpressure Simulator</h2>
        <p>
          Observe how asynchronous queuing converts spiky, unpredictable user write traffic into a smooth, constant processing stream. Test how workers handle bursts, what happens when downstream tasks slow down, and how backpressure / prefetch protects workers:
        </p>

        <QueueSimulator />

        <h2>3. RabbitMQ (Task Queues) vs. Apache Kafka (Log Streams)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Task Queue Archetype</span>
            <h3 style={{ margin: '8px 0' }}>RabbitMQ / AWS SQS</h3>
            <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              <li><strong>Model:</strong> Smart broker, dumb consumer.</li>
              <li><strong>Destructive Read:</strong> Once a worker acknowledges with <code>ACK</code>, the message is removed.</li>
              <li><strong>Competing Consumers:</strong> Work is distributed across a dynamic worker pool.</li>
              <li><strong>Best For:</strong> Transactional background jobs (image conversion, email delivery).</li>
            </ul>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Event Stream Archetype</span>
            <h3 style={{ margin: '8px 0' }}>Apache Kafka / Redpanda</h3>
            <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              <li><strong>Model:</strong> Dumb broker, smart consumer.</li>
              <li><strong>Append-Only Log:</strong> Messages remain on disk and can be replayed by multiple consumers.</li>
              <li><strong>Offset Tracking:</strong> Consumers maintain their own offset pointer.</li>
              <li><strong>Best For:</strong> Event sourcing, audit logging, analytics pipelines, service sync.</li>
            </ul>
          </div>
        </div>

        <h2>4. Node.js Flow Control: Avoiding Heap OOM with Prefetch</h2>
        <CodeWindowCard
          title="src/workers/queue-consumer.ts"
          code={`import amqplib from 'amqplib';

async function startWorker() {
  const connection = await amqplib.connect(process.env.RABBITMQ_URL!);
  const channel = await connection.createChannel();

  const QUEUE_NAME = 'tasks.transcode';
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // CRITICAL: Set Prefetch limit to enforce consumer backpressure!
  // Without this, RabbitMQ delivers all 10,000 messages instantly into RAM.
  const MAX_CONCURRENT_JOBS = 10;
  channel.prefetch(MAX_CONCURRENT_JOBS);

  console.log(\`[*] Worker listening with prefetch=\${MAX_CONCURRENT_JOBS}\`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;
    const task = JSON.parse(msg.content.toString());

    try {
      await processVideoTranscode(task);
      // Explicit ACK releases 1 slot in the prefetch window
      channel.ack(msg);
    } catch (err) {
      console.error(\`[!] Error processing job \${task.id}:\`, err);
      // Reject and route to DLQ (requeue: false)
      channel.nack(msg, false, false);
    }
  }, { noAck: false });
}`}
        />

        <h2>5. Idempotent Consumer Design: Surviving Network Retries</h2>
        <div className="callout callout-coral">
          <div className="callout-title">The Cardinal Rule of Distributed Queues</div>
          <p style={{ margin: 0 }}>
            You cannot prevent duplicate delivery across an unreliable network. You can only make duplicate processing safe through <strong>idempotent consumer handlers</strong> (using atomic deduplication keys or DB unique constraints).
          </p>
        </div>

        <h2>6. Active Retrieval: Test Your Understanding</h2>
        <Quiz
          id="quiz_0006_1"
          question="1. An e-commerce checkout service synchronously calls Payment, Inventory, and an external Delivery Courier API. During a flash sale, Courier API latency increases from 50ms to 4,000ms. What immediate architectural breakdown occurs?"
          options={[
            {
              text: 'Upstream checkout server connections saturate and cause system collapse.',
              isCorrect: true,
              explanation: 'Synchronous coupling means upstream sockets are held open for 4 seconds waiting on the Courier API. Inbound requests pile up, exhausting the connection pool and crashing checkout.'
            },
            {
              text: 'Database replicas drop their connections due to replication lag.',
              isCorrect: false,
              explanation: 'An external HTTP service timeout does not alter database replication streams.'
            },
            {
              text: 'Consistent hashing ring remaps all user sessions to a dead partition.',
              isCorrect: false,
              explanation: 'Consistent hashing is a partitioning scheme; downstream HTTP latency does not trigger node remapping.'
            },
            {
              text: 'Cache stampede invalidates Redis and wipes out primary storage.',
              isCorrect: false,
              explanation: 'Cache stampedes occur when a heavily requested cache key expires simultaneously.'
            }
          ]}
        />

        <Quiz
          id="quiz_0006_2"
          question="2. Why must a Node.js AMQP/RabbitMQ queue consumer explicitly define a prefetch count (e.g., channel.prefetch(10))?"
          options={[
            {
              text: 'To allow RabbitMQ to round-robin partition hashes across clusters.',
              isCorrect: false,
              explanation: 'RabbitMQ queues do not use round-robin partition hashing.'
            },
            {
              text: 'To enforce synchronous write-through caching on the primary store.',
              isCorrect: false,
              explanation: 'Prefetch is a broker-to-consumer flow control mechanism.'
            },
            {
              text: 'To prevent the broker from flooding Node heap memory with tasks.',
              isCorrect: true,
              explanation: 'By default, RabbitMQ pushes all available messages down the TCP socket. Without prefetch, thousands of in-flight promises buffer in V8 heap memory until OOM crash.'
            },
            {
              text: 'To guarantee zero message loss when the broker suffers split-brain.',
              isCorrect: false,
              explanation: 'Broker split-brain is solved by clustering consensus (Quorum Queues / Raft).'
            }
          ]}
        />

        <Quiz
          id="quiz_0006_3"
          question="3. When would an architect select Apache Kafka over RabbitMQ?"
          options={[
            {
              text: 'When tasks require complex broker routing and instant deletion on ACK.',
              isCorrect: false,
              explanation: 'RabbitMQ excels at complex broker-side exchange routing and instant deletion.'
            },
            {
              text: 'When multiple consumers need to read and replay the same event stream.',
              isCorrect: true,
              explanation: 'Kafka is an immutable append-only commit log where events are retained on disk and independent microservices can replay and read the exact same event stream at their own pace.'
            },
            {
              text: 'When workers require point-to-point work queues with instant rollback.',
              isCorrect: false,
              explanation: 'RabbitMQ and SQS are standard point-to-point work queues.'
            },
            {
              text: 'When the application requires single-node in-memory priority queuing.',
              isCorrect: false,
              explanation: 'Kafka is a distributed clustered streaming engine.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0006" />

        <AgentReminder
          title="Ready to Discuss Real-World Scenarios?"
          promptText='Ask an AI chat of your choice: "How do we handle the Transactional Outbox pattern when writing to Postgres and publishing to Kafka simultaneously?"'
        />
      </div>
    </div>
  );
};
