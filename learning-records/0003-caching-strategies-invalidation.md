# 0003: Caching Strategies & Distributed Invalidation

## Context & Motivation
Following Lesson 0002 (Stateless Compute & Horizontal Scaling), application servers can scale horizontally, but database disks remain the fundamental bottleneck under heavy read and write traffic. In this lesson, we established foundational patterns to protect persistent databases using in-memory caching tiers (Redis/Memcached).

## Key Learnings & Decisions
1. **Latency & Throughput Contrast:**
   - In-memory key-value lookups (Redis) operate in <0.5ms and sustain >100,000 QPS per node.
   - Relational disk reads (PostgreSQL) typically cap at 2,000–5,000 QPS with 10–50ms latency.
2. **Caching Topologies:**
   - **Cache-Aside (Lazy Loading):** Application queries cache first; populates on miss. Writes update DB and **evict (delete)** the cache key. Best for read-heavy workloads with intermittent updates.
   - **Write-Through:** Synchronously updates cache and DB before responding. Guarantees consistency at the cost of higher write latency.
   - **Write-Behind (Write-Back):** Writes to cache and flushes asynchronously to DB. Maximizes write throughput, but risks data loss during ungraceful restarts.
3. **The Evict vs. Update Rule:**
   - Always **delete (evict)** the cache key on update rather than setting new data. This prevents out-of-order race conditions from permanently leaving stale data in cache.
4. **Three Classic Cache Catastrophes:**
   - **Cache Stampede (Thundering Herd):** Solved via Single-Flight / Mutex Locking (in-process promise deduping or distributed locks) and probabilistic early expiration.
   - **Cache Penetration:** Solved by caching null values with short TTLs and employing Bloom Filters.
   - **Cache Avalanche:** Solved by applying uniform random jitter to TTL durations.

## Next Steps
- Lesson 0004: Relational Databases vs NoSQL, Replication Topologies, and Read Replicas (Scaling the persistent state layer).
