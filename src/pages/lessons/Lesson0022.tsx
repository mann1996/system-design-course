import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { StatefulCheckpointSimulator } from '../../components/Simulators/StatefulCheckpointSimulator';

export const Lesson0022: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0022"
            lessonBadge="Lesson 0022"
            moduleBadge="Module 10: Stream Processing &amp; Pipelines"
            time="25 mins"
            tag="Checkpoint Sim"
          />
          <h1>Stateful Stream Processing &amp; Exactly-Once Semantics: Checkpointing, State Stores &amp; Stream Joins</h1>
          <p className="lead-text">
            Filtering a stateless stream of JSON records is trivial. But computing running bank balances, rolling 24-hour merchant velocities, or joining fast-moving clicks with slow-moving product catalogs requires <strong>distributed state</strong>. When worker nodes crash midway through millions of transactions, how do you prevent catastrophic duplicate payments or lost updates? Deconstruct stateful stream architectures: embedded RocksDB state backends, the Chandy-Lamport distributed snapshotting algorithm (ABS), stream-table vs. stream-stream joins, and end-to-end exactly-once guarantees via Two-Phase Commit (2PC) sinks.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0022" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 11: &ldquo;Stream Processing &ndash; Fault Tolerance &amp; Exactly-Once Semantics&rdquo;; K. Mani Chandy and Leslie Lamport, <em>&ldquo;Distributed Snapshots: Determining Global States of Distributed Systems&rdquo;</em> (ACM Transactions on Computer Systems, 1985); Apache Flink Architecture: <em>&ldquo;Stateful Stream Processing, Checkpointing &amp; Asynchronous Barrier Snapshotting (ABS)&rdquo;</em>; and Guozhang Wang et al., <em>&ldquo;Transactional Messaging and Exactly-Once Processing in Apache Kafka&rdquo;</em> (VLDB).
            </p>
          }
        />

        <h2>1. The Reality of Stateful Streams: Why Memory State is Dangerous</h2>
        <p>
          A streaming computation is <strong>stateless</strong> if the output for an incoming record depends solely on that single record (e.g. converting a temperature from Fahrenheit to Celsius or filtering out records where <code>status === &apos;CANCELLED&apos;</code>). Stateless operators require no memory across events and can crash and restart with zero side effects.
        </p>
        <p>
          However, virtually all high-value business architectures are <strong>stateful</strong>:
        </p>
        <ul>
          <li><strong>Rolling Velocity &amp; Anomaly Detection:</strong> Calculating the total transaction count and dollar volume for credit card <em>X</em> in the last 15 minutes.</li>
          <li><strong>Sessionization &amp; Deduplication:</strong> Remembering previously observed transaction IDs to suppress duplicate payments.</li>
          <li><strong>Stream-Table Enrichment:</strong> Joining incoming real-time telemetry with a changing user profile database.</li>
        </ul>
        <p>
          If you store this state inside standard Node.js or JVM in-memory variables (e.g. <code>const state = new Map()</code>), a single worker crash, Kubernetes OOM kill, or container reschedule wipes out all state. The system must either restart from the beginning of time (untenable for multi-year streams) or suffer corrupted business balances.
        </p>

        <h2>2. Local State Storage Architecture: Heap vs. Embedded RocksDB</h2>
        <p>
          Where should a stream processor store its working state? Naive architectures attempt to query an external shared database (like PostgreSQL or Redis) for every incoming stream event.
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>State Architecture</th>
                <th>Storage Location</th>
                <th>Throughput &amp; Latency</th>
                <th>Capacity Limit &amp; Failure Modes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>External Database (PostgreSQL / Redis)</strong></td>
                <td>Remote network cluster accessed via TCP sockets.</td>
                <td>Low (1,000&ndash;10,000 QPS). Every event incurs a 1&ndash;5 ms network round-trip and saturates connection pools.</td>
                <td>Network bandwidth becomes the global bottleneck. Database primary collapses under high stream ingress.</td>
              </tr>
              <tr>
                <td><strong>In-Memory Heap (V8 Heap / JVM RAM)</strong></td>
                <td>Direct process RAM allocated to the stream worker.</td>
                <td>Ultra-high (&gt;1,000,000 QPS). Nanosecond access time with zero network or serialization overhead.</td>
                <td>Strictly bounded by available host RAM (e.g. 16 GB). Large states cause GC pause paralysis and container OOM kills.</td>
              </tr>
              <tr>
                <td><strong>Embedded LSM-Tree (RocksDB on Local NVMe)</strong></td>
                <td>Embedded C++ library compiled into the worker process writing to local high-speed SSD/NVMe.</td>
                <td>High (&gt;250,000 QPS). Sub-millisecond reads via OS page cache and fast sequential writes to local SSTables.</td>
                <td><strong>Gold standard for enterprise streaming:</strong> State size is bounded by cheap local disk (terabytes), not expensive RAM.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>3. Fault Tolerance: The Chandy-Lamport Distributed Snapshot Algorithm</h2>
        <p>
          If hundreds of distributed worker nodes maintain gigabytes of local state across thousands of Kafka partitions, how can the cluster snapshot its global state without stopping the world and halting live traffic?
        </p>
        <p>
          The theoretical foundation of modern stream fault tolerance is the <strong>Chandy-Lamport Distributed Snapshot Algorithm</strong> (implemented in Apache Flink as <strong>Asynchronous Barrier Snapshotting / ABS</strong>):
        </p>

        <h3>How Asynchronous Barrier Snapshotting Works:</h3>
        <ol>
          <li>
            <strong>Barrier Injection:</strong> A central Checkpoint Coordinator periodically injects a numbered control marker, called a <strong>Checkpoint Barrier</strong> (e.g. <code>Barrier #42</code>), into the input partitions of the message broker alongside normal data records.
          </li>
          <li>
            <strong>Barrier Flow:</strong> Barriers flow strictly in-order with data records down the stream DAG. Records arriving before the barrier belong to Checkpoint #42; records arriving after the barrier belong to Checkpoint #43.
          </li>
          <li>
            <strong>Barrier Alignment:</strong> When an operator receives data from multiple upstream partitions (e.g. Partition A and Partition B), it waits until it has received <code>Barrier #42</code> from <em>all</em> incoming channels before snapshotting. This guarantees an aligned, consistent temporal cut.
          </li>
          <li>
            <strong>Asynchronous State Snapshot:</strong> Once aligned, the operator writes a snapshot of its local RocksDB state files asynchronously to durable cloud object storage (Amazon S3, Google Cloud Storage, or MinIO), advances its watermark, and emits <code>Barrier #42</code> downstream.
          </li>
          <li>
            <strong>Crash Recovery:</strong> If any worker crashes, the entire DAG rewinds to the last acknowledged global checkpoint (e.g. Checkpoint #42). Operators restore their local RocksDB directories from S3, reset Kafka consumer offsets to the barrier boundary, and resume processing.
          </li>
        </ol>

        <h2>4. Stream Joins: Combining Independent Flows</h2>
        <p>
          In a distributed microservice topology, business insights require joining multiple data streams in real time. There are two fundamental join topologies:
        </p>

        <h3>Topology 1: Stream-Table Join (Enrichment Join)</h3>
        <p>
          Enriches a high-velocity event stream (e.g. 50,000 payment events/sec) with contextual attributes from a slowly changing dimension table (e.g. user risk score, account tier).
        </p>
        <ul>
          <li><strong>Implementation:</strong> The dimension table is consumed as a changelog stream via <strong>Change Data Capture (CDC / Debezium)</strong> and maintained inside each stream worker&apos;s local RocksDB state store. When a payment event arrives, the worker executes a local sub-millisecond lookup in RocksDB without touching the primary SQL database.</li>
        </ul>

        <h3>Topology 2: Stream-Stream Join (Interval / Windowed Join)</h3>
        <p>
          Correlates two independent, unbounded event streams (e.g. Ad Impressions and Ad Clicks).
        </p>
        <ul>
          <li><strong>The Temporal Window Requirement:</strong> Because both streams are unbounded, joining them requires an explicit time boundary:
            <br />
            <code>ON click.ad_id = impression.ad_id AND click.timestamp BETWEEN impression.timestamp AND impression.timestamp + INTERVAL 1 HOUR</code>.
          </li>
          <li><strong>State Retention:</strong> The stream processor buffers incoming impressions in RocksDB state for exactly 1 hour. When a matching click arrives, the pair is emitted. If 1 hour elapses without a click, the impression expires from RocksDB.</li>
        </ul>

        <h2>5. End-to-End Exactly-Once Semantics (EOS) via Two-Phase Commit (2PC)</h2>
        <p>
          A common architectural misunderstanding is believing that Kafka or Flink provides &ldquo;magic&rdquo; exactly-once delivery out of the box. Stream processing engines only control their internal state. Once an operator emits output to an external database, REST API, or banking gateway, network timeouts during commits can cause catastrophic duplicate writes.
        </p>
        <p>
          True <strong>End-to-End Exactly-Once Processing</strong> requires coordinating internal checkpoints with external sink transactions using the <strong>Two-Phase Commit (2PC) Sink Protocol</strong>:
        </p>

        <ol>
          <li>
            <strong>Phase 1: Pre-Commit (When Checkpoint Barrier Arrives)</strong>
            <br />
            The stream operator opens an external transaction (e.g. a PostgreSQL transaction or a Kafka transactional producer session). All emitted records are written to this pending transaction. When the checkpoint barrier arrives, the sink flushes its buffers, freezes the transaction, and informs the Checkpoint Coordinator that it has successfully <em>pre-committed</em>.
          </li>
          <li>
            <strong>Phase 2: Commit (When Coordinator Confirms Global Success)</strong>
            <br />
            Once the Checkpoint Coordinator receives success acknowledgements from <em>every</em> operator across the cluster, it broadcasts a commit notification. The sink executes <code>COMMIT</code> on the external transaction, making the records permanently visible.
          </li>
          <li>
            <strong>Failure &amp; Abort:</strong>
            <br />
            If any worker crashes before the global checkpoint succeeds, the sink rolls back (<code>ABORT</code>) the pre-committed transaction. When the worker recovers from the previous checkpoint in S3, zero duplicate writes exist in the external system.
          </li>
        </ol>

        <h2>6. Technical Implementation: Two-Phase Commit Sink in TypeScript</h2>
        <p>
          The following TypeScript implementation demonstrates the state machine of an end-to-end exactly-once Two-Phase Commit Sink coordinating with checkpoint barriers:
        </p>

        <CodeWindowCard
          title="TwoPhaseCommitSink.ts"
          code={`export interface TransactionState {
  transactionId: string;
  records: Array<{ key: string; payload: any }>;
  status: 'active' | 'pre_committed' | 'committed' | 'aborted';
}

export interface CheckpointMetadata {
  checkpointId: number;
  sourceOffsets: Record<number, number>; // partition -> offset
}

export class TwoPhaseCommitSink {
  private activeTransaction: TransactionState | null = null;
  private pendingPreCommittedTxns = new Map<number, TransactionState>();
  private readonly targetDatabase: {
    executeTransaction: (records: any[]) => Promise<void>;
  };

  constructor(targetDb: { executeTransaction: (records: any[]) => Promise<void> }) {
    this.targetDatabase = targetDb;
    this.beginTransaction();
  }

  // Invoked for every incoming stream event
  public write(key: string, payload: any): void {
    if (!this.activeTransaction) {
      this.beginTransaction();
    }
    this.activeTransaction!.records.push({ key, payload });
  }

  // Phase 1: Pre-Commit triggered when Checkpoint Barrier arrives at sink
  public async preCommit(checkpoint: CheckpointMetadata): Promise<void> {
    if (!this.activeTransaction) return;

    const currentTxn = this.activeTransaction;
    currentTxn.status = 'pre_committed';

    // Store uncommitted transaction bound to this specific Checkpoint ID
    this.pendingPreCommittedTxns.set(checkpoint.checkpointId, currentTxn);

    // Open next transaction immediately for records arriving after the barrier
    this.beginTransaction();
  }

  // Phase 2: Commit triggered when Coordinator confirms cluster-wide checkpoint success
  public async commit(checkpointId: number): Promise<void> {
    const txnToCommit = this.pendingPreCommittedTxns.get(checkpointId);
    if (!txnToCommit) return;

    try {
      // Execute atomic external database commit
      await this.targetDatabase.executeTransaction(txnToCommit.records);
      txnToCommit.status = 'committed';
      this.pendingPreCommittedTxns.delete(checkpointId);
    } catch (err) {
      console.error(\`Failed to commit transaction for checkpoint \${checkpointId}\`, err);
      throw err; // Coordinator will initiate rollback
    }
  }

  // Rollback triggered upon crash recovery or checkpoint abort
  public async abort(checkpointId: number): Promise<void> {
    const txnToAbort = this.pendingPreCommittedTxns.get(checkpointId);
    if (txnToAbort) {
      txnToAbort.status = 'aborted';
      this.pendingPreCommittedTxns.delete(checkpointId);
    }

    if (this.activeTransaction) {
      this.activeTransaction.status = 'aborted';
      this.beginTransaction();
    }
  }

  private beginTransaction(): void {
    this.activeTransaction = {
      transactionId: \`txn_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`,
      records: [],
      status: 'active',
    };
  }
}`}
        />

        <h2>7. Interactive Simulator: Stateful Checkpointing &amp; Exactly-Once</h2>
        <p>
          Experience distributed stream recovery firsthand. Ingest payment transactions, trigger <strong>Chandy-Lamport Checkpoint Barriers</strong> to snapshot local RocksDB states into S3, and crash the worker node. Observe how naive at-least-once processing causes devastating duplicate banking transactions, whereas 2PC guarantees end-to-end zero-duplicate exactly-once settlement.
        </p>

        <StatefulCheckpointSimulator />

        <AIPitfallCallout title="The 'Kafka Has Exactly-Once Built In' Myth">
          <p>
            When engineers ask AI coding assistants how to prevent duplicate writes in payment pipelines, AI models frequently respond:
          </p>
          <pre style={{ background: '#2d1515', color: '#ffc9c9', padding: '10px 14px', borderRadius: '6px', fontSize: '12px' }}>
            {`// NAIVE AI ADVICE: "Just turn on enable.idempotence=true for full Exactly-Once!"
