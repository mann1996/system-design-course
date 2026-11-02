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
import { SnowflakeSimulator } from '../../components/Simulators/SnowflakeSimulator';

export const Lesson0011: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0011"
            lessonBadge="Lesson 0011"
            moduleBadge="Module 5: Coordination &amp; Consensus"
            time="20 mins"
            tag="Snowflake Sim"
          />
          <h1>Globally Unique ID Generation: Twitter Snowflake, UUIDv7 &amp; Clock Skew</h1>
          <p className="lead-text">
            Generate 64-bit monotonically time-ordered IDs at scale across distributed database shards without centralized database locks. Master Twitter Snowflake bitwise layout, understand UUIDv7 B-tree index locality advantages, and engineer robust defenses against NTP clock drift.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0011" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Alex Xu, <em>System Design Interview (Volume 1)</em>, Chapter 7: &ldquo;Design a Unique ID Generator in Distributed Systems&rdquo;; Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 8: &ldquo;Unreliable Clocks &amp; Monotonic Timestamps&rdquo;; Twitter Engineering, <em>Announcing Snowflake</em> (2010); and IETF RFC 9562, Section 5.7: &ldquo;UUID Version 7&rdquo; (2024).
            </p>
          }
        />

        <h2>1. The Distributed ID Dilemma: Why DB Auto-Increment &amp; UUIDv4 Fail</h2>
        <p>
          In <Link to="/lessons/0005">Lesson 0005</Link>, we sharded database writes across independent database instances using consistent hashing. In <Link to="/lessons/0007">Lesson 0007</Link>, we appended events to transactional outbox tables. However, every distributed entity (orders, payments, messages, ledger entries) requires a <strong>globally unique primary key</strong>.
        </p>
        <p>
          In a single monolithic relational database, unique ID generation is trivial: the database engine maintains an atomic <code>AUTO_INCREMENT</code> or <code>BIGSERIAL</code> sequence. But as soon as traffic forces you to partition across multiple database shards or microservices, traditional ID generation schemes collapse under high write concurrency.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Naive Approach 1</span>
            <h4 style={{ margin: '8px 0' }}>Central Database Auto-Increment</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Routing all primary key generation through a single centralized &ldquo;Ticket Server&rdquo; (e.g., Flickr's historical approach) creates a single point of failure (SPOF) and a brutal write bottleneck capped by disk sync I/O.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Naive Approach 2</span>
            <h4 style={{ margin: '8px 0' }}>Multi-Master Auto-Increment Offsets</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Configuring Shard 1 to generate odd IDs (1, 3, 5...) and Shard 2 to generate even IDs (2, 4, 6...) breaks down when you need to dynamically add shards, migrate tables, or order events chronologically across nodes.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge" style={{ marginBottom: '8px', background: '#333', color: '#fff' }}>Naive Approach 3</span>
            <h4 style={{ margin: '8px 0' }}>Random UUIDv4 (128-Bit)</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Generating 128-bit random UUIDs guarantees uniqueness without network coordination, but completely destroys B-tree index performance and causes massive disk write amplification.
            </p>
          </div>
        </div>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Just Use UUIDv4 for All Primary Keys"'>
          <p>
            When asked to generate primary keys for a high-throughput PostgreSQL or MySQL table, AI assistants almost invariably suggest <code>crypto.randomUUID()</code> (UUIDv4).
          </p>
          <p style={{ margin: '8px 0 0' }}>
            This advice is disastrous for high-scale database write throughput:
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>B-Tree Leaf Page Splitting:</strong> Relational databases store clustered primary key indexes as B+Trees, which expect keys to arrive in ascending numerical order. Because UUIDv4 is completely random, new inserts land in arbitrary pages scattered across the entire index, triggering constant page splits and fragmented disk pages.</li>
            <li><strong>Buffer Pool Cache Thrashing:</strong> Instead of keeping only the newest index leaf pages in RAM (temporal locality), random UUID inserts require reading arbitrary cold pages from disk into memory, dramatically degrading database throughput.</li>
            <li><strong>Storage Footprint:</strong> 128-bit UUID strings (36 characters with hyphens) consume 4x more disk space and RAM than a native 64-bit integer, ballooning foreign key join tables.</li>
          </ul>
        </AIPitfallCallout>

        <h2>2. Twitter Snowflake Architecture: 64-Bit Binary Decomposition</h2>
        <p>
          To solve this problem at massive scale (tens of thousands of tweets per second), Twitter designed <strong>Snowflake</strong>: a decentralized algorithm that allows hundreds of independent worker nodes to generate 64-bit unique IDs that are <strong>k-sortable</strong> (roughly ordered by creation timestamp) without any network communication between workers during generation.
        </p>
        <p>
          A Snowflake ID fits into a standard 64-bit signed integer (<code>BIGINT</code> in SQL, <code>bigint</code> in TypeScript), decomposed into four distinct bitwise segments:
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Segment</th>
                <th>Bit Width</th>
                <th>Bit Range</th>
                <th>Architectural Purpose &amp; Capacity Bounds</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Sign Bit</strong></td>
                <td>1 bit</td>
                <td>Bit 63</td>
                <td>Always reserved as <code>0</code> to ensure the resulting integer is positive in signed integer systems.</td>
              </tr>
              <tr>
                <td><strong>Timestamp</strong></td>
                <td>41 bits</td>
                <td>Bits 62 &ndash; 22</td>
                <td>
                  Milliseconds elapsed since a custom epoch (e.g., 2024-01-01). 2<sup>41</sup> ms &asymp; 2,199,023,255,552 ms &asymp; <strong>69.7 years</strong> of operational lifespan.
                </td>
              </tr>
              <tr>
                <td><strong>Datacenter ID</strong></td>
                <td>5 bits</td>
                <td>Bits 21 &ndash; 17</td>
                <td>Identifies physical datacenter or cloud region (2<sup>5</sup> = 32 distinct datacenters).</td>
              </tr>
              <tr>
                <td><strong>Worker Machine ID</strong></td>
                <td>5 bits</td>
                <td>Bits 16 &ndash; 12</td>
                <td>Identifies compute worker process (2<sup>5</sup> = 32 distinct workers per datacenter, total 1,024 nodes).</td>
              </tr>
              <tr>
                <td><strong>Sequence Number</strong></td>
                <td>12 bits</td>
                <td>Bits 11 &ndash; 0</td>
                <td>
                  Per-millisecond counter (2<sup>12</sup> = <strong>4,096 unique IDs per millisecond per worker node</strong>). Resets to 0 each millisecond.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          <strong>Throughput Capacity Math:</strong> A single worker node can generate up to <code>4,096 IDs/ms &times; 1,000 ms = 4,096,000 IDs/second</code>. Across 1,024 worker nodes, the cluster capacity exceeds <strong>4.19 billion IDs per second</strong> with zero inter-process locking or central database bottlenecks.
        </p>

        <h2>3. Production Failure Modes: Clock Drift &amp; Sequence Overflow</h2>
        <p>
          While Snowflake is elegant, distributed systems operating over physical hardware face two critical operational edge cases:
        </p>

        <h3>1. The Backward NTP Clock Skew Trap</h3>
        <p>
          Server hardware clocks drift due to temperature fluctuations and CPU clock frequency variations. Network Time Protocol (NTP) periodically synchronizes system clocks against atomic time servers.
        </p>
        <p>
          If NTP abruptly steps the system clock <strong>backward</strong> (e.g. system time jumps from <code>12:00:00.050</code> back to <code>12:00:00.030</code>), a naive Snowflake generator will re-issue timestamps that were already generated, producing <strong>fatal primary key collisions</strong>!
        </p>
        <div className="card card-cream" style={{ padding: '16px 20px', borderRadius: '8px', margin: '16px 0', borderLeft: '4px solid var(--color-primary)' }}>
          <strong>Defensive Guardrail for Clock Skew:</strong>
          <ol style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '14px' }}>
            <li><strong>Minor Skew (&le; 5ms):</strong> Spin-wait in a tight loop or yield execution until the physical clock catches up to <code>lastTimestamp</code>.</li>
            <li><strong>Severe Skew (&gt; 5ms):</strong> Refuse to generate IDs! Throw an immediate exception, trip a circuit breaker, or fail over to a standby node to prevent data corruption.</li>
            <li><strong>Use Monotonic Slew:</strong> Configure NTP daemons (such as <code>chrony</code> with <code>makestep 0.1 -1</code>) to gradually slew the clock frequency rather than jumping backward instantaneously.</li>
          </ol>
        </div>

        <h3>2. Per-Millisecond Sequence Exhaustion</h3>
        <p>
          What happens when a single node experiences a sudden burst exceeding 4,096 requests within a single millisecond? The 12-bit sequence counter overflows back to 0. If unhandled, it would generate duplicate IDs for that same millisecond.
        </p>
        <p>
          The generator must detect when <code>(sequence + 1) &gt; 4095</code>, hold execution in a spin-wait loop until the physical clock ticks into the next millisecond, and only then reset <code>sequence = 0</code>.
        </p>

        <h2>4. The Modern Contender: UUIDv7 (RFC 9562)</h2>
        <p>
          In 2024, the IETF ratified <strong>RFC 9562</strong>, introducing <strong>UUIDv7</strong>. UUIDv7 merges the convenience of decentralized UUIDs with the B-tree index efficiency of Snowflake:
        </p>
        <ul>
          <li><strong>48-bit Unix timestamp:</strong> Milliseconds since standard Unix epoch (sufficient until year 10889).</li>
          <li><strong>74 bits of entropy / counter:</strong> Cryptographically strong randomness and optional sub-millisecond sequence counter.</li>
          <li><strong>Standard 128-bit UUID format:</strong> Standard string representation (e.g. <code>018f3a5b-91c2-7b83-a4e9-123456789abc</code>) compatible with native database UUID types.</li>
        </ul>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Criteria</th>
                <th>Twitter Snowflake</th>
                <th>UUIDv7 (RFC 9562)</th>
                <th>UUIDv4 (Random)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Bit Length &amp; Type</strong></td>
                <td>64-bit integer (<code>BIGINT</code>)</td>
                <td>128-bit integer / UUID</td>
                <td>128-bit integer / UUID</td>
              </tr>
              <tr>
                <td><strong>B-Tree Index Locality</strong></td>
                <td><span style={{ color: 'var(--color-teal)', fontWeight: 600 }}>Excellent (Monotonic)</span></td>
                <td><span style={{ color: 'var(--color-teal)', fontWeight: 600 }}>Excellent (Time-ordered)</span></td>
                <td><span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Disastrous (Random page splits)</span></td>
              </tr>
              <tr>
                <td><strong>Index Storage Size</strong></td>
                <td><strong>8 bytes</strong> per row</td>
                <td>16 bytes per row</td>
                <td>16 bytes per row</td>
              </tr>
              <tr>
                <td><strong>Worker ID Coordination</strong></td>
                <td>Required (ZooKeeper/etcd or StatefulSet)</td>
                <td><span style={{ color: 'var(--color-teal)', fontWeight: 600 }}>Zero (Decentralized entropy)</span></td>
                <td><span style={{ color: 'var(--color-teal)', fontWeight: 600 }}>Zero (Random)</span></td>
              </tr>
              <tr>
                <td><strong>Best For</strong></td>
                <td>Ultra-high-throughput DBs &amp; tight foreign key tables</td>
                <td>Polyglot microservices &amp; standard UUID APIs</td>
                <td>Session tokens / non-indexed entities only</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Interactive Simulator */}
        <SnowflakeSimulator />

        <h2>5. Production TypeScript Implementation with Clock Skew Protection</h2>
        <p>
          The implementation below demonstrates safe 64-bit bitwise arithmetic using JavaScript native <code>bigint</code>, protecting against sequence overflow and detecting backward NTP clock jumps.
        </p>

        <CodeWindowCard
          title="snowflake-generator.ts"
          code={`// Production-Grade Snowflake Generator in TypeScript
// Uses native BigInt for exact 64-bit precision without floating-point truncation

export class SnowflakeIdGenerator {
  // Custom Epoch: 2024-01-01T00:00:00.000Z
  private readonly customEpoch = 1704067200000n;

  // Bit allocation configuration
  private readonly datacenterIdBits = 5n;
  private readonly workerIdBits = 5n;
  private readonly sequenceBits = 12n;

  private readonly maxDatacenterId = (1n << this.datacenterIdBits) - 1n; // 31
  private readonly maxWorkerId = (1n << this.workerIdBits) - 1n;         // 31
  private readonly maxSequence = (1n << this.sequenceBits) - 1n;         // 4095

  private readonly workerIdShift = this.sequenceBits;
  private readonly datacenterIdShift = this.sequenceBits + this.workerIdBits;
  private readonly timestampLeftShift = this.sequenceBits + this.workerIdBits + this.datacenterIdBits;

  private datacenterId: bigint;
  private workerId: bigint;
  private sequence = 0n;
  private lastTimestamp = -1n;

  constructor(datacenterId: number, workerId: number) {
    if (datacenterId < 0 || BigInt(datacenterId) > this.maxDatacenterId) {
      throw new Error(\`Datacenter ID must be between 0 and \${this.maxDatacenterId}\`);
    }
    if (workerId < 0 || BigInt(workerId) > this.maxWorkerId) {
      throw new Error(\`Worker ID must be between 0 and \${this.maxWorkerId}\`);
    }

    this.datacenterId = BigInt(datacenterId);
    this.workerId = BigInt(workerId);
  }

  /**
   * Generates a 64-bit monotonically ascending unique ID.
   * Defends against backward NTP clock skew and millisecond sequence exhaustion.
   */
  public nextId(): bigint {
    let currentTimestamp = this.getCurrentTimestamp();

    // Guardrail: Backward NTP Clock Drift Detection
    if (currentTimestamp < this.lastTimestamp) {
      const skewMs = Number(this.lastTimestamp - currentTimestamp);

      // Minor skew tolerance: spin-wait up to 5 milliseconds
      if (skewMs <= 5) {
        while (currentTimestamp < this.lastTimestamp) {
          currentTimestamp = this.getCurrentTimestamp();
        }
      } else {
        // Severe skew: Panic to prevent duplicate primary keys
        throw new Error(
          \`Critical Clock Skew: System clock moved backward by \${skewMs}ms. Refusing to generate IDs.\`
        );
      }
    }

    if (currentTimestamp === this.lastTimestamp) {
      // Same millisecond: increment sequence with bitwise mask
      this.sequence = (this.sequence + 1n) & this.maxSequence;

      if (this.sequence === 0n) {
        // Sequence exhausted (>4,096 IDs in 1ms) - wait for next millisecond
        currentTimestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      // New millisecond: reset sequence counter
      this.sequence = 0n;
    }

    this.lastTimestamp = currentTimestamp;

    // Bitwise assembly of the 64-bit integer
    const id =
      ((currentTimestamp - this.customEpoch) << this.timestampLeftShift) |
      (this.datacenterId << this.datacenterIdShift) |
      (this.workerId << this.workerIdShift) |
      this.sequence;

    return id;
  }

  private getCurrentTimestamp(): bigint {
    return BigInt(Date.now());
  }

  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.getCurrentTimestamp();
    while (timestamp <= lastTimestamp) {
      timestamp = this.getCurrentTimestamp();
    }
    return timestamp;
  }
}`}
        />

        <h2>6. Active Retrieval &amp; Architectural Verification</h2>
        <p>
          Verify your mastery of distributed ID generation, bitwise decomposition, and NTP clock anomalies:
        </p>

        <Quiz
          id="quiz_0011_1"
          question="1. Why does generating primary keys with random UUIDv4 severely degrade B-tree index performance in PostgreSQL or MySQL?"
          options={[
            {
              text: 'Because random UUIDs scatter inserts across leaf pages, triggering frequent page splits and cache thrashing.',
              isCorrect: true,
              explanation: 'B+Tree indexes are optimized for sequentially ascending keys. Random keys insert into arbitrary pages, fragmenting index pages and causing constant disk I/O.'
            },
            {
              text: 'Because relational database engines require primary key strings to be encoded exclusively in UTF-16 characters.',
              isCorrect: false,
              explanation: 'Database engines support standard ASCII/UTF-8 strings and native UUID data types.'
            },
            {
              text: 'Because network load balancers fail to route HTTP requests containing hexadecimal strings in query parameters.',
              isCorrect: false,
              explanation: 'Reverse proxies and load balancers have no issue handling UUID strings in HTTP payloads.'
            },
            {
              text: 'Because operating system kernels prevent multi-threaded applications from generating more than 16 random bytes.',
              isCorrect: false,
              explanation: 'Cryptographic random generators can generate millions of random bytes without OS limits.'
            }
          ]}
        />

        <Quiz
          id="quiz_0011_2"
          question="2. In the 64-bit Twitter Snowflake algorithm, why is the first bit (bit 63) fixed to zero?"
          options={[
            {
              text: 'To ensure that Kafka message brokers can deserialize the ID as an unsigned variable-length integer.',
              isCorrect: false,
              explanation: 'Kafka can serialize any arbitrary byte sequence regardless of sign.'
            },
            {
              text: 'To ensure the ID remains a positive number in programming environments using signed 64-bit integers.',
              isCorrect: true,
              explanation: 'Many languages (Java, C, SQL BIGINT) treat the most significant bit as the sign bit. Keeping bit 63 as 0 ensures the ID is never interpreted as a negative integer.'
            },
            {
              text: 'To reserve space for future IPv6 address mapping when servers migrate across virtual subnets.',
              isCorrect: false,
              explanation: 'Snowflake does not embed IP addresses; worker IDs are allocated independently.'
            },
            {
              text: 'To indicate to Redis clusters that the key should be cached in in-memory LRU storage rather than disk.',
              isCorrect: false,
              explanation: 'Redis key storage policies are independent of numeric ID sign bits.'
            }
          ]}
        />

        <Quiz
          id="quiz_0011_3"
          question="3. What catastrophic failure occurs if a Snowflake generator continues issuing IDs after an NTP server steps the system clock backward?"
          options={[
            {
              text: 'The worker node will immediately run out of heap memory due to V8 garbage collection stalling.',
              isCorrect: false,
              explanation: 'Clock skew does not impact Node.js heap memory or trigger garbage collection stalls.'
            },
            {
              text: 'The database connection pool will reject incoming TLS certificates because the epoch date expired.',
              isCorrect: false,
              explanation: 'Minor clock steps of milliseconds do not invalidate TLS certificate validity windows.'
            },
            {
              text: 'The generator will re-generate timestamps from the past, producing duplicate primary key collisions.',
              isCorrect: true,
              explanation: 'If the clock steps backward, the generator will re-issue the same millisecond timestamp and sequence numbers, creating duplicate IDs that violate database primary key uniqueness constraints.'
            },
            {
              text: 'The operating system kernel will terminate the process due to a monotonic timer overflow exception.',
              isCorrect: false,
              explanation: 'Operating systems do not terminate user-space processes on backward NTP clock adjustments.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0011" />

        <AgentReminder
          title="Teacher Standby: Evaluating Unique ID Architectures"
          promptText="Ask me: 'Can you evaluate my database sharding primary key design? I am deciding between Twitter Snowflake, UUIDv7, and ULID for a partitioned PostgreSQL ledger processing 80,000 writes/sec.'"
        />
      </div>
    </div>
  );
};
