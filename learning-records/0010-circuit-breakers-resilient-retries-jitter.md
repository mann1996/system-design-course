# 0010: Cascading Failure Prevention: Circuit Breakers, Retries with Jitter & Deadlines

## Context & Motivation
In distributed microservices, downstream dependencies (e.g. partner bank APIs or databases) frequently become slow rather than crashing outright. Slow dependencies exhaust HTTP connection pools and worker threads, causing cascading domino outages across upstream services.

## Key Learnings & Architectural Decisions
1. **Circuit Breakers for Fault Isolation:**
   - State machine: `CLOSED` (normal traffic) &rarr; `OPEN` (fast-fail within 1–2ms after failure rate breaches threshold, saving socket pools) &rarr; `HALF-OPEN` (canary probes to verify health).
2. **Retry Storms & Full Jitter Exponential Backoff:**
   - Naive immediate retries or deterministic exponential retries cause synchronized waves of requests that crash recovering services.
   - **Full Jitter Formula:** $t = \text{random}(0, \min(M, B \times 2^i))$ smoothly spreads load uniformly across time, preventing retry spikes.
3. **End-to-End Deadline Budgets:**
   - Downstream workers must not execute expensive queries on requests that the client has already abandoned.
   - Propagate deadlines via HTTP headers (`X-Request-Deadline`) and abort in-flight work with `AbortController`.
