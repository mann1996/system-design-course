# 0009: Distributed Rate Limiting & Overload Protection

## Context & Motivation
Stateless compute clusters and backend databases collapse under sudden credential stuffing botnets, runaway scrapers, and spike traffic. In-memory counters fail in horizontally scaled architectures. Distributed systems require atomic Redis rate limiters and CPU/event-loop aware load shedding.

## Key Learnings & Architectural Decisions
1. **In-Memory Rate Limiting Flaw:**
   - Express in-memory maps fail under round-robin load balancing because traffic is fragmented across replicas, allowing malicious clients to multiply their effective quotas. Node restarts also wipe tracking maps.
2. **Algorithm Decision Matrix:**
   - **Token Bucket:** Best for public merchant APIs; accommodates legitimate traffic bursts up to bucket capacity while refilling at a steady rate.
   - **Fixed Window Counter:** Minimal memory but suffers from the boundary doubling vulnerability (200% quota spike across window transitions).
   - **Sliding Window Counter:** Weighted combination of current and previous window counts; smooths boundaries with O(1) memory.
3. **Atomic Lua Scripts for Race Condition Elimination:**
   - Multi-instance read-modify-write races in Redis are solved by packaging counter checks and TTL expiration into atomic server-side Lua scripts.
4. **Rate Limiting vs. Load Shedding:**
   - Rate limiting protects fairness based on client quotas (returns HTTP 429).
   - Load shedding protects server survivability when internal CPU or event-loop lag exceeds saturation thresholds (returns HTTP 503).
