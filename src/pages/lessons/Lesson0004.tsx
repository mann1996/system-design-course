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
import { ReplicationSimulator } from '../../components/Simulators/ReplicationSimulator';

export const Lesson0004: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0004"
            lessonBadge="Lesson 0004"
            moduleBadge="Module 2: Distributed State & Data"
            time="20 mins"
            tag="Interactive Sim"
          />
          <h1>Scaling the Database: Replication, Read Replicas &amp; Failover</h1>
          <p className="lead-text">
            When your application outgrows a single database instance, you cannot simply add more servers the way you do with stateless Node.js workers. Discover how primary-replica topologies scale read throughput, why replication lag causes subtle distributed bugs, and how to safely navigate split-brain failover.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0004" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em> (O'Reilly, 2017), Chapter 5: <em>Replication</em> (Leaders and Followers, Synchronous vs. Asynchronous Replication, Problems with Replication Lag, and Failover).
            </p>
          }
        />

        <h2>1. Why Database Scaling is Unforgiving</h2>
        <p>
          In <Link to="/lessons/0002">Lesson 0002</Link>, we scaled stateless Node.js application servers behind a load balancer with zero shared state. In <Link to="/lessons/0003">Lesson 0003</Link>, we shielded our database from massive read volume with Redis.
        </p>
        <p>
          However, caches are ephemeral. Every cache miss, every transactional update, and every analytical aggregation eventually lands on your persistent storage engine (e.g., PostgreSQL or MySQL).
        </p>
        <p>
          While stateless application servers scale horizontally by merely spinning up new containers, persistent databases hold <strong>state</strong> on disk. If two nodes independently accept writes without coordination, their disks diverge, causing irrecoverable data corruption. 
        </p>
        <p>
          To scale persistent storage without sharding, the industry-standard architecture is <strong>Single-Leader (Primary-Replica) Replication</strong>.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ marginTop: 0, fontSize: '17px' }}>The Primary Node (Leader / Master)</h3>
            <p style={{ fontSize: '14px' }}>
              Accepts <strong>all write operations</strong> (<code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>). Appends changes to its persistent write-ahead log (WAL) and streams these mutation events to follower nodes.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-primary)', margin: 0, fontWeight: 500 }}>
              Bottleneck: Exactly 1 node can accept writes. Write throughput is limited by that single node's I/O and CPU.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ marginTop: 0, fontSize: '17px' }}>Read Replicas (Followers / Standbys)</h3>
            <p style={{ fontSize: '14px' }}>
              Replay the primary's stream of changes in the exact same order on their local disks. Serve <strong>read-only queries</strong> (<code>SELECT</code>) to clients.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-accent-teal)', margin: 0, fontWeight: 500 }}>
              Throughput: Horizontally scalable for reads! 5 replicas can absorb 5x read traffic (e.g., 20,000 read QPS).
            </p>
          </div>
        </div>

        <h2>2. Synchronous vs. Asynchronous Replication: The Trade-off</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Replication Mode</th>
                <th>How It Works</th>
                <th>Write Latency</th>
                <th>Durability on Crash</th>
                <th>Availability Trade-Off</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Synchronous</strong></td>
                <td>Primary waits for replica to confirm disk write before returning success to client.</td>
                <td>High (Network RTT + Replica disk write).</td>
                <td><strong>Zero data loss</strong> (RPO = 0). Replica is always identical.</td>
                <td>If replica hangs or partitions, <strong>writes are completely blocked</strong>!</td>
              </tr>
              <tr>
                <td><strong>Asynchronous</strong> (Default)</td>
                <td>Primary confirms write immediately after writing locally; streams log to replicas in background.</td>
                <td>Ultra-low (Only primary local disk write).</td>
                <td><strong>Small data loss possible</strong> if primary dies before streaming uncommitted log.</td>
                <td>Primary continues writing even if replicas die or lag.</td>
              </tr>
              <tr>
                <td><strong>Semi-Synchronous</strong></td>
                <td>Primary waits for at least <em>one</em> synchronous replica to acknowledge, while others replicate async.</td>
                <td>Balanced (1 network hop to nearest replica).</td>
                <td>Guaranteed replica failover target exists without blocking on slow stragglers.</td>
                <td>Standard high-availability setup in AWS Aurora and Google Cloud Spanner.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>3. Interactive Simulator: Replication Lag &amp; Anomalies</h2>
        <p>
          In asynchronous replication, replicas lag behind the primary by milliseconds (or seconds under heavy load). This creates the notorious distributed system problem: <strong>Eventual Consistency</strong>.
        </p>

        <ReplicationSimulator />

        <h2>4. Three Classic Replication Lag Traps</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--color-ink)' }}>1. Reading Your Own Writes</h4>
            <p style={{ fontSize: '14px', color: 'var(--color-body)' }}>
              A user edits their profile, clicks "Save", page reloads, and they still see their old name. The write went to the primary, but their browser's GET request hit a lagged replica!
            </p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)', margin: 0 }}>
              Fix: Read from primary for ~1 minute after write, or pin user to primary for their own profile.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--color-ink)' }}>2. Monotonic Reads (Time Travel)</h4>
            <p style={{ fontSize: '14px', color: 'var(--color-body)' }}>
              A user refreshes page: Request 1 hits an updated replica (sees new comment). Request 2 hits a lagged replica (comment disappears!). The user experiences time moving backwards.
            </p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)', margin: 0 }}>
              Fix: Route user's reads to the same replica using consistent hashing on <code>userId</code>.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--color-ink)' }}>3. Consistent Prefix Reads</h4>
            <p style={{ fontSize: '14px', color: 'var(--color-body)' }}>
              In sharded or partitioned databases, if causal events replicate out-of-sequence, an observer might see an answer before seeing the question it replied to.
            </p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)', margin: 0 }}>
              Fix: Ensure causally dependent writes share the same partition and replication stream.
            </p>
          </div>
        </div>

        <h2>5. Implementing Read-Write Splitting in TypeScript / Node.js</h2>
        <CodeWindowCard
          title="src/database/cluster-connection-pool.ts"
          code={`import { Pool, QueryResult, QueryResultRow } from 'pg';

export class DatabaseClusterManager {
  private primaryPool: Pool;
  private replicaPools: Pool[];
  private roundRobinIndex = 0;

  constructor() {
    // 1. Single Primary for write mutations & critical read-your-own-writes
    this.primaryPool = new Pool({
      connectionString: process.env.DATABASE_PRIMARY_URL, // :5432
      max: 20, // Bound connection limits to avoid DB exhaustion
    });

    // 2. Array of Read Replicas for scalable SELECT traffic
    const replicaUrls = (process.env.DATABASE_REPLICA_URLS || '').split(',');
    this.replicaPools = replicaUrls.map(url => new Pool({ connectionString: url, max: 30 }));
  }

  async write<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.primaryPool.query<T>(sql, params);
  }

  async read<T extends QueryResultRow>(
    sql: string, 
    params: unknown[] = [], 
    options: { forcePrimary?: boolean } = {}
  ): Promise<QueryResult<T>> {
    // If caller recently performed a write, read from Primary to eliminate replication lag!
    if (options.forcePrimary || this.replicaPools.length === 0) {
      return this.primaryPool.query<T>(sql, params);
    }

    const pool = this.replicaPools[this.roundRobinIndex % this.replicaPools.length];
    this.roundRobinIndex++;

    try {
      return await pool.query<T>(sql, params);
    } catch (err) {
      console.warn('[DB Cluster] Replica query failed, falling back to primary:', err);
      return this.primaryPool.query<T>(sql, params);
    }
  }
}`}
        />

        <AIPitfallCallout title='AI Architectural Pitfall: "Just put HAProxy in front of replicas with round-robin"'>
          <p>
            AI assistants frequently generate database connection code using a generic pool against an ALB DNS name. This causes two severe production disasters:
          </p>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li>
              <strong>Read-After-Write Failure:</strong> A user creates a team or updates a payment method and is immediately redirected to <code>/dashboard</code>. The read hits a replica lagging by 300ms, returns a 404, and the user screams that their payment vanished.
            </li>
            <li>
              <strong>Connection Exhaustion:</strong> 20 stateless Node.js containers with a pool size of 20 each will open 400 connections per database node. Unlike HTTP servers, PostgreSQL forks a distinct OS process per client connection (~10MB RAM each). Without an intermediate connection pooler like <strong>PgBouncer</strong> or <strong>AWS RDS Proxy</strong>, the database crashes with <code>sorry, too many clients already</code>.
            </li>
          </ol>
        </AIPitfallCallout>

        <h2>6. Failover and the Split-Brain Disaster</h2>
        <p>
          What happens when the primary node crashes or becomes partitioned by a network outage?
        </p>
        <p>
          If the old primary was not actually dead (just a temporary network blip), both nodes now believe they are the write master! Both accept conflicting writes. To prevent split-brain, production clusters use <strong>Fencing Tokens</strong> or <strong>STONITH ("Shoot The Other Node In The Head")</strong> to forcibly power off or isolate the old primary before promoting a replacement.
        </p>

        <h2>7. Active Retrieval: Test Your Understanding</h2>
        <Quiz
          id="quiz_0004_1"
          question="1. Your e-commerce checkout flow updates inventory on the primary database, then immediately redirects the user to the order confirmation page. Why does the user occasionally see 'Order Not Found'?"
          options={[
            {
              text: 'A cache stampede caused the order records to be evicted from Redis.',
              isCorrect: false,
              explanation: 'Cache stampede occurs when cached keys expire simultaneously under load, not during DB reads.'
            },
            {
              text: 'The read request was routed to a read replica experiencing replication lag.',
              isCorrect: true,
              explanation: 'In asynchronous replication, the confirmation read hits a replica before the primary\'s WAL is received and replayed.'
            },
            {
              text: 'The database connection pool was exhausted, returning an empty query result.',
              isCorrect: false,
              explanation: 'Database connection pool exhaustion causes HTTP 500 errors or connection timeouts, not 404s.'
            },
            {
              text: 'The replica read was executed in Read Uncommitted isolation level mode.',
              isCorrect: false,
              explanation: 'Read replicas replay exact transactional commits in order; dirty reads are prevented by MVCC.'
            }
          ]}
        />

        <Quiz
          id="quiz_0004_2"
          question="2. In a single-leader replication topology, why can you NOT simply scale write throughput by adding 10 read replicas?"
          options={[
            {
              text: 'Because read replicas consume too much CPU executing background vacuum tasks.',
              isCorrect: false,
              explanation: 'Read replicas decrease read load on the primary, but they have no effect on write capacity.'
            },
            {
              text: 'All writes must still go through the single primary, which must replicate to more followers.',
              isCorrect: true,
              explanation: 'In single-leader replication, only 1 node accepts writes. All replicas must process those same writes, adding network fan-out overhead.'
            },
            {
              text: 'Because read replicas reject connections if write latency exceeds 50 milliseconds.',
              isCorrect: false,
              explanation: 'Replicas accept queries, but only read-only queries (SELECT), not write operations.'
            },
            {
              text: 'Because all database engines require full synchronous consensus across all nodes.',
              isCorrect: false,
              explanation: 'Synchronous replication is optional; asynchronous replication is the standard default.'
            }
          ]}
        />

        <Quiz
          id="quiz_0004_3"
          question="3. What critical mechanism prevents 'Split-Brain' when an old primary node reconnects after an unexpected network partition?"
          options={[
            {
              text: 'Fencing tokens and node isolation (STONITH) to invalidate the deposed master.',
              isCorrect: true,
              explanation: 'Fencing tokens (monotonically increasing epoch numbers) reject outdated leaders, and STONITH cuts power or network isolation.'
            },
            {
              text: 'Acquiring a distributed Redlock mutex in Redis before every read-only query.',
              isCorrect: false,
              explanation: 'Redis distributed locks do not manage internal database replication failover.'
            },
            {
              text: 'Increasing TCP keepalive timeout to 120 seconds on all replica sockets.',
              isCorrect: false,
              explanation: 'Increasing TCP keepalive delays failure detection and makes split-brain worse.'
            },
            {
              text: 'Configuring the application load balancer to use round-robin traffic routing.',
              isCorrect: false,
              explanation: 'Round-robin load balancers blindly forward traffic to whatever node is alive.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0004" />

        <AgentReminder
          title="Explore Further with AI"
          promptText='Have questions about when to pick Multi-Leader vs Single-Leader? Unsure whether to use PgBouncer vs AWS RDS Proxy? Ask an AI chat of your choice: "How should I configure PgBouncer for read replicas?"'
        />
      </div>
    </div>
  );
};
