# Learning Record 0018: High-Throughput Analytics & Columnar Storage

- **Learner Context**: Senior-track engineer mastering Online Analytical Processing (OLAP), ClickHouse architecture, columnar physical layouts, and vectorized SIMD execution.
- **Topic**: Row-oriented vs Columnar layouts, projection pruning, column compression (RLE, Delta, Dictionary), sparse primary indexes with granule marks (8,192 rows), SIMD vectorized execution, and micro-batch ingestion pipelines.

## Core Conceptual Breakthroughs

1. **The Row-Oriented (OLTP) Bottleneck in Analytics**:
   - In relational databases (PostgreSQL/MySQL), physical disk pages store entire tuples contiguously. For a table with 10 columns (120 bytes/row), executing `SELECT country, sum(revenue) GROUP BY country` requires loading all 120 bytes of every row from disk into the buffer pool, even though only 6 bytes per row (5%) are needed.
   - On 100,000,000 rows, this forces reading 12 Gigabytes of disk data to process 600 Megabytes of values, thrashing the buffer pool and saturating disk IOPS.

2. **Columnar Layout & Projection Pruning**:
   - Columnar engines (ClickHouse, Apache Druid, Parquet) store each table column in separate contiguous files (`country.bin`, `revenue.bin`).
   - *Projection Pruning*: The query engine opens strictly the column files referenced in the query. Unqueried columns (`user_agent.bin`, `ip.bin`) are never opened or loaded into memory, eliminating 90%–95% of disk I/O.

3. **Homogeneous Column Compression**:
   - Because each column file contains billions of values of the exact same data type sorted in order, specialized compression algorithms achieve 10x–25x compression ratios:
     - *Run-Length Encoding (RLE)*: For low-cardinality sorted columns (`["US" x 50,000]`), stores `("US", 50000)` in 6 bytes instead of 100 KB (16,000x reduction).
     - *Delta & Double-Delta Encoding*: Stores differences between consecutive monotonic timestamps/integers (`+2ms, +3ms`), packing into 2-bit or 4-bit representations.
     - *Dictionary Encoding*: Replaces repetitive strings with 1-byte integer IDs backed by an in-memory dictionary.

4. **Sparse Primary Indexes vs. Dense B-Trees**:
   - Relational B-Trees are dense (1 index pointer per row). For 5,000,000,000 rows, a dense B-Tree consumes >150 GB of RAM.
   - ClickHouse divides data into *Granules* (8,192 physical rows per granule). The sparse primary index stores exactly *one index mark per granule* (the min/max primary key values).
   - The entire sparse primary index for 1,000,000,000 rows takes less than 25 MB of RAM. ClickHouse binary searches sparse marks in RAM, skipping 90%+ of non-matching disk granules before reading disk blocks.

5. **Vectorized Execution (SIMD) vs. Volcano Iterators**:
   - Traditional databases use the Volcano Iterator model (`while (row = next()) process(row);`), incurring massive function call overhead, CPU branch mispredictions, and instruction cache thrashing (~2–8 million rows/sec).
   - ClickHouse processes entire vectors of 8,192 values in tight CPU cache loops using SIMD instructions (AVX-512 / ARM NEON), evaluating 16 operations per clock cycle and processing >150,000,000 rows/sec per core.

6. **The "Too Many Parts" Write Hazard**:
   - Like LSM-Trees, ClickHouse MergeTree writes create immutable disk part directories. Single-row inserts (`INSERT INTO ... VALUES (...)`) at 5,000 QPS generate 5,000 unmerged parts per second, crashing the engine with `DB::Exception: Too many parts in all data parts in table`.
   - *Production Mandate*: Ingestion must be buffered into micro-batches of 10,000 to 100,000 rows (or 1–5 second intervals) client-side or streamed via Kafka before writing to ClickHouse.
