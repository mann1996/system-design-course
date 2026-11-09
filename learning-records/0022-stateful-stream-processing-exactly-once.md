# Learning Record 0022: Stateful Stream Processing, Checkpointing & Exactly-Once Semantics

- **Learner Context**: Senior-track engineer mastering fault-tolerant stateful stream computation, embedded RocksDB LSM storage, distributed snapshot algorithms, and end-to-end transactional sinks.
- **Topic**: Local state management architectures (Heap vs Embedded RocksDB on NVMe), Chandy-Lamport Distributed Snapshotting / Asynchronous Barrier Snapshotting (ABS), Stream-Table vs Stream-Stream joins, and End-to-End Exactly-Once Semantics (EOS) via Two-Phase Commit (2PC) sinks.

## Core Conceptual Breakthroughs

1. **Stateful Streaming vs Stateless Transformation**:
   - Stateless transformations (`map`, `filter`) require zero persistence across records.
   - High-value distributed tasks (running account balances, velocity fraud detection, sessionization, deduplication) require durable working state.
   - Maintaining state in memory without persistence causes catastrophic data corruption or lost balances upon Kubernetes pod restarts or container reschedules.

2. **State Storage Architecture: Why Embedded RocksDB Wins**:
   - *Remote Database Queries (PostgreSQL / Redis)*: Introduces a 1–5 ms network round-trip per record. At 100,000+ stream QPS, socket exhaustion and network bandwidth become the global bottleneck, collapsing downstream databases.
   - *Heap State (V8 Heap / JVM RAM)*: Nanosecond access time, but strictly bounded by RAM limits (16 GB). Large states cause Stop-The-World GC pauses and OOM container kills.
   - *Embedded RocksDB on Local NVMe*: High-performance embedded LSM-tree writing to local SSDs. Leverages OS page cache for hot reads and sequential append for writes. Bounded only by local disk capacity (terabytes), making it the gold standard for high-throughput stateful streaming.

3. **Fault Tolerance: The Chandy-Lamport Distributed Snapshot (ABS)**:
   - Traditional "stop-the-world" checkpoints freeze live streaming ingestion, causing massive latency spikes.
   - *Asynchronous Barrier Snapshotting (ABS)*: Checkpoint barriers are injected into Kafka partitions by the coordinator and flow down the operator DAG interleaved with data records.
   - *Barrier Alignment*: When an operator consumes from multiple upstream partitions, it aligns barriers across all input channels before capturing its local RocksDB state cut.
   - Local state files are uploaded asynchronously to cloud object storage (Amazon S3 / MinIO).
   - Upon node crash, operators restore RocksDB state files from S3 and rewind Kafka consumer offsets to the exact barrier boundary.

4. **Stream Joins: Correlating Distributed Event Flows**:
   - *Stream-Table Join (Enrichment)*: Joins high-velocity transaction events with slowly changing dimension tables (e.g. merchant profile) streamed via Change Data Capture (CDC / Debezium) and indexed in local RocksDB without querying the primary database.
   - *Stream-Stream Join (Interval Join)*: Joins two independent unbounded streams (ad impressions and ad clicks) within an explicit temporal interval window ($t_{\text{impression}} \le t_{\text{click}} \le t_{\text{impression}} + 1 \text{ hour}$) using stateful buffered retention.

5. **End-to-End Exactly-Once Semantics (EOS) via Two-Phase Commit (2PC)**:
   - *The AI Trap ("Kafka idempotence gives EOS")*: `enable.idempotence=true` only prevents single-producer single-partition duplicates on retry; it does NOT prevent duplicate writes into downstream databases or APIs when consumers crash and replay messages.
   - *The Two-Phase Commit (2PC) Sink*:
     - *Phase 1 (Pre-Commit)*: Emitted records are written to an open transaction. When the checkpoint barrier arrives, the sink flushes its buffer, marks the transaction as pre-committed, and notifies the coordinator.
     - *Phase 2 (Commit)*: Once all operators across the cluster acknowledge checkpoint success, the coordinator instructs the sink to commit the external transaction.
     - *Crash Recovery*: If a node crashes before global checkpoint confirmation, the pre-committed transaction is aborted (rolled back), guaranteeing zero duplicate financial mutations.
