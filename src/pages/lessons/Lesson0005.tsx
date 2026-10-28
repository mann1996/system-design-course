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
import { ShardingSimulator } from '../../components/Simulators/ShardingSimulator';

export const Lesson0005: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0005"
            lessonBadge="Lesson 0005"
            moduleBadge="Module 2: Distributed State & Data"
            time="20 mins"
            tag="Interactive Sim"
          />
          <h1>Database Partitioning, Sharding &amp; Consistent Hashing</h1>
          <p className="lead-text">
            In Lesson 0004, we scaled read operations across read replicas. But what happens when write traffic exceeds 10,000 writes/sec or your dataset outgrows a single server's disk? Master horizontal database sharding, choose bulletproof partition keys, and understand why consistent hashing prevents the devastating "reshard-the-world" catastrophe.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0005" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em> (O'Reilly, 2017), Chapter 6: <em>Partitioning</em> (Partitioning and Replication, Partitioning by Key Range vs Hash of Key, Skewed Workloads, and Rebalancing Partitions).
            </p>
          }
        />

        <h2>1. The Wall: Why Replicas Cannot Scale Writes</h2>
        <p>
          In <Link to="/lessons/0004">Lesson 0004</Link>, we established single-leader replication. It gave us a 10x read boost by spreading <code>SELECT</code> queries across 5 follower nodes.
        </p>
        <p>
          However, every single write (<code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>) must still be executed by the <strong>single Primary node</strong>. Furthermore, every replica must also execute every write from the replication stream. Adding 10 more replicas actually increases the write replication overhead!
        </p>
        <p>Eventually, your system hits one of two hard physical ceilings:</p>
        <ul>
          <li><strong>Storage Capacity Ceiling:</strong> Your table grows beyond 10TB. A single cloud SSD cannot hold it, and index rebuilding times become unacceptable.</li>
          <li><strong>Write Throughput Ceiling:</strong> Your ingest rate surpasses 10,000–20,000 writes/sec. A single primary node’s disk I/O (IOPS) and WAL sync lock up.</li>
        </ul>
        <p>
          The solution is <strong>Partitioning (also called Sharding)</strong>: splitting a massive monolithic database horizontally into independent smaller databases called <em>shards</em>, each responsible for a distinct slice of the data.
        </p>

        <h2>2. Choosing a Partitioning Scheme: Range vs. Hash</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ marginTop: 0, fontSize: '17px' }}>1. Range-Based Partitioning</h3>
            <p style={{ fontSize: '14px' }}>
              Records are partitioned into contiguous ordered intervals (e.g., Shard A: A–F, Shard B: G–M, or Shard 1: Jan–Mar, Shard 2: Apr–Jun).
            </p>
            <p style={{ fontSize: '13px' }}><strong>Strengths:</strong> Range scans are fast. Querying <code>WHERE date BETWEEN ...</code> hits only a single shard.</p>
            <p style={{ fontSize: '13px', color: 'var(--color-error)', margin: 0 }}>
              Fatal Flaw: Hotspots! If partitioning by timestamp, 100% of today's incoming writes hammer the single current shard.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ marginTop: 0, fontSize: '17px' }}>2. Hash-Based Partitioning</h3>
            <p style={{ fontSize: '14px' }}>
              A uniform hashing function (e.g., MurmurHash3, MD5) hashes the partition key to produce a pseudorandom integer: <code>hash(userId)</code>.
            </p>
            <p style={{ fontSize: '13px' }}><strong>Strengths:</strong> Uniform data distribution. Eliminates hotspots even when consecutive keys are inserted.</p>
            <p style={{ fontSize: '13px', color: 'var(--color-primary)', margin: 0 }}>
              Trade-Off: Cross-key range queries lose ordering, requiring Scatter-Gather across all shards.
            </p>
          </div>
        </div>

        <h2>3. The Modulo Trap vs. Consistent Hashing</h2>
        <p>A naive developer hashes keys using the modulo operator:</p>
        <CodeWindowCard
          title="Naive Modulo Sharding (Dangerous)"
          code={`// Given N = 4 shards
const targetShard = hash(userId) % 4;`}
        />
        <p>
          <strong>Why is Modulo N a production catastrophe?</strong> When traffic increases and you scale from 4 shards to 5 shards, <strong>almost every single key changes its destination shard</strong> (~80% of all records must migrate!).
        </p>
        <p>
          <strong>The Fix: Consistent Hashing.</strong> In consistent hashing, the output range is treated as a continuous virtual ring (from 0 to 2³² - 1). Both database shard nodes and data keys are mapped onto this ring. When adding a new server node to a cluster of N nodes, <strong>only 1/N of keys are remapped!</strong>
        </p>

        <h2>4. Interactive Simulator: Sharding &amp; Consistent Hashing Ring</h2>
        <p>
          Interact with the consistent hash ring simulator below. Route user keys, batch populate data, and toggle the 5th shard to see live rebalancing with minimal key migration:
        </p>

        <ShardingSimulator />

        <h2>5. Implementing a Shard Router in TypeScript</h2>
        <CodeWindowCard
          title="src/database/consistent-shard-router.ts"
          code={`import { Pool, QueryResult, QueryResultRow } from 'pg';
import { createHash } from 'crypto';

interface ShardNode {
  id: string;
  pool: Pool;
  hashToken: number;
}

export class ConsistentShardRouter {
  private ring: ShardNode[] = [];

  constructor(shardConfigs: { id: string; connectionString: string }[]) {
    for (const config of shardConfigs) {
      const pool = new Pool({ connectionString: config.connectionString, max: 15 });
      const token = this.hashKey(config.id);
      this.ring.push({ id: config.id, pool, hashToken: token });
    }
    this.ring.sort((a, b) => a.hashToken - b.hashToken);
  }

  private hashKey(key: string): number {
    const md5 = createHash('md5').update(key).digest();
    return md5.readUInt32BE(0);
  }

  public getShard(partitionKey: string): ShardNode {
    const keyHash = this.hashKey(partitionKey);
    for (const node of this.ring) {
      if (node.hashToken >= keyHash) {
        return node;
      }
    }
    return this.ring[0];
  }

  public async query<T extends QueryResultRow>(
    partitionKey: string, 
    sql: string, 
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    const shard = this.getShard(partitionKey);
    return shard.pool.query<T>(sql, params);
  }
}`}
        />

        <AIPitfallCallout title='AI Architectural Pitfall: "Just shard on created_at timestamp or UUID"'>
          <p>
            AI chatbots frequently suggest sharding on timestamps or random UUIDs without understanding access patterns. This introduces catastrophic production traps:
          </p>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li>
              <strong>Timestamp Sharding Hotspot:</strong> All current writes hit the shard holding "today", turning sharding into an expensive single-node bottleneck.
            </li>
            <li>
              <strong>Scatter-Gather Fanout:</strong> If you shard by random <code>UUID</code>, querying "all orders for User #42" forces queries to <strong>every single shard simultaneously</strong>.
            </li>
          </ol>
        </AIPitfallCallout>

        <h2>6. Active Retrieval: Test Your Understanding</h2>
        <Quiz
          id="quiz_0005_1"
          question="1. Why is simple Modulo Hashing (hash(key) % N) considered dangerous when scaling a production sharded cluster?"
          options={[
            {
              text: 'Because modulo hashing generates severe hot spots on odd-numbered shards.',
              isCorrect: false,
              explanation: 'Cryptographic hash functions generate uniform distributions with modulo.'
            },
            {
              text: 'Adding a single new shard forces almost all existing keys to change nodes.',
              isCorrect: true,
              explanation: 'When moving from N to N+1 nodes, nearly N/(N+1) of all keys remap to new shards, causing massive data migration.'
            },
            {
              text: 'Because computing integer modulo introduces severe CPU latency overhead.',
              isCorrect: false,
              explanation: 'Modulo operations execute in less than 1 nanosecond in CPU registers.'
            },
            {
              text: 'Because relational engines do not support modulo arithmetic.',
              isCorrect: false,
              explanation: 'All relational engines support standard arithmetic.'
            }
          ]}
        />

        <Quiz
          id="quiz_0005_2"
          question="2. When designing a sharding scheme for a Multi-Tenant SaaS platform (where each company has thousands of users), what is the optimal partition key?"
          options={[
            {
              text: 'Sharding on user_id to ensure users are distributed across all shards.',
              isCorrect: false,
              explanation: 'Sharding by user_id fragments a single tenant\'s data across all shards, destroying reporting queries.'
            },
            {
              text: 'Sharding on tenant_id so all data for a single company lives on one shard.',
              isCorrect: true,
              explanation: 'Sharding on tenant_id co-locates all users, invoices, and data for a company on one shard, enabling local SQL joins.'
            },
            {
              text: 'Sharding on created_at timestamp to sort company records chronologically.',
              isCorrect: false,
              explanation: 'Sharding by timestamp causes severe write hotspots on the current time partition.'
            },
            {
              text: 'Generating a random UUID for every row to maximize random scattering.',
              isCorrect: false,
              explanation: 'Random UUIDs force scatter-gather queries across every shard for basic tenant dashboards.'
            }
          ]}
        />

        <Quiz
          id="quiz_0005_3"
          question="3. What is the primary operational penalty of executing queries that do NOT include the partition key in the WHERE clause?"
          options={[
            {
              text: 'The query experiences replication lag anomalies and returns stale rows.',
              isCorrect: false,
              explanation: 'Replication lag is an issue in async replication, not shard scattering.'
            },
            {
              text: 'The router must Scatter-Gather the query across every shard simultaneously.',
              isCorrect: true,
              explanation: 'Without the partition key, the router cannot determine which shard holds the data, forcing a Scatter-Gather query across all shards.'
            },
            {
              text: 'The database driver throws an immediate unhandled syntax rejection error.',
              isCorrect: false,
              explanation: 'Queries missing partition keys execute, but with high latency and resource fan-out.'
            },
            {
              text: 'The query causes an immediate distributed deadlock across connection pools.',
              isCorrect: false,
              explanation: 'Deadlocks happen during concurrent write transactions, not single read queries.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0005" />

        <AgentReminder
          title="Explore Further with AI"
          promptText='Need help choosing between Vitess, Citus Data, AWS Aurora Limitless, or application-level sharding for a project? Ask an AI chat of your choice: "How should I partition my e-commerce database?"'
        />
      </div>
    </div>
  );
};