const producer = kafka.producer({
  idempotent: true, // Only guarantees single-producer single-partition deduplication!
  maxInFlightRequestsPerConnection: 1
});`}
          </pre>
          <p>
            <strong>Why this leads to disastrous production data loss:</strong> Kafka&apos;s <code>enable.idempotence=true</code> only prevents duplicate messages sent from a single producer session to a single partition during transient network retries. It provides <strong>zero exactly-once guarantees</strong> across your downstream pipeline:
          </p>
          <ol style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            <li>If your consumer processes a message and writes to PostgreSQL, but crashes before saving its offset in Kafka, the replayed message inserts a duplicate row into PostgreSQL.</li>
            <li>If a worker suffers a Garbage Collection pause and a zombie duplicate worker spins up, Kafka idempotence cannot prevent zombie writes across consumer group rebalances without transactional producer IDs and fencing epochs.</li>
            <li><strong>Always pair transactional stream coordinators with Two-Phase Commit sinks or database unique-key deduplication filters.</strong></li>
          </ol>
        </AIPitfallCallout>

        <h2>8. Active Retrieval: Test Your Understanding</h2>
        <p>
          Solidify your understanding of distributed state, checkpoint barrier alignment, and end-to-end exactly-once semantics:
        </p>

        <Quiz
          id="quiz_0022_1"
          question="1. Why do enterprise stream processing frameworks embed RocksDB on local NVMe storage rather than querying a centralized Redis cluster?"
          options={[
            {
              text: 'Because querying a remote Redis cluster introduces network round-trip latency and socket saturation that throttles high-throughput streaming pipelines.',
              isCorrect: true,
              explanation: 'At 100,000+ QPS, network round-trips to an external database become the global bottleneck. Embedded RocksDB enables sub-millisecond local NVMe access.'
            },
            {
              text: 'Because RocksDB operates inside web browsers using WebAssembly whereas Redis cannot run on Linux servers.',
              isCorrect: false,
              explanation: 'RocksDB runs on server-side Linux infrastructure, not in browser WebAssembly.'
            },
            {
              text: 'Because Redis does not support atomic increment or hash data structures required for running balances.',
              isCorrect: false,
              explanation: 'Redis natively supports INCRBY and Hash operations; the issue is network latency and connection exhaustion.'
            },
            {
              text: 'Because cloud providers forbid network communication between worker nodes and database instances.',
              isCorrect: false,
              explanation: 'Network communication is standard in cloud VPCs; the constraint is throughput and physical latency.'
            }
          ]}
        />

        <Quiz
          id="quiz_0022_2"
          question="2. In the Chandy-Lamport / Asynchronous Barrier Snapshotting algorithm, what is the purpose of 'Barrier Alignment' when an operator consumes from multiple partitions?"
          options={[
            {
              text: 'It pauses all CPU execution across the entire cluster for 30 seconds to allow the Linux kernel to clean disk caches.',
              isCorrect: false,
              explanation: 'ABS is asynchronous and does not stop the world across the cluster.'
            },
            {
              text: 'It ensures that the operator state snapshot reflects records before the barrier from all input channels, creating a globally consistent cut.',
              isCorrect: true,
              explanation: 'Barrier alignment guarantees that records before the barrier are included in the snapshot, while records after the barrier are excluded, preventing state drift.'
            },
            {
              text: 'It encrypts all payload bytes using AES-256 before transmitting data packets across internet backbones.',
              isCorrect: false,
              explanation: 'Barrier alignment is a consistency synchronization mechanism, not a cryptographic cipher.'
            },
            {
              text: 'It automatically converts Kafka JSON messages into Apache Parquet columnar files on local disks.',
              isCorrect: false,
              explanation: 'File conversion is an analytical serialization concern, unrelated to checkpoint barrier alignment.'
            }
          ]}
        />

        <Quiz
          id="quiz_0022_3"
          question="3. Why is an external Two-Phase Commit (2PC) Sink required to achieve true End-to-End Exactly-Once Semantics (EOS) when writing to downstream systems?"
          options={[
            {
              text: 'Because without 2PC, a worker crash after writing to the sink but before acknowledging the checkpoint offset causes duplicate writes on replay.',
              isCorrect: true,
              explanation: 'Without a 2PC pre-commit/commit protocol, replay from the previous checkpoint offset will re-execute writes against the downstream store, creating duplicate transactions.'
            },
            {
              text: 'Because DNS Anycast routing cannot resolve server hostnames without two independent authoritative name servers.',
              isCorrect: false,
              explanation: 'DNS resolution is an edge networking protocol and has nothing to do with transactional stream sinks.'
            },
            {
              text: 'Because Kafka brokers will shut down automatically if an uncommitted producer connection remains idle for 5 milliseconds.',
              isCorrect: false,
              explanation: 'Brokers do not terminate connections on 5ms idle thresholds.'
            },
            {
              text: 'Because Reed-Solomon erasure coding requires two parity shards for every transactional bank write.',
              isCorrect: false,
              explanation: 'Erasure coding is a storage-layer durability technique, unrelated to application transactional commits.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0022 Review"
          promptText="I have completed Lesson 0022 on Stateful Stream Processing, Embedded RocksDB State Stores, Chandy-Lamport Checkpointing (ABS), Stream Joins, and Two-Phase Commit Sinks for End-to-End Exactly-Once. Please challenge me on how barrier alignment handles lagging straggler partitions, how stream-table joins maintain state freshness via CDC, and why Kafka idempotence alone fails to provide end-to-end exactly-once delivery."
        />

        <LessonNavButtons currentLessonId="0022" />
      </div>
    </div>
  );
};
