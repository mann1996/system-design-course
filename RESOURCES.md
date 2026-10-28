# Advanced System Design & Software Architecture Resources

## Knowledge

- [Book: _Designing Data-Intensive Applications_ by Martin Kleppmann](https://dataintensive.net/)
  The foundational and most authoritative text on modern distributed data systems. Use for: data models, replication, partitioning, transactions, consensus, and batch/stream processing.
- [Book Series: _System Design Interview_ (Vols 1 & 2) by Alex Xu & Sahn Lam](https://bytebytego.com/)
  Structured, pragmatic decomposition of end-to-end production systems. Use for: back-of-the-envelope estimation, architectural component layout, and trade-off matrices.
- [Library: _The Amazon Builders' Library_](https://aws.amazon.com/builders-library/)
  Deep operational articles written by AWS principal engineers and distinguished fellows. Use for: real-world distributed failure modes, leader election, shuffle sharding, retries/exponential backoff, and load shedding.
- [Engineering Blog: _Discord Engineering Blog_](https://discord.com/category/engineering)
  Exceptional modern case studies in scaling Node/TypeScript, Rust, ScyllaDB, and real-time state synchronization to millions of concurrent users. Use for: real-world migration stories, hot partition avoidance, and zero-downtime scaling.
- [Book: _Patterns of Enterprise Application Architecture_ by Martin Fowler](https://martinfowler.com/books/eaa.html)
  Classic patterns for domain logic, data mapping, and web presentation. Use for: transitioning from macro distributed systems to clean micro/modular software boundaries.

## Wisdom (Communities)

- [r/systemdesign](https://reddit.com/r/systemdesign)
  Moderated community discussing architectural trade-offs, whitepapers, and interview-level design problems. Use for: peer critique of proposed architectural topologies.
- [Lobste.rs (Tag: #distributed)](https://lobste.rs/t/distributed)
  High-signal developer community with strict moderation focused on systems programming, distributed protocols, and architecture. Use for: discussions on deep technical trade-offs and cutting-edge postmortems.
- [Pragmatic Engineer Newsletter & Forum by Gergely Orosz](https://newsletter.pragmaticengineer.com/)
  Industry-standard perspectives on engineering leadership, real-world tech stacks, and how high-performing teams make architecture decisions. Use for: understanding how senior engineers write and defend RFCs.

## Gaps

- TypeScript-native distributed system patterns: Many classic distributed systems books use Java/C++ or abstract pseudocode. We will provide explicit TypeScript/Node.js bridges for async concurrency, event loop limits, and connection pool dynamics.
