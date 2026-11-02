# 0012: Distributed Locking & Consensus: Redlock, Fencing Tokens & Leader Election

## Context & Motivation
Distributed systems frequently need to coordinate mutual exclusion across nodes—either to prevent duplicate work (locks for efficiency) or prevent state corruption (locks for correctness). However, asynchronous networks, garbage collection pauses, and clock drift make distributed locking treacherous. Relying purely on TTL expiration without storage-level verification leads to silent data corruption via the &ldquo;Zombie Client&rdquo; race condition.

## Key Learnings & Architectural Decisions
1. **The Zombie Client Race Condition (Martin Kleppmann vs. Redlock):**
   - In an asynchronous network model, process execution pauses (stop-the-world GC, VM freeze, page faults) are unbounded.
   - Scenario: Worker A acquires a 10s TTL lock on a shared resource, reads state, and then suffers a 12s GC pause. The lock expires in Redis. Worker B acquires the lock, updates state, and commits to storage. Worker A wakes up unaware its lock expired and writes its stale calculation, silently corrupting Worker B's fresh data.
   - **Conclusion:** A distributed lock alone cannot guarantee safety for storage writes.

2. **Monotonic Fencing Tokens:**
   - Every lock acquisition must return a monotonically increasing sequence number (e.g. 41, 42, 43).
   - Storage engines (PostgreSQL, DynamoDB, S3) must validate the token upon every write:
     `UPDATE accounts SET balance = :val, fencing_token = :token WHERE id = :id AND fencing_token < :token;`
   - If a zombie client attempts to write with an older token, the storage engine rejects the write, guaranteeing consistency despite process pauses or network delays.

3. **Safe Lock Release via Atomic Lua Scripts:**
   - Blindly deleting a lock with `redis.del(key)` allows a slow worker to delete a freshly acquired lock belonging to another worker.
   - Lock release MUST use an atomic Lua script comparing the unique owner UUID before executing `DEL`.

4. **Heartbeat Lease Extension:**
   - While a worker is actively processing, a background heartbeat interval (`setInterval` unref'd) renews the TTL lease (`PEXPIRE`) every $TTL / 3$ milliseconds to prevent premature expiry during heavy CPU load.

5. **Efficiency vs. Correctness (Redis vs. etcd/Raft):**
   - **Efficiency (Best Effort):** Non-critical tasks (cron jobs, cache warming) can use Redis locks (`SET key owner NX PX ttl`).
   - **Correctness (Data Integrity & Leader Election):** Critical master coordination requires linearizable consensus engines (etcd or ZooKeeper) using Raft or ZAB with quorum writes, preventing split-brain when primary nodes fail.

## Next Steps
- Milestone 5 Practical Test: Global Financial Ledger & Distributed Lock Coordinator.
