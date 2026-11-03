# 0013: Storage Engine Internals: LSM-Trees vs B-Trees, Write Amplification & Bloom Filters

## Context & Motivation
High-scale ingestion systems (IoT telemetry, logging backends, time-series metrics, clickstream feeds) easily push tens of thousands of writes per second. Traditional relational databases backed by B+Tree indexes (PostgreSQL, MySQL InnoDB) suffer catastrophic throughput collapse under random write surges due to in-place page updates, buffer pool thrashing, and high write amplification. Understanding the Log-Structured Merge-Tree (LSM-Tree) architecture allows senior architects to design ingestion tiers that sustain millions of writes per second while eliminating read amplification via Bloom filters.

## Key Learnings & Architectural Decisions
1. **The In-Place Update Bottleneck (B+Trees):**
   - B+Trees organize data into fixed-size disk pages (typically 4 KB or 16 KB).
   - Updating a single 40-byte row requires overwriting an entire 16 KB page on disk, in addition to writing the WAL.
   - The Write Amplification Factor (WAF = bytes written to physical disk / logical user bytes) frequently reaches 100× to 400×.
   - When random inserts land across leaf pages exceeding RAM capacity, disk IOPS is completely saturated, leading to severe checkpoint stalls and latency spikes.

2. **The LSM-Tree Ingestion Pipeline:**
   - **Sequential WAL:** Crash durability is guaranteed by appending every operation sequentially to an append-only disk log (0 random seeks).
   - **In-Memory MemTable:** Key-value pairs are inserted into a sorted in-memory structure (concurrent SkipList or Red-Black Tree) in RAM ($O(\log N)$ in nanoseconds).
   - **Immutable SSTables (Sorted String Tables):** When the MemTable hits its memory budget (e.g., 32 MB–64 MB), it is frozen and flushed to disk as an immutable SSTable with sorted data blocks and an in-memory sparse index.
   - Overwrites append higher version numbers; deletions append a **Tombstone** marker.

3. **Read Amplification & The Bloom Filter Guardrail:**
   - Reading keys requires checking the MemTable, followed by SSTables from youngest to oldest (L0 to Ln).
   - For non-existent keys, the engine risks reading every single SSTable on disk (massive Read Amplification).
   - **Bloom Filters in RAM:** A probabilistic bit array with $k$ hash functions guarantees **zero false negatives**. If the Bloom filter returns negative, the key is 100% guaranteed not to exist in that SSTable, completely skipping the disk read.
   - Sizing: ~10 bits per key with $k = 7$ yields a 1% false positive rate, saving 99% of unnecessary disk seeks in RAM.

4. **Compaction Strategies & The RUM Conjecture:**
   - **Size-Tiered Compaction (STCS):** Merges SSTables of similar sizes. Excellent for high write throughput, but requires high disk space headroom (up to 50% space amplification).
   - **Leveled Compaction (LCS):** Divides disk into geometric levels ($L_0, L_1, L_2$) with non-overlapping key ranges in $L_1+$. Drastically reduces read and space amplification at the expense of higher write amplification during merges.
   - **RUM Conjecture:** Storage engines must balance Read overhead, Update overhead, and Memory/Space overhead. LSM-trees prioritize Update throughput ($O(1)$ sequential appends) at the cost of Read overhead (mitigated by Bloom filters and sparse indexes).

## Next Steps
- Lesson 0014: Distributed Object & Blob Storage: S3 Architecture, Chunking & Erasure Coding.
