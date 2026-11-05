import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { ColumnarAnalyticsSimulator } from '../../components/Simulators/ColumnarAnalyticsSimulator';

export const Lesson0018: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0018"
            lessonBadge="Lesson 0018"
            moduleBadge="Module 8: Search &amp; Analytics"
            time="25 mins"
            tag="OLAP Sim"
          />
          <h1>High-Throughput Analytics &amp; Columnar Storage: OLAP Architecture, ClickHouse &amp; Vectorized Execution</h1>
          <p className="lead-text">
            Why does executing an aggregation query like <code>SELECT country, sum(revenue) GROUP BY country</code> across 200,000,000 rows grind PostgreSQL to a dead halt, while columnar engines like ClickHouse, Apache Druid, and Snowflake return results in 40 milliseconds? Master Online Analytical Processing (OLAP): row-oriented versus columnar layouts, projection pruning, column compression, sparse primary indexes with granule marks, and SIMD vectorized execution.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0018" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 3: &ldquo;Storage and Retrieval &ndash; Column-Oriented Storage, Column Compression, and Memory-Efficient Analytics&rdquo;; Alex Xu and Sahn Lam, <em>System Design Interview &ndash; An Insider&apos;s Guide: Volume 2</em>, Chapter 9: &ldquo;Ad Click Event Aggregation / Real-time Analytics&rdquo;; ClickHouse Architecture Documentation: &ldquo;MergeTree Engine Family, Sparse Primary Indexes, and Vectorized Execution&rdquo;; and Daniel Lemire et al., &ldquo;Fast Integer Compression in Memory.&rdquo;
            </p>
          }
        />

        <h2>1. The Analytical Bottleneck: OLTP vs. OLAP</h2>
        <p>
          Software systems broadly divide into two fundamentally incompatible data access patterns:
        </p>
        <ul>
          <li>
            <strong>OLTP (Online Transaction Processing):</strong> High concurrency (thousands of QPS), low latency (&lt;10ms), touching small numbers of records by primary key (e.g., <code>UPDATE users SET balance = balance - 50 WHERE id = 101</code>). Handled by relational databases like PostgreSQL, MySQL, and CockroachDB.
          </li>
          <li>
            <strong>OLAP (Online Analytical Processing):</strong> Low concurrency (tens of simultaneous queries), complex aggregations scanning millions or billions of rows across a few columns (e.g., <em>&ldquo;Calculate the 99th percentile checkout revenue grouped by country and device type over the past 30 days&rdquo;</em>).
          </li>
        </ul>

        <h3>The Structural Flaw of Row-Oriented Storage for Analytics</h3>
        <p>
          In a row-oriented database (PostgreSQL), data is stored on disk in contiguous 8 KB physical pages, row by row:
        </p>
        <div style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--color-card)', padding: '12px 16px', borderRadius: 'var(--rounded-md)', margin: '12px 0', fontSize: '13px' }}>
          [Row 1: id, user_id, timestamp, event, ip, user_agent, country, device, revenue, session] <br />
          [Row 2: id, user_id, timestamp, event, ip, user_agent, country, device, revenue, session]
        </div>
        <p>
          Each row contains 120 bytes of data across 10 columns. If you execute:
        </p>
        <div style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--color-card)', padding: '10px 16px', borderRadius: 'var(--rounded-md)', margin: '12px 0', fontSize: '13px' }}>
          SELECT country, sum(revenue) FROM events WHERE timestamp &gt;= NOW() - INTERVAL &apos;7 days&apos; GROUP BY country;
        </div>
        <p>
          You only require <strong>2 columns</strong>: <code>country</code> (2 bytes) and <code>revenue</code> (4 bytes) = 6 bytes per row. But because rows are interleaved on disk, the storage engine has no choice but to <strong>load all 120 bytes of every row into memory</strong>!
        </p>
        <p>
          Scanning 100,000,000 rows requires reading <strong>12 Gigabytes of disk data</strong> to extract 600 Megabytes of useful values. Over 95% of disk bandwidth and memory buffer pool capacity is completely wasted.
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>System Dimension</th>
                <th>Row-Oriented OLTP (PostgreSQL)</th>
                <th>Column-Oriented OLAP (ClickHouse)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Disk Layout</strong></td>
                <td>Contiguous rows inside 8 KB pages</td>
                <td>Each column stored in separate contiguous files (<code>country.bin</code>, <code>rev.bin</code>)</td>
              </tr>
              <tr>
                <td><strong>Projection Pruning</strong></td>
                <td>None (all columns loaded into memory)</td>
                <td>Extreme (unqueried columns are never touched on disk)</td>
              </tr>
              <tr>
                <td><strong>Data Compression</strong></td>
                <td>Poor (2x&ndash;3x due to mixed data types in a row)</td>
                <td>Massive (10x&ndash;25x because each column holds identical types)</td>
              </tr>
              <tr>
                <td><strong>Indexing Architecture</strong></td>
                <td>Dense B-Trees (1 index entry per row)</td>
                <td>Sparse Primary Index (1 index mark per 8,192 rows in RAM)</td>
              </tr>
              <tr>
                <td><strong>CPU Processing</strong></td>
                <td>Volcano Iterator (tuple-at-a-time function calls)</td>
                <td>SIMD Vectorized Execution (arrays of 8,192 values in L1/L2 cache)</td>
              </tr>
              <tr>
                <td><strong>Mutation Support</strong></td>
                <td>In-place row updates with MVCC / WAL</td>
                <td>Append-only immutable parts; updates/deletes via background merges</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. Columnar Physical Layout &amp; Projection Pruning</h2>
        <p>
          In a columnar database like ClickHouse, every column of a table is written into an independent file on disk. For an <code>events</code> table, the filesystem layout looks like:
        </p>
        <ul>
          <li><code>country.bin</code>: Contiguous binary stream of country codes across millions of rows.</li>
          <li><code>revenue.bin</code>: Contiguous binary stream of 32-bit integers.</li>
          <li><code>user_agent.bin</code>: Large strings (completely isolated).</li>
        </ul>
        <p>
          <strong>Projection Pruning:</strong> When the query engine parses <code>SELECT sum(revenue) WHERE country = &apos;US&apos;</code>, it opens strictly <code>country.bin</code> and <code>revenue.bin</code>. The <code>user_agent.bin</code>, <code>ip.bin</code>, and <code>session.bin</code> files are never opened, never read from NVMe, and never occupy OS page cache. Disk I/O drops instantly by 90%&ndash;95%.
        </p>

        <h2>3. Column Compression: The Homogeneity Advantage</h2>
        <p>
          In a row-oriented block, adjacent bytes alternate between strings, timestamps, integers, and UUIDs. Compression algorithms (LZ4, ZSTD) struggle to find repetitive patterns.
        </p>
        <p>
          In columnar storage, a single file contains <strong>billions of values of the exact same data type</strong>, sorted in order. This unlocks specialized, ultra-fast compression encodings:
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            margin: '20px 0',
          }}
        >
          <div style={{ background: 'var(--color-card)', padding: '16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#cc785c' }}>Run-Length Encoding (RLE)</h4>
            <p style={{ fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
              When data is sorted by a column with low cardinality (e.g. <code>country</code>), millions of identical consecutive values appear: <code>[&quot;US&quot;, &quot;US&quot;, &quot;US&quot; ... x 50,000]</code>. RLE stores this as a single pair: <code>(&quot;US&quot;, 50000)</code>. What would have consumed 100 Kilobytes is compressed into 6 bytes &mdash; a 16,000x compression ratio!
            </p>
          </div>

          <div style={{ background: 'var(--color-card)', padding: '16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#2e7d32' }}>Delta &amp; Double-Delta Encoding</h4>
            <p style={{ fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
              For monotonically increasing metrics (e.g., Unix timestamps <code>1700000000, 1700000002, 1700000005</code>), storing 64-bit integers wastes massive space. Delta encoding stores only the difference from the previous value (<code>+2, +3</code>), which fit inside 2-bit or 4-bit packed words.
            </p>
          </div>
        </div>

        <h2>4. Sparse Primary Indexes &amp; ClickHouse Granules</h2>
        <p>
          In PostgreSQL, a B-Tree index is <strong>dense</strong>: it contains one index pointer for every single row. If you have 5,000,000,000 rows, a dense B-Tree consumes 150 Gigabytes of RAM just for index pointers.
        </p>
        <p>
          ClickHouse rejects dense indexes entirely. It organizes data into <strong>Granules</strong> &mdash; contiguous blocks of rows (by default, <strong>8,192 physical rows per granule</strong>).
        </p>
        <p>
          A ClickHouse <strong>Sparse Primary Index</strong> stores exactly <strong>one index mark per granule</strong>, recording the minimum and maximum values of the primary key in that 8,192-row slice:
        </p>

        <div
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '16px',
            margin: '20px 0',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 700, color: '#cc785c', marginBottom: '8px' }}>
            CLICKHOUSE PRIMARY KEY INDEX (ORDER BY event_time, country)
          </div>
          <div>Mark 0   (Rows 0 &ndash; 8,191)       &rarr; [&quot;2026-11-01 00:00:00&quot;, &quot;DE&quot;] &ndash; File offset: 0</div>
          <div>Mark 1   (Rows 8,192 &ndash; 16,383)   &rarr; [&quot;2026-11-01 02:15:00&quot;, &quot;US&quot;] &ndash; File offset: 34,200</div>
          <div>Mark 2   (Rows 16,384 &ndash; 24,575)  &rarr; [&quot;2026-11-01 05:30:00&quot;, &quot;US&quot;] &ndash; File offset: 69,150</div>
          <div style={{ margin: '8px 0', borderTop: '1px dashed var(--color-border)' }} />
          <div style={{ color: '#2e7d32', fontWeight: 600 }}>
            Query: WHERE event_time &gt;= &apos;2026-11-01 05:00:00&apos;
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>
            ClickHouse binary searches the sparse marks in RAM. Marks 0 and 1 are pruned immediately. Disk I/O seeks directly to offset 69,150, skipping 16,384 rows without reading a single byte from disk!
          </div>
        </div>
        <p>
          Because there is only 1 mark per 8,192 rows, the entire primary index for 1,000,000,000 rows takes less than <strong>25 Megabytes of RAM</strong>, sitting permanently in CPU memory!
        </p>

        <h2>5. Vectorized Query Execution (SIMD)</h2>
        <p>
          Traditional databases execute queries using the <strong>Volcano Iterator Model</strong>:
        </p>
        <div style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--color-card)', padding: '10px 16px', borderRadius: 'var(--rounded-md)', margin: '12px 0', fontSize: '13px' }}>
          while (row = operator.next()) &#123; processRow(row); &#125;
        </div>
        <p>
          Calling a virtual function <code>next()</code> for every single row 100,000,000 times destroys CPU performance:
        </p>
        <ul>
          <li>Severe CPU branch mispredictions on every tuple loop.</li>
          <li>Massive L1/L2 CPU instruction cache thrashing.</li>
          <li>Inability of the compiler to auto-vectorize arithmetic operations.</li>
        </ul>
        <p>
          <strong>Vectorized Execution:</strong> Instead of processing one row at a time, ClickHouse operators process entire <strong>vectors</strong> (arrays of 8,192 primitive values) in tight inner loops. The CPU utilizes modern <strong>SIMD (Single Instruction, Multiple Data)</strong> instructions (AVX-512 / ARM NEON), adding or comparing 16 integers in a single clock cycle. This allows a single CPU core to crunch <strong>150,000,000 rows per second</strong>!
        </p>

        {/* Interactive Simulator */}
        <ColumnarAnalyticsSimulator />

        <h2>6. Ingestion Architecture: The &ldquo;Too Many Parts&rdquo; Hazard</h2>
        <p>
          ClickHouse tables typically use the <strong>MergeTree</strong> engine. Like LSM-Trees, data written to a MergeTree table is immutable. Every insert creates a new directory on disk called a <strong>Part</strong>.
        </p>
        <p>
          In relational databases, developers write single rows as events occur:
        </p>
        <div style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--color-card)', padding: '10px 16px', borderRadius: 'var(--rounded-md)', margin: '12px 0', fontSize: '13px' }}>
          // NAIVE ANTI-PATTERN: 5,000 individual inserts per second <br />
          await db.query(&quot;INSERT INTO events VALUES ($1, $2, $3)&quot;, [event]);
        </div>
        <p>
          If you send 5,000 individual inserts per second into ClickHouse, you create 5,000 separate part folders on disk every second! ClickHouse&apos;s background merge threads cannot merge them fast enough.
        </p>
        <p>
          Once unmerged parts exceed 300, ClickHouse throws a fatal error:
        </p>
        <div style={{ fontFamily: 'var(--font-mono, monospace)', background: '#ffebee', color: '#c62828', padding: '10px 16px', borderRadius: 'var(--rounded-md)', margin: '12px 0', fontSize: '13px', fontWeight: 600 }}>
          DB::Exception: Too many parts in all data parts in table (302 parts &gt; 300 threshold). Merges are failing to keep pace.
        </div>
        <p>
          <strong>Production Rule:</strong> Never execute single-row inserts in an OLAP database. Writes must be buffered in memory or routed through Kafka and flushed in <strong>micro-batches of 10,000 to 100,000 rows</strong> (or at least once every 1&ndash;5 seconds).
        </p>

        <h2>7. Production TypeScript Micro-Batch Ingestion Pipeline</h2>
        <p>
          Below is a production-grade Node.js / TypeScript micro-batching worker that buffers high-throughput streaming events and flushes them in structured batches to ClickHouse, preventing the &ldquo;Too many parts&rdquo; failure cascade.
        </p>

        <CodeWindowCard
          title="src/analytics/ClickHouseBatchIngestor.ts"
          code={`import { createClient, ClickHouseClient } from '@clickhouse/client';

export interface TelemetryEvent {
  event_time: string; // ISO 8601
  merchant_id: string;
  event_type: 'click' | 'impression' | 'purchase';
  country: string;
  device: 'mobile' | 'desktop' | 'tablet';
  revenue_cents: number;
}

export class ClickHouseBatchIngestor {
  private client: ClickHouseClient;
  private buffer: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  private readonly BATCH_SIZE_THRESHOLD = 25000; // Flush at 25k records
  private readonly FLUSH_INTERVAL_MS = 2000;     // Or every 2 seconds

  constructor(host: string, database: string) {
    this.client = createClient({
      url: host,
      database,
      clickhouse_settings: {
        async_insert: 1, // Utilize ClickHouse server-side async buffer
        wait_for_async_insert: 0,
      },
    });

    this.startPeriodicFlush();
  }

  /**
   * Ingest a single event into the high-speed local memory buffer.
   * Flushes immediately if batch threshold is breached.
   */
  public enqueue(event: TelemetryEvent): void {
    this.buffer.push(event);

    if (this.buffer.length >= this.BATCH_SIZE_THRESHOLD && !this.isFlushing) {
      this.flush();
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0 && !this.isFlushing) {
        this.flush();
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Drains the memory buffer and writes a single compressed MergeTree part.
   */
  public async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const recordsToFlush = this.buffer;
    this.buffer = []; // Swap buffer atomically

    try {
      await this.client.insert({
        table: 'telemetry_events',
        values: recordsToFlush,
        format: 'JSONEachRow',
      });
      console.log(\`[ClickHouse] Successfully flushed \${recordsToFlush.length} rows into 1 clean part.\`);
    } catch (error) {
      console.error('[ClickHouse] Ingestion flush failed! Re-queuing records:', error);
      // Prepend records back to avoid silent data loss
      this.buffer = [...recordsToFlush, ...this.buffer];
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * High-speed vectorized aggregation query.
   */
  public async queryMerchantRevenue(merchantId: string, sinceDate: string) {
    const result = await this.client.query({
      query: \`
        SELECT 
          country,
          count(*) AS total_events,
          sum(revenue_cents) AS gross_revenue_cents,
          quantile(0.99)(revenue_cents) AS p99_order_cents
        FROM telemetry_events
        WHERE merchant_id = {merchantId: String}
          AND event_time >= {sinceDate: DateTime}
        GROUP BY country
        ORDER BY gross_revenue_cents DESC
        LIMIT 20
      \`,
      query_params: { merchantId, sinceDate },
      format: 'JSONEachRow',
    });

    return await result.json();
  }

  public async shutdown(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
    await this.client.close();
  }
}`}
        />

        <AIPitfallCallout title="Staff-Level OLAP Pitfalls: Single-Row Insert Floods &amp; Relational Mutation Assumptions">
          <p>
            AI models routinely misapply relational database conventions to analytical engines:
          </p>
          <ul>
            <li>
              <strong>Treating ClickHouse like Postgres with Single-Row Inserts:</strong> Naive AI code streams events directly to ClickHouse on every HTTP request. This immediately detonates the &ldquo;Too many parts in all data parts in table&rdquo; exception, halting ingestion completely. <em>Architectural Mandate:</em> Always mandate client-side micro-batching or use an external Kafka queue with ClickHouse native Kafka engine.
            </li>
            <li>
              <strong>Issuing Frequent <code>UPDATE</code> and <code>DELETE</code> Statements:</strong> In OLTP, updates are cheap in-place or MVCC operations. In columnar engines, data parts are immutable. An <code>ALTER TABLE UPDATE</code> triggers an expensive full-part rewrite on disk across all columns! If you need mutation semantics (e.g. deduplicating user profile records), use <strong>ReplacingMergeTree</strong> or <strong>CollapsingMergeTree</strong> engines, which resolve updates asynchronously during background merges.
            </li>
          </ul>
        </AIPitfallCallout>

        <h2>8. Architectural Knowledge Verification</h2>
        <p>
          Test your comprehension of columnar storage mechanics, sparse primary indexing, and vectorized execution before advancing.
        </p>

        <Quiz
          id="quiz_0018_1"
          question="1. What is the fundamental physical reason why columnar databases execute aggregation queries on a few columns orders of magnitude faster than row-oriented databases?"
          options={[
            {
              text: 'Because columnar engines physically isolate each column on disk, reading strictly the required column byte streams and skipping unqueried columns entirely.',
              isCorrect: true,
              explanation: 'Projection pruning means only requested column files are opened and read into memory, eliminating 90%+ of useless disk I/O.'
            },
            {
              text: 'Because columnar engines translate all aggregation arithmetic into distributed blockchain consensus validations across cluster worker nodes.',
              isCorrect: false,
              explanation: 'Analytics engines perform vectorized SIMD arithmetic on raw arrays, not blockchain validations.'
            },
            {
              text: 'Because columnar engines automatically convert all string columns into 128-bit SHA-3 cryptographic hashes stored in the browser local storage.',
              isCorrect: false,
              explanation: 'Browser storage has nothing to do with server-side columnar data storage and indexing.'
            },
            {
              text: 'Because columnar engines bypass the operating system kernel and write directly to physical CPU registers without touching RAM.',
              isCorrect: false,
              explanation: 'Data must be transferred from disk/NVMe into RAM before CPU execution.'
            }
          ]}
        />

        <Quiz
          id="quiz_0018_2"
          question="2. How does a ClickHouse sparse primary index (1 mark per 8,192 rows) achieve both tiny memory footprint and blazing query speed across billions of records?"
          options={[
            {
              text: 'It stores min and max column bounds per granule in RAM, using binary search to skip disk reads for granules outside the query filter range.',
              isCorrect: true,
              explanation: 'With 1 mark per 8,192 rows, the index fits entirely in RAM and allows the engine to skip 90%+ of disk data blocks without reading them.'
            },
            {
              text: 'It completely disables all disk reads by compressing the entire 10-billion-row dataset into a single 4 MB CPU cache register.',
              isCorrect: false,
              explanation: 'Billions of rows cannot fit in CPU cache; sparse index marks identify which specific compressed blocks on disk to stream.'
            },
            {
              text: 'It replaces primary key lookups with unindexed random sampling across the operating system page cache.',
              isCorrect: false,
              explanation: 'ClickHouse performs deterministic binary search on ordered primary key granules, not random sampling.'
            },
            {
              text: 'It creates a dense B-Tree index with 64-bit pointers for every individual row stored in the database.',
              isCorrect: false,
              explanation: 'Dense B-Trees are rejected by ClickHouse due to huge RAM consumption; it uses sparse indexing exclusively.'
            }
          ]}
        />

        <Quiz
          id="quiz_0018_3"
          question="3. What catastrophic operational failure occurs if an application issues 10,000 individual single-row INSERT statements per second into a ClickHouse MergeTree table?"
          options={[
            {
              text: 'The operating system kernel runs out of virtual memory addresses and deletes the node root filesystem from the local SSD.',
              isCorrect: false,
              explanation: 'Filesystems are not deleted; ClickHouse stops ingestion before system corruption occurs.'
            },
            {
              text: 'Thousands of tiny immutable parts accumulate on disk faster than background threads can merge them, throwing a fatal \'Too many parts\' exception.',
              isCorrect: true,
              explanation: 'Each insert generates an immutable part on disk. Flooding single-row inserts overwhelms the merge tree and crashes writes.'
            },
            {
              text: 'The DNS provider blacklists the domain name due to excessive TCP SYN packets detected across global root nameservers.',
              isCorrect: false,
              explanation: 'DNS has no relation to database internal disk part management.'
            },
            {
              text: 'ClickHouse automatically converts all underlying data tables into uncompressed SQLite relational database files.',
              isCorrect: false,
              explanation: 'ClickHouse does not convert tables to SQLite.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0018 Review"
          promptText="I have completed Lesson 0018 on High-Throughput Analytics, Columnar Storage, ClickHouse, and Vectorized Execution. Please challenge me on why projection pruning and RLE compression achieve massive I/O savings, how sparse primary index granules differ from dense B-Trees, and how to design a resilient Kafka-to-ClickHouse ingestion pipeline."
        />

        <LessonNavButtons currentLessonId="0018" />
      </div>
    </div>
  );
};
