# Learning Record 0017: Distributed Search Engines, Inverted Indexes & Shard Routing

- **Learner Context**: Senior-track engineer mastering distributed search engine internals, Lucene storage mechanics, and multi-tenant indexing at scale.
- **Topic**: Inverted indexes, Term Dictionary (FST), Postings Lists compression (Frame of Reference), Lucene segment immutability, Query Phase (Scatter) vs Fetch Phase (Gather), shard routing keys (`_routing`), and deep pagination hazards.

## Core Conceptual Breakthroughs

1. **The Structural Failure of Relational B-Trees for Text Search**:
   - Relational B-Tree indexes map rows to column values in $O(\log N)$ time. However, substring queries with leading wildcards (`WHERE description LIKE '%wireless headphones%'`) cannot traverse B-Trees and force complete Full Table Scans across millions of rows, saturating disk IOPS.
   - An *Inverted Index* reverses the data mapping: it maps terms to sorted arrays of Document IDs (Postings Lists). Multi-term queries (`"wireless" AND "headphones"`) resolve via memory-speed intersection of sorted integers using Skip Lists in $O(\log N)$ time without touching row data on disk.

2. **The Lucene Storage Hierarchy & Segment Immutability**:
   - *In-Memory Index Buffer & Translog*: Writes append to an in-memory buffer and write-ahead log (Translog) concurrently for crash durability.
   - *Refresh vs Flush*: Refresh occurs every 1 second, flushing the memory buffer into an immutable Lucene segment in the OS Page Cache (making documents searchable in Near-Real-Time). Flush occurs periodically (e.g. every 30 minutes or 512 MB), executing an `fsync` to permanent NVMe disk.
   - *Immutability & Soft Deletes*: Lucene segments are strictly write-once and immutable. `DELETE` operations write a bit to an auxiliary `.del` bitset tombstone; `UPDATE` operations execute a soft delete followed by a new insert.
   - *Tiered Merge Policy*: Background threads merge small segments into larger contiguous segments, physically purging deleted tombstones and re-optimizing postings lists.

3. **Scatter-Gather Coordination vs. Targeted Shard Routing**:
   - By default, documents hash randomly across shards: `murmur3(doc_id) % num_shards`.
   - Every query must execute a two-phase *Scatter-Gather*:
     - *Query Phase (Scatter)*: The coordinating node broadcasts the search request to a copy of every shard in the cluster. Each shard evaluates the query locally, builds a priority queue of size $(from + size)$ sorted by BM25 relevance score, and returns only doc IDs and scores.
     - *Fetch Phase (Gather)*: The coordinator merge-sorts shard priority queues, discards the first $from$ items, selects the top $size$ doc IDs, and issues point `GET` requests to specific shards for full `_source` payloads.
   - *The Routing Key Optimization*: In multi-tenant systems, setting `_routing=merchant_id` colocates all documents for a tenant onto a single predictable shard. The coordinating node routes the query directly to that single shard, bypassing the 40-shard scatter-gather broadcast and slashing cluster CPU and network overhead by >90%.

4. **Staff-Level Pitfalls: Deep Pagination & Mapping Explosions**:
   - *The Deep Pagination Hazard (`from: 100000, size: 20`)*: Each shard must collect 100,020 documents into RAM and ship them over the internal network. The coordinating node must merge-sort hundreds of thousands of documents in JVM heap before discarding all but 20, triggering Stop-The-World GC pauses and OOM heap crashes. *Fix*: Enforce cursor-based `search_after` using Doc Values sort keys ($O(1)$ memory).
   - *Dynamic Mapping Explosions*: Unchecked client JSON keys generate thousands of dynamic Lucene field mappings. Because cluster state is synchronized across all nodes in RAM, this causes cluster state serialization freezes. *Fix*: Enforce `"dynamic": "strict"`.
