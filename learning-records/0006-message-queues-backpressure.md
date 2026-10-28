# 0006: Asynchronous Processing, Message Queues & Backpressure

## Context & Motivation
Following the database scaling modules (Caching, Replication, Sharding), system bottlenecks shift to synchronous inter-service communication. When web services make synchronous HTTP/REST or gRPC calls to multiple downstream dependencies or 3rd-party APIs, $P99$ tail latency compounds exponentially ($1 - (0.99)^N$), and any downstream slowdown starves upstream connections and causes cascading cluster collapse. Asynchronous message queuing and event streaming decouple ingestion from execution.

## Key Learnings & Architectural Decisions
1. **The Synchronous Coupling Trap:**
   - Synchronous fan-out couples availability ($A_{sys} = \prod A_i$) and inflates tail latency.
   - Microservices should immediately respond with `202 Accepted` and offload long-running or unreliable external work to durable message brokers.

2. **Message Queues vs. Log-Based Event Streams:**
   - **Point-to-Point / AMQP (RabbitMQ, SQS):** Destructive consumption. Messages are acknowledged (`ACK`) and deleted. Suited for discrete transactional tasks, worker pool load balancing, and background jobs.
   - **Append-Only Event Streams (Kafka, Redpanda):** Non-destructive streaming. Events are persisted to partitioned logs and retained for days/months. Consumers track their own offsets and can replay history. Suited for event sourcing, state synchronization, and stream analytics.

3. **Node.js Flow Control & Backpressure:**
   - Because of Node.js's asynchronous non-blocking event loop, brokers will flood the process with thousands of messages via TCP.
   - Explicitly configuring prefetch (`channel.prefetch(N)`) limits in-flight unacknowledged jobs to prevent V8 heap exhaustion and `JavaScript heap out of memory` crashes.

4. **At-Least-Once Delivery & Consumer Idempotency:**
   - Distributed systems default to At-Least-Once delivery due to unpreventable network drops during consumer `ACK` transmission.
   - Consumers must enforce idempotency using unique idempotency keys checked against an atomic store (Redis `SET NX` or SQL unique constraints).

5. **Poison Pill Mitigation & DLQ:**
   - Failed unrecoverable jobs must not be blindly re-queued to the head (`nack(true)`), which induces infinite crash loops.
   - Implement exponential retry backoff queues with dead-letter queue (DLQ) isolation for manual inspection and alerting.

## Next Steps
- Lesson 0007: Event-Driven Architecture, Transactional Outbox Pattern & Distributed Sagas.
