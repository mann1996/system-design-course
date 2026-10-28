# 0008: Distributed Transactions: The Saga Pattern & Compensating Workflows

## Context & Motivation
Once distributed services publish events reliably via the Transactional Outbox pattern (Lesson 0007), complex business operations (such as e-commerce checkout, trip booking, or financial transfers) span multiple independent microservices, each with its own private database. Because Two-Phase Commit (2PC) creates blocking locks and single points of failure across network boundaries, systems coordinate distributed state using the Saga Pattern and eventual consistency.

## Key Learnings & Architectural Decisions
1. **The Death of 2PC / XA in Distributed Microservices:**
   - 2-Phase Commit requires all database participants to hold row locks across network round-trips until the coordinator issues a global commit.
   - If the coordinator or network partitions during the prepare phase, participating tables remain locked indefinitely, stalling cluster operations.
   - 2PC sacrifices availability and partition tolerance, violating the CAP theorem.

2. **The Saga Pattern & Semantic Compensations:**
   - A Saga breaks a distributed transaction into a sequence of local transactions: $T_1, T_2, \dots, T_n$.
   - If any step fails, the Saga invokes backward compensating transactions: $C_{k-1}, \dots, C_1$ in reverse order to semantically undo preceding state changes.
   - Compensations are **semantic forward operations** (e.g., refunding money, restocking inventory, sending cancellation notifications), not database rollbacks.
   - Compensating transactions must be engineered to be strictly **idempotent** and retry until success.

3. **Choreography vs. Orchestration:**
   - **Choreography (Event-Driven):** Decentralized pub/sub. Best for simple workflows (2–3 steps), but suffers from distributed spaghetti and obscure overall state.
   - **Orchestration (Command-Driven):** Centralized state machine (e.g. Temporal, Step Functions, or custom Node.js orchestrator) sending explicit commands. Provides explicit state tracking, clear error boundaries, and straightforward timeout management.

4. **Managing Lack of Isolation:**
   - Sagas provide ACD (Atomicity, Consistency, Durability) but lack Isolation ('I'). Intermediate states are visible to external queries.
   - Countermeasures: Semantic locking (marking entities `PENDING_APPROVAL`), commutative updates, and reservation time-to-live (TTL) limits.

## Next Steps
- Module 4: System Edge, API Gateways, Rate Limiting & Distributed Resilience.