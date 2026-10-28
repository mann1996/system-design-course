# 0007: Reliable Event Publishing: The Dual-Write Problem & Transactional Outbox

## Context & Motivation
Following the introduction of asynchronous message queues and streams (Lesson 0006), developers encounter a critical distributed state dilemma whenever a service must both mutate local database state (e.g., PostgreSQL `INSERT INTO orders`) and publish a domain event to an external broker (e.g., Kafka `orders.created`). Because network partitions, process crashes, and unhandled errors occur without warning across disparate infrastructure, executing sequential writes creates silent, permanent data divergence.

## Key Learnings & Architectural Decisions
1. **The Dual-Write Dilemma:**
   - Writing to the database first and publishing to Kafka second leaves records in the database with missing events if the process crashes or network timeouts occur before the publish finishes.
   - Publishing to Kafka first and writing to the database second creates "phantom events" if the SQL commit subsequently aborts due to constraints or timeouts.
   - Distributed transactions (2PC / XA) across heterogeneous databases and brokers are non-viable due to blocking locks, high latency, and lack of broker support.

2. **The Transactional Outbox Solution:**
   - Both the domain entity (`orders`) and the event representation (`outbox_events`) are written within the **exact same local ACID SQL transaction**.
   - Guarantees that an event record is written to disk if and only if the business entity commits successfully.

3. **Outbox Event Dispatch Mechanisms:**
   - **Polling Publisher:** Background workers query `SELECT ... FOR UPDATE SKIP LOCKED` on the outbox table. `SKIP LOCKED` prevents concurrency collisions and lets multiple Node.js workers process separate batches in parallel.
   - **Transaction Log Tailing (CDC):** Tools like Debezium tail the database's internal Write-Ahead Log (WAL in PostgreSQL, binlog in MySQL) at the storage level, eliminating polling query overhead on the database and streaming changes with sub-millisecond latency.

4. **Guaranteed Delivery Invariants:**
   - Outbox publishing guarantees **At-Least-Once** delivery.
   - Downstream consumers must remain idempotent by checking the unique outbox event UUID against an atomic deduplication store.

## Next Steps
- Lesson 0008: Distributed Transactions, The Saga Pattern & Compensating Workflows.