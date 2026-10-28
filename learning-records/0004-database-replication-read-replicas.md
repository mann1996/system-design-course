# 0004: Scaling the Database — Replication, Read Replicas & Failover

## Context & Motivation
Following Lesson 0003 (Caching Strategies & Invalidation), an in-memory caching tier absorbs frequent read operations, but all cache misses, cache-aside backfills, and transactional writes inevitably terminate at the persistent database layer. Persistent state cannot be scaled trivially like stateless Node.js workers because uncoordinated writes cause disk divergence and data corruption.

## Key Learnings & Architectural Decisions
1. **Single-Leader (Primary-Replica) Topology:**
   - Only **one** primary instance handles all data mutations (`INSERT`, `UPDATE`, `DELETE`).
   - Replicas continuously ingest and execute the primary's Write-Ahead Log (WAL), servicing read-only (`SELECT`) queries.
   - Read capacity scales horizontally with replica count; write capacity remains bounded by the primary's single-node I/O and CPU limits.

2. **Sync vs. Async Trade-offs:**
   - **Synchronous:** Primary blocks client response until replica disk write confirms. Zero data loss (RPO = 0), but high latency and severe availability vulnerability (if replica hangs, writes halt).
   - **Asynchronous:** Primary responds immediately after local commit. Ultra-low latency, but risks data loss during ungraceful primary crashes.
   - **Semi-Synchronous:** Primary blocks on at least one synchronous follower, combining guaranteed durability with high availability.

3. **Replication Lag Anomalies:**
   - **Read-Your-Own-Writes:** A user submits an update and is redirected, but the subsequent read lands on a lagging replica, presenting stale data. *Mitigation:* Pin recent-writer queries to the primary node for a fixed time window (~60s) or track commit LSN in user session tokens.
   - **Monotonic Reads:** Consecutive refreshes toggle between up-to-date and lagged replicas, causing state to appear to travel backwards in time. *Mitigation:* Consistent hashing on `userId` to route the user's read requests consistently to the same follower.
   - **Consistent Prefix Reads:** Causal ordering inverted. *Mitigation:* Causally linked transactions must share the same partition and replication log.

4. **Connection Pooling Architecture:**
   - PostgreSQL allocates a dedicated OS process per connection (~10MB overhead).
   - Unmitigated container pools (`pg.Pool` with dozens of workers) exhaust Postgres connection ceilings (`sorry, too many clients already`).
   - Production requirement: Intermediate connection poolers (PgBouncer, AWS RDS Proxy) in transaction pooling mode.

5. **Failover & Split-Brain Prevention:**
   - Failover requires cluster consensus (e.g., 3-node Raft/etcd quorum) to detect genuine primary loss.
   - Guard against split-brain via **fencing tokens** (monotonically increasing epoch IDs) and **STONITH** to forcibly isolate deposed primaries.

## Next Steps
- Lesson 0005: Database Partitioning & Sharding (Scaling write throughput beyond a single primary).
