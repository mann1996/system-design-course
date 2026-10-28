import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { OutboxSimulator } from '../../components/Simulators/OutboxSimulator';

export const Lesson0007: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0007"
            lessonBadge="Lesson 0007"
            moduleBadge="Module 3: Asynchronous Decoupling"
            time="20 mins"
            tag="Outbox Simulator"
          />
          <h1>Reliable Event Publishing: The Dual-Write Problem &amp; Transactional Outbox</h1>
          <p className="lead-text">
            Eliminate silent distributed data loss, understand why naive dual-writes fail across network boundaries, and implement the Transactional Outbox pattern with Change Data Capture (CDC) in TypeScript and PostgreSQL.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0007" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em> (O'Reilly, 2017), Chapter 11: <em>Stream Processing</em> (&ldquo;Keeping Systems in Sync&rdquo; and Dual Writes); Chris Richardson, <em>Microservices Patterns</em> (Manning, 2018), Chapter 3: &ldquo;Transactional Messaging: The Transactional Outbox Pattern&rdquo;; and Debezium Documentation on <em>Change Data Capture (CDC) Architecture</em>.
            </p>
          }
        />

        <h2>1. The Dual-Write Dilemma: Why Dispersed Writes Always Corrupt State</h2>
        <p>
          In <Link to="/lessons/0006">Lesson 0006</Link>, we established that decoupled asynchronous messaging (via RabbitMQ or Apache Kafka) protects systems against cascading failures and absorbs spiky traffic.
        </p>
        <p>
          However, modern applications almost never produce messages in isolation. When a user checks out an order, a service must perform two actions:
        </p>
        <ol style={{ paddingLeft: '24px', lineHeight: 1.7 }}>
          <li>
            <strong>Mutate Local Persistence:</strong> Insert the new order into a relational database (e.g., PostgreSQL: <code>INSERT INTO orders...</code>).
          </li>
          <li>
            <strong>Publish a Domain Event:</strong> Broadcast an event to an external message broker (e.g., Kafka: <code>orders.created</code>) so that Inventory, Billing, and Shipping services can fulfill it.
          </li>
        </ol>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Anti-Pattern A</span>
            <h4 style={{ margin: '8px 0' }}>Write to DB First, Then Publish</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              If your database write commits, but the Node.js process crashes, encounters an OOM, or the message broker times out before the network publish finishes, <strong>the event is lost permanently</strong>. The order is stored in PostgreSQL, but inventory is never deducted and the customer never receives goods.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Anti-Pattern B</span>
            <h4 style={{ margin: '8px 0' }}>Publish First, Then Write to DB</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              If the event publishes to Kafka successfully, but the database transaction subsequently fails (due to a unique constraint violation, foreign key failure, or network timeout on commit), <strong>downstream services react to phantom events</strong>. You charge customers and pack items for an order that does not exist in your database.
            </p>
          </div>
        </div>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Just Wrap It in try / catch"'>
          <p>
            When asked to synchronize a database insert and a Kafka event, AI tools frequently emit code like this:
          </p>
          <pre style={{ background: 'var(--color-surface-dark)', color: 'var(--color-on-dark)', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto' }}>
{`// DANGEROUS AI CODE TEMPLATE
await db.orders.create({ data: orderData });
try {
  await kafkaProducer.send({ topic: 'orders', messages: [...] });
} catch (err) {
  logger.error("Failed to publish, please retry", err);
  // Silent state divergence! Order exists in DB, Kafka has nothing.
}`}
          </pre>
          <p style={{ margin: '8px 0 0' }}>
            Network errors are unavoidable in distributed systems. If your node crashes or power fails between line 1 and line 3, no <code>catch</code> block will ever run. Distributed atomic commits across heterogeneous engines cannot be achieved with in-memory application logic.
          </p>
        </AIPitfallCallout>

        <h2>2. Interactive Dual-Write vs. Transactional Outbox Simulator</h2>
        <p>
          Test how network partitions corrupt distributed state during naive dual-writes, and verify how the Transactional Outbox pattern guarantees message preservation even when the broker crashes:
        </p>

        <OutboxSimulator />

        <h2>3. The Solution: The Transactional Outbox Pattern</h2>
        <p>
          Instead of attempting a distributed transaction across two disparate network systems (which violates availability and scale), we leverage the <strong>local ACID guarantees of our primary database</strong>.
        </p>
        <p>
          We store both the business entity (e.g., <code>orders</code>) and the pending event (in an <code>outbox_events</code> table) within the <strong>exact same local SQL transaction</strong>. Either both records commit atomically to disk, or both rollback completely:
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Architectural Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>id</code></td>
                <td><code>UUID PRIMARY KEY</code></td>
                <td>Unique idempotency key used by consumers to deduplicate messages.</td>
              </tr>
              <tr>
                <td><code>aggregate_type</code></td>
                <td><code>VARCHAR(64)</code></td>
                <td>Domain entity boundary (e.g. <code>Order</code>, <code>Payment</code>).</td>
              </tr>
              <tr>
                <td><code>aggregate_id</code></td>
                <td><code>VARCHAR(64)</code></td>
                <td>Partition key used for ordering in Kafka partitions.</td>
              </tr>
              <tr>
                <td><code>event_type</code></td>
                <td><code>VARCHAR(64)</code></td>
                <td>Domain event name (e.g. <code>OrderCreated</code>, <code>OrderCancelled</code>).</td>
              </tr>
              <tr>
                <td><code>payload</code></td>
                <td><code>JSONB NOT NULL</code></td>
                <td>Full JSON event schema capturing the state change snapshot.</td>
              </tr>
              <tr>
                <td><code>status</code></td>
                <td><code>VARCHAR(16)</code></td>
                <td><code>PENDING</code>, <code>PUBLISHED</code>, or <code>FAILED</code> for relay tracking.</td>
              </tr>
              <tr>
                <td><code>created_at</code></td>
                <td><code>TIMESTAMPTZ</code></td>
                <td>Audit timestamp and index key for poller ordering.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>4. Dispatching Events: Polling Publisher vs. Transaction Log Tailing (CDC)</h2>
        <p>
          Once events are reliably committed into the <code>outbox_events</code> table, how do they get delivered to Kafka or RabbitMQ? There are two primary architectural patterns:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Pattern 1: Polling Publisher</span>
            <h4 style={{ margin: '8px 0' }}>SELECT ... FOR UPDATE SKIP LOCKED</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              A background worker periodically polls the outbox table for rows with <code>status = 'PENDING'</code>. Using <code>FOR UPDATE SKIP LOCKED</code>, multiple concurrent Node.js relay workers can claim separate batches without locking each other out.
            </p>
            <ul style={{ fontSize: '13px', margin: '8px 0 0', paddingLeft: '18px', color: 'var(--color-muted)' }}>
              <li><strong>Pros:</strong> Simple to implement; zero additional external infrastructure needed.</li>
              <li><strong>Cons:</strong> Polling introduces query overhead on the database and latency (~500ms).</li>
            </ul>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Pattern 2: Transaction Log Tailing</span>
            <h4 style={{ margin: '8px 0' }}>Change Data Capture (CDC / Debezium)</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              A CDC engine (e.g., Debezium) reads the database's internal write-ahead log (WAL in PostgreSQL or binlog in MySQL) directly at the storage engine level. As commits hit disk, Debezium streams them immediately into Kafka.
            </p>
            <ul style={{ fontSize: '13px', margin: '8px 0 0', paddingLeft: '18px', color: 'var(--color-muted)' }}>
              <li><strong>Pros:</strong> Zero SQL polling overhead; sub-millisecond event propagation.</li>
              <li><strong>Cons:</strong> Requires running Kafka Connect and managing WAL retention configurations.</li>
            </ul>
          </div>
        </div>

        <h2>5. TypeScript Implementation: Atomic Outbox Transaction</h2>
        <p>
          Here is how to write the business write and outbox event inside a single ACID PostgreSQL transaction in Node.js:
        </p>

        <CodeWindowCard
          title="src/services/order-service.ts"
          code={`import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';

interface CreateOrderInput {
  customerId: string;
  amount: number;
  items: Array<{ sku: string; quantity: number }>;
}

export class OrderService {
  constructor(private readonly dbPool: Pool) {}

  public async createOrder(input: CreateOrderInput): Promise<string> {
    const client: PoolClient = await this.dbPool.connect();
    const orderId = randomUUID();
    const eventId = randomUUID();

    try {
      // 1. Begin local SQL transaction
      await client.query('BEGIN');

      // 2. Insert core business entity
      await client.query(
        \`INSERT INTO orders (id, customer_id, total_amount, status, created_at)
         VALUES ($1, $2, $3, 'PENDING', NOW())\`,
        [orderId, input.customerId, input.amount]
      );

      // 3. Atomically insert pending event into outbox_events in the SAME transaction
      const eventPayload = {
        orderId,
        customerId: input.customerId,
        amount: input.amount,
        items: input.items,
        timestamp: new Date().toISOString()
      };

      await client.query(
        \`INSERT INTO outbox_events 
         (id, aggregate_type, aggregate_id, event_type, payload, status, created_at)
         VALUES ($1, 'Order', $2, 'OrderCreated', $3, 'PENDING', NOW())\`,
        [eventId, orderId, JSON.stringify(eventPayload)]
      );

      // 4. Commit local transaction: BOTH are guaranteed on disk together
      await client.query('COMMIT');
      return orderId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(\`Failed to create order transactionally: \${(error as Error).message}\`);
    } finally {
      client.release();
    }
  }
}`}
        />

        <h2>6. Polling Relay Worker with SKIP LOCKED</h2>
        <p>
          If using the polling publisher approach, avoid the naive mistake of plain <code>SELECT ... LIMIT 50</code>, which causes race conditions when multiple workers run in parallel:
        </p>

        <CodeWindowCard
          title="src/workers/outbox-relay.ts"
          code={`import { Pool } from 'pg';
import { Producer } from 'kafkajs';

export async function processOutboxBatch(db: Pool, kafkaProducer: Producer) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // CRITICAL: FOR UPDATE SKIP LOCKED ensures horizontal worker concurrency
    // without lock contention or duplicate worker claims!
    const query = \`
      SELECT id, aggregate_id, event_type, payload
      FROM outbox_events
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED;
    \`;

    const { rows } = await client.query(query);

    if (rows.length === 0) {
      await client.query('COMMIT');
      return;
    }

    // Publish claimed events to Apache Kafka
    for (const event of rows) {
      await kafkaProducer.send({
        topic: 'orders.events',
        messages: [{
          key: event.aggregate_id, // Preserves partition ordering in Kafka!
          value: JSON.stringify(event.payload),
          headers: {
            eventId: event.id,
            eventType: event.event_type
          }
        }]
      });

      // Mark as published in outbox
      await client.query(
        \`UPDATE outbox_events SET status = 'PUBLISHED', processed_at = NOW() WHERE id = $1\`,
        [event.id]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Outbox relay cycle failed, will retry next tick:', err);
  } finally {
    client.release();
  }
}`}
        />

        <h2>7. Active Retrieval: Test Your Understanding</h2>

        <Quiz
          id="quiz_0007_1"
          question="1. Why does wrapping a PostgreSQL write and a Kafka publish in a Node.js try/catch block fail to guarantee data consistency?"
          options={[
            {
              text: 'Because PostgreSQL locks abort when TCP sockets emit timeout errors.',
              isCorrect: false,
              explanation: 'PostgreSQL transactions commit or abort independently of subsequent external TCP socket activity.'
            },
            {
              text: 'Because process crashes after the commit prevent Kafka event emission.',
              isCorrect: true,
              explanation: 'If the Node.js process crashes or reboots right after the SQL commit succeeds, the subsequent Kafka network request is never made, leaving permanent silent data divergence.'
            },
            {
              text: 'Because Kafka topics reject records produced inside relational database transactions.',
              isCorrect: false,
              explanation: 'Kafka does not inspect where application records were generated.'
            },
            {
              text: 'Because Node event loops automatically rollback SQL commits upon network delays.',
              isCorrect: false,
              explanation: 'Once a database commit acknowledges, the event loop has zero power to rollback persisted database data.'
            }
          ]}
        />

        <Quiz
          id="quiz_0007_2"
          question="2. In the Transactional Outbox pattern, what fundamental property guarantees that an event is never lost?"
          options={[
            {
              text: 'The event row is committed within the local business transaction.',
              isCorrect: true,
              explanation: 'Because the outbox event and the domain record are written in the exact same local ACID transaction, the event is permanently written to WAL and disk if and only if the business record succeeds.'
            },
            {
              text: 'The message broker confirms receipt before the SQL commit executes.',
              isCorrect: false,
              explanation: 'Waiting on the message broker before the SQL commit is the anti-pattern that creates phantom events if the commit fails.'
            },
            {
              text: 'The database engine automatically opens an XA connection to Kafka.',
              isCorrect: false,
              explanation: 'Standard message brokers like Kafka do not support distributed XA two-phase commit transactions with SQL engines.'
            },
            {
              text: 'The operating system syncs memory pages directly to disk sectors.',
              isCorrect: false,
              explanation: 'OS page sync handles hardware persistence, but does not solve distributed multi-system coordination.'
            }
          ]}
        />

        <Quiz
          id="quiz_0007_3"
          question="3. When implementing an asynchronous Outbox polling publisher in PostgreSQL, why is SELECT ... FOR UPDATE SKIP LOCKED essential?"
          options={[
            {
              text: 'It prevents the database engine from creating write-ahead logs during replication.',
              isCorrect: false,
              explanation: 'SKIP LOCKED has no effect on database write-ahead log generation.'
            },
            {
              text: 'It automatically transforms relational database tables into partitioned Apache Kafka streams.',
              isCorrect: false,
              explanation: 'SKIP LOCKED is a row-level SQL locking directive, not an ETL or streaming protocol.'
            },
            {
              text: 'It allows multiple concurrent workers to claim distinct rows without contention.',
              isCorrect: true,
              explanation: 'FOR UPDATE SKIP LOCKED locks matched rows and allows parallel workers to immediately skip already-locked rows and claim the next available batch without blocking or processing duplicates.'
            },
            {
              text: 'It enforces strict two-phase locking protocols across external microservice network boundaries.',
              isCorrect: false,
              explanation: 'Row locking is entirely local to the database instance; it does not extend across external microservice networks.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0007" />

        <AgentReminder
          title="Ready to Scale to Multi-Service Workflows?"
          promptText='Ask an AI chat of your choice: "Now that we publish events reliably with the Outbox pattern, how do we coordinate transactions across 4 independent microservices using Distributed Sagas?"'
        />
      </div>
    </div>
  );
};