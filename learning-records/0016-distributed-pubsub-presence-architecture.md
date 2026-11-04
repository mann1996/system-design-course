# Learning Record 0016: Distributed Pub/Sub & Presence Architecture

- **Learner Context**: Senior-track engineer mastering large-scale real-time systems and presence topologies.
- **Topic**: Cross-node WebSocket routing, message bus evaluation (Redis vs NATS vs Kafka), Redis Sorted Set presence, zombie connection pruning, and broadcast storm elimination.

## Core Conceptual Breakthroughs

1. **The Cross-Node Routing Dilemma**:
   - In single-node environments, routing is a local memory map lookup (`Map<UserId, WebSocket>`). In distributed clusters, Alice is on Pod 1 and Bob is on Pod 2 behind an L4 load balancer.
   - Point-to-point inter-pod TCP full meshes create an unsustainable $O(N^2)$ explosion ($N(N-1)/2$ connections; 150 pods = 11,175 persistent internal links).
   - The decoupled Pub/Sub architecture: Gateway pods subscribe to Redis Pub/Sub or NATS subjects (`user:{userId}`). Messages publish to the bus with $O(1)$ producer cost and deliver only to the pod hosting the target socket.

2. **Message Bus Selection Trade-Offs**:
   - *Redis Pub/Sub*: Ephemeral, fire-and-forget, sub-millisecond latency. Zero disk persistence. Fits ephemeral chat routing, typing indicators, and presence pings.
   - *Apache Kafka*: Durable, partitioned log with 5–25ms batching. Topic-per-user antipattern: creating millions of Kafka topics destroys the KRaft/Zookeeper metadata layer and exhausts JVM heap. Use Kafka for permanent chat message archives, not ephemeral socket fan-out.
   - *NATS Core*: Subject-based wildcard routing, ultra-low memory footprint, written in Go. Ideal for multi-region clustering and high-QPS ephemeral pub/sub.

3. **Ephemeral Presence & Zombie Sockets**:
   - Mobile devices routinely disconnect without sending a TCP `FIN` packet (tunnels, dead batteries). These half-open "zombie sockets" persist indefinitely in kernel memory.
   - Guardrail: Require 30s heartbeat pings from clients.
   - *The Redis Sorted Set (ZSET) Pattern*: Avoid storing millions of individual Redis keys with TTLs (high memory metadata overhead + dangerous `KEYS *` blockages). Use a single ZSET `ZADD presence:online <epoch_ms> <userId>`.
   - Purge dead connections atomically with a background worker running `ZREMRANGEBYSCORE presence:online 0 <now - 45s>`.

4. **Eliminating the O(N × M) Presence Broadcast Storm (The Discord Lesson)**:
   - Naive broadcast: Pushing status changes to all friends/guild members generates billions of events per second during peak hours ($N \times M$ message flood), overloading Redis and burning mobile bandwidth.
   - *The Modern Viewport / Lazy Fetch Pattern*: Status updates quietly into Redis Sorted Sets without member broadcasts. Clients only subscribe to presence for contacts currently visible on their screen viewport (30–50 members). When scrolling, the client requests the next viewport window. This slashes network egress by >99.5%.
