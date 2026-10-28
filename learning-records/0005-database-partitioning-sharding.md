# 0005: Database Partitioning, Sharding & Consistent Hashing

## Context & Motivation
Following Lesson 0004 (Database Replication & Read Replicas), read capacity can be expanded horizontally by attaching read replicas, but write throughput remains strictly bounded by the single Primary node's disk I/O and CPU. Furthermore, single database instances hit hardware limits when datasets exceed 5–10TB. Sharding (horizontal partitioning) splits monolithic datasets across multiple independent database clusters to unlock unlimited write throughput and storage capacity.

## Key Learnings & Architectural Decisions
1. **Partitioning Schemes & Trade-offs:**
   - **Range-Based Partitioning:** Divides contiguous key ranges across nodes. Enables rapid local range scans (`WHERE created_at BETWEEN ...`), but creates devastating write hotspots if keys increase monotonically with time.
   - **Hash-Based Partitioning:** Applies a uniform hash function to the partition key. Distributes data uniformly, eliminating hotspots, but converts multi-key range scans into expensive cluster-wide Scatter-Gather operations.

2. **The Modulo Hazard vs. Consistent Hashing:**
   - Naive `hash(key) % N` causes an architectural disaster during cluster rebalancing: scaling from $N$ to $N+1$ nodes invalidates &asymp; $\frac{N}{N+1}$ ($>80\%$) of all key mappings.
   - **Consistent Hashing:** Arranges nodes and keys on a continuous circular ring ($0$ to $2^{32}-1$). Adding or removing a node remaps only $\frac{1}{N}$ of keys to adjacent neighbors, preserving cluster stability.

3. **Partition Key Selection Criteria:**
   - High Cardinality: Must provide millions of distinct values (e.g., `tenantId`, `userId`, `orderId`).
   - Query Co-location: Co-locating related entity tables (e.g., users, orders, invoices) under the same partition key (`tenantId`) preserves single-node transactional integrity and relational joins.
   - Even Write Distribution: Prevents hot partition saturation.

4. **The Hotspot (Celebrity) Mitigation:**
   - Extreme key skew (e.g., viral accounts or mega tenants) can be mitigated by **Key Salting** (appending a random bounded suffix like `#0` to `#9`), spreading writes across multiple shards at the cost of Scatter-Gather fanout on read.

5. **Operational Costs of Sharding:**
   - Cross-shard joins are eliminated; joins must be orchestrated in application memory (e.g., Node.js service layer).
   - Distributed multi-shard transactions require Two-Phase Commit (2PC) or asynchronous Eventual Consistency (Saga Pattern / Transactional Outbox).
   - Always exhaust vertical scaling, caching, and read replicas before taking on the operational overhead of sharding.

## Next Steps
- Lesson 0006: Asynchronous Architectures & Message Queues (Decoupling services with RabbitMQ / Kafka, Pub/Sub, and Backpressure).
