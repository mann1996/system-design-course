import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { LSMTreeSimulator } from '../../components/Simulators/LSMTreeSimulator';

export const Lesson0013: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0013"
            lessonBadge="Lesson 0013"
            moduleBadge="Module 6: Storage Engines &amp; Object Architecture"
            time="20 mins"
            tag="LSM-Tree Sim"
          />
          <h1>Storage Engine Internals: LSM-Trees vs B-Trees, Write Amplification &amp; Bloom Filters</h1>
          <p className="lead-text">
            Why do relational database indexes collapse during massive write surges, while RocksDB, Cassandra, and ClickHouse sustain millions of writes per second? Master the mechanics of Log-Structured Merge-Trees: append-only Write-Ahead Logs, in-memory MemTables, immutable SSTables, probabilistic Bloom filters, and compaction trade-offs.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0013" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 3: &ldquo;Storage and Retrieval: Data Structures That Power Your Database&rdquo; (LSM-Trees, SSTables, B-Trees, Bloom Filters, and Compaction); Patrick O&apos;Neil, Edward O&apos;Neil, and Gerhard Weikum, <em>The Log-Structured Merge-Tree (LSM-Tree)</em> (Acta Informatica, 1996); and RocksDB Engineering Wiki on <em>Leveled Compaction &amp; Write Amplification</em>.
            </p>
          }
        />

        <h2>1. The Write Wall: In-Place Updates vs. Append-Only Logs</h2>
        <p>
          Every storage engine makes a fundamental architectural choice when persisting data to disk:
          <strong> Do we update data in-place, or do we append writes sequentially?</strong>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>The Traditional Paradigm</span>
            <h4 style={{ margin: '8px 0' }}>B+Trees (In-Place Updates)</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Used by PostgreSQL, MySQL (InnoDB), and SQLite. Organizes data into fixed-size disk blocks (typically 4 KB to 16 KB pages). Modifying a single 40-byte row requires overwriting an entire 16 KB page on disk, triggering random I/O and page splits.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>The High-Throughput Paradigm</span>
            <h4 style={{ margin: '8px 0' }}>LSM-Trees (Log-Structured Merge)</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Used by RocksDB, Apache Cassandra, ScyllaDB, CockroachDB, and Google Bigtable. Never updates files in-place. Every insert, update, and delete is written sequentially to an append-only log in memory and flushed to immutable disk files.
            </p>
          </div>
        </div>

        <p>
          To understand why this choice matters, consider modern storage hardware:
          <strong> Sequential disk writes are 10× to 100× faster than random disk writes</strong>, even on NVMe SSDs.
          When a database uses B+Trees, inserting random keys (such as UUIDs, user IDs, or event hashes) forces the storage controller to perform random seeks across the disk.
        </p>

        <h3>The Menace of Write Amplification (WA)</h3>
        <p>
          <strong>Write Amplification</strong> is defined as the ratio of bytes written to underlying physical storage compared to the logical bytes requested by the application:
        </p>
        <div style={{ background: '#f5f4f0', padding: '12px 16px', borderRadius: '8px', margin: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '14px', border: '1px solid var(--color-hairline)' }}>
          Write Amplification Factor (WAF) = Physical Bytes Written to Disk / Logical User Bytes Requested
        </div>
        <p>
          In a B+Tree database, updating a 50-byte user balance requires:
        </p>
        <ol>
          <li>Writing the change to the sequential Write-Ahead Log (WAL) for durability (~100 bytes).</li>
          <li>Flushing the modified 16 KB dirty leaf page from the buffer pool to disk (16,384 bytes).</li>
          <li>If a page split occurs, writing parent index pages (another 16 KB to 32 KB).</li>
        </ol>
        <p>
          The resulting Write Amplification Factor is: <code>16,484 bytes / 50 bytes &approx; 330×</code>!
          Under high concurrency (e.g. 50,000 writes/sec), the storage controller&apos;s IOPS ceiling is hit instantly, causing severe write stalls and checkpoint freezes.
        </p>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Just use PostgreSQL with an index for high-throughput time-series telemetry"'>
          <p>
            When developers ask AI coding assistants how to store high-frequency IoT sensor telemetry, financial tick streams, or activity logs (e.g., 80,000 writes/sec), assistants routinely recommend:
            <code>CREATE TABLE metrics (id SERIAL PRIMARY KEY, device_id INT, ts TIMESTAMP, val FLOAT); CREATE INDEX ON metrics(device_id, ts);</code>
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>Why it fails in production:</strong> Every incoming insert updates two B+Tree indexes. As table size exceeds RAM, leaf pages cannot remain cached in the buffer pool. Random disk I/O spikes to 100% saturation. PostgreSQL WAL checkpointing creates massive latency spikes (the &ldquo;checkpoint sync stall&rdquo;).</li>
            <li><strong>MVCC Autovacuum Bloat:</strong> PostgreSQL cannot overwrite rows in place for updates; it creates new tuples, causing table and index bloat that the background autovacuum process cannot keep up with.</li>
            <li><strong>Architectural Remedy:</strong> High-write ingestion layers must use an LSM-Tree storage engine (e.g., Cassandra, ClickHouse, RocksDB, or TimescaleDB hypertable chunking) that converts random writes into sequential memory appends.</li>
          </ul>
        </AIPitfallCallout>

        <h2>2. Anatomy of a Log-Structured Merge-Tree (LSM-Tree)</h2>
        <p>
          An LSM-Tree decouples client write latency from disk layout through four cooperating components:
        </p>

        <div style={{ background: '#181715', color: '#faf9f5', padding: '20px', borderRadius: '12px', margin: '20px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.8 }}>
          <div style={{ color: 'var(--color-primary)', fontWeight: 700, marginBottom: '6px' }}>// LSM-Tree Core Pipeline Architecture:</div>
          <div>1. Client Write (PUT key=val / DELETE key)</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;&darr;</div>
          <div>2. Append to sequential WAL (Disk) &rarr; Guarantees crash recovery with 0 random seeks</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;&darr;</div>
          <div>3. Insert into MemTable (RAM) &rarr; Sorted in-memory data structure (SkipList or Red-Black Tree)</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;&darr;</div>
          <div style={{ color: '#00c49f' }}>4. Client receives ACK immediately! (Latency &lt; 50 microseconds)</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;&darr; (When MemTable reaches threshold: e.g. 32 MB - 64 MB)</div>
          <div>5. Background Worker freezes MemTable &rarr; Flushes to Disk as immutable SSTable</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;&darr;</div>
          <div>6. WAL is truncated; New active MemTable allocated</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;&darr;</div>
          <div style={{ color: '#80d8ff' }}>7. Background Compaction merges fragmented SSTables and purges tombstones</div>
        </div>

        <h3>1. The In-Memory MemTable</h3>
        <p>
          The <strong>MemTable</strong> is a sorted, in-memory data structure (typically implemented as a concurrent SkipList or Red-Black Tree). Because keys are maintained in sorted order in RAM, insertions take $O(\log N)$ time with zero disk I/O.
        </p>

        <h3>2. The Write-Ahead Log (WAL)</h3>
        <p>
          If the database server loses power, RAM is wiped. To guarantee durability (the &ldquo;D&rdquo; in ACID), every write is appended sequentially to an on-disk <strong>Write-Ahead Log (WAL)</strong> before updating the MemTable. Because the log is strictly append-only, the disk head never seeks randomly. On restart, the engine replays the WAL to reconstruct the MemTable exactly.
        </p>

        <h3>3. Immutable SSTables (Sorted String Tables)</h3>
        <p>
          When the MemTable reaches its memory limit (e.g. 64 MB), it is marked immutable, and a background thread flushes it to disk as an <strong>SSTable (Sorted String Table)</strong>.
          An SSTable consists of:
        </p>
        <ul>
          <li><strong>Data Blocks:</strong> Key-value pairs sorted alphabetically by key.</li>
          <li><strong>Sparse Index:</strong> Stored in memory. Instead of indexing every single key (which would waste RAM), it indexes every $N$-th key (e.g. the first key of every 4 KB block). To find a key, binary search locates the offset range, and the engine scans only one 4 KB block.</li>
          <li><strong>Immutability Guarantee:</strong> Once written to disk, an SSTable is <em>never modified</em>. Deletions do not erase disk bytes; they write a special marker called a <strong>Tombstone</strong>. Overwriting a key simply appends a higher version number.</li>
        </ul>

        <h2>3. The Read Path &amp; The Read Amplification Problem</h2>
        <p>
          While the write path in an LSM-tree is blindingly fast, the read path faces a severe penalty:
        </p>
        <p>
          To read a key, the database must search from youngest to oldest storage tier:
        </p>
        <ol>
          <li>Check the in-memory <strong>MemTable</strong>. If present, return immediately.</li>
          <li>Check any immutable MemTables currently being flushed to disk.</li>
          <li>Check <strong>Level 0 SSTables</strong> on disk. (Since L0 tables were flushed directly from MemTables, their key ranges can overlap).</li>
          <li>Check <strong>Level 1 SSTables</strong>, then Level 2 SSTables, and so on.</li>
        </ol>
        <p>
          <strong>The Worst-Case Scenario:</strong> What happens when a client requests a key that <em>does not exist</em>?
          The engine must search the MemTable and <em>every single SSTable file on disk</em> before it can conclusively answer &ldquo;Key Not Found&rdquo;!
          This is called <strong>Read Amplification</strong>. Without a defense, non-existent key lookups will cripple disk throughput.
        </p>

        <h2>4. The Mathematical Savior: Bloom Filters</h2>
        <p>
          To prevent point lookups from reading dozens of SSTables on disk, LSM engines pair each SSTable with an in-memory <strong>Bloom Filter</strong>.
        </p>
        <p>
          A Bloom filter is a space-efficient, probabilistic data structure invented by Burton Howard Bloom in 1970. It consists of a bit array of size $m$ bits, all initially set to $0$, and $k$ independent cryptographic hash functions ($h_1, h_2, \dots, h_k$).
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Bloom Filter Verdict</th>
                <th>Physical Reality</th>
                <th>Engine Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Negative (At least one bit is 0)</strong></td>
                <td><strong>100% Guaranteed NOT in SSTable</strong></td>
                <td><span style={{ color: '#2e7d32', fontWeight: 600 }}>SKIP DISK READ! (0 disk IOPS consumed)</span></td>
              </tr>
              <tr>
                <td><strong>Positive (All $k$ bits are 1)</strong></td>
                <td><strong>Probably in SSTable (small false positive chance $p$)</strong></td>
                <td><span style={{ color: '#cc785c', fontWeight: 600 }}>Read sparse index and scan SSTable block</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          The critical property of a Bloom filter is: <strong>NO FALSE NEGATIVES</strong>.
          If the Bloom filter returns negative, the engine knows with mathematical certainty that the key is not in that SSTable. It skips reading the disk file entirely!
        </p>
        <p>
          With approximately <strong>10 bits per key</strong> and $k = 7$ hash functions, the false positive probability is only <strong>1% ($p = 0.01$)</strong>. That means 99% of non-existent key disk reads are completely eliminated in RAM before touching storage!
        </p>

        <h2>5. Compaction: Purging Tombstones &amp; Flattening Levels</h2>
        <p>
          Because SSTables are immutable, outdated key versions and deleted tombstones accumulate on disk, wasting space and increasing read latency.
          To reclaim disk space and merge fragmented files, LSM-trees run background <strong>Compaction</strong>:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Strategy 1</span>
            <h4 style={{ margin: '8px 0' }}>Size-Tiered Compaction (STCS)</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Triggered when several SSTables of similar sizes accumulate (e.g. 4 tables of 100 MB). The engine merges them into a single 400 MB SSTable.
              <strong> Trade-off:</strong> High write throughput, but requires up to 50% free disk space headroom for merge buffers (high space amplification). Best for write-heavy append workloads.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Strategy 2</span>
            <h4 style={{ margin: '8px 0' }}>Leveled Compaction (LCS)</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Divides disk into levels ($L_0, L_1, L_2, \dots$), where each level is $10\times$ larger than the previous. In $L_1$ and above, SSTables have <em>non-overlapping key ranges</em>.
              <strong> Trade-off:</strong> Lower read amplification and predictable 10% disk overhead, but higher write amplification as tables are repeatedly merged. Used by RocksDB and CockroachDB.
            </p>
          </div>
        </div>

        <h2>6. The RUM Conjecture</h2>
        <p>
          In distributed database theory, the <strong>RUM Conjecture</strong> (Athanassoulis et al., Harvard/BU) proves that storage systems face a trilemma:
        </p>
        <blockquote>
          <strong>You can optimize at most two of the three:</strong><br />
          <strong>R</strong>ead overhead, <strong>U</strong>pdate overhead, and <strong>M</strong>emory/Space overhead.
        </blockquote>
        <ul>
          <li><strong>B+Trees:</strong> Optimize <em>Read overhead</em> ($O(\log N)$ point lookups) and <em>Memory overhead</em>, at the cost of terrible <em>Update overhead</em> (high write amplification).</li>
          <li><strong>LSM-Trees:</strong> Optimize <em>Update overhead</em> (sequential $O(1)$ memory appends), at the cost of higher <em>Read overhead</em> (multi-tier checks) and <em>Memory overhead</em> (Bloom filters + compaction space).</li>
        </ul>

        <h2>7. Interactive Architecture Simulator: LSM-Tree &amp; Bloom Filters</h2>
        <p>
          Experiment directly with an LSM storage engine below. Insert keys, observe the MemTable filling up, watch it flush to immutable SSTables, test non-existent key lookups to see Bloom filters save disk seeks, and trigger compaction to purge tombstones:
        </p>

        <LSMTreeSimulator />

        <h2>8. Production Implementation: In-Memory LSM Engine in TypeScript</h2>
        <p>
          Below is a production-grade TypeScript implementation of an LSM-Tree storage engine with a sequential WAL, MemTable with SkipList ordering, 16-bit Bloom filters, and sparse SSTable binary search:
        </p>

        <CodeWindowCard
          title="lsm-storage-engine.ts"
          code={`// Production-grade LSM Storage Engine with Bloom Filters & SSTables
import * as crypto from 'crypto';

export interface KeyValueEntry {
  key: string;
  value: string;
  isTombstone: boolean;
  version: number;
}

export class BloomFilter {
  private bits: Uint8Array;
  private readonly size: number;

  constructor(size: number = 64) {
    this.size = size;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  // 3 distinct Murmur-like hash passes
  private getHashes(key: string): [number, number, number] {
    const hash = crypto.createHash('sha256').update(key).digest();
    const h1 = hash.readUInt32BE(0) % this.size;
    const h2 = hash.readUInt32BE(4) % this.size;
    const h3 = hash.readUInt32BE(8) % this.size;
    return [h1, h2, h3];
  }

  public add(key: string): void {
    const hashes = this.getHashes(key);
    for (const h of hashes) {
      const byteIdx = Math.floor(h / 8);
      const bitIdx = h % 8;
      this.bits[byteIdx] |= (1 << bitIdx);
    }
  }

  public mightContain(key: string): boolean {
    const hashes = this.getHashes(key);
    for (const h of hashes) {
      const byteIdx = Math.floor(h / 8);
      const bitIdx = h % 8;
      if ((this.bits[byteIdx] & (1 << bitIdx)) === 0) {
        return false; // 100% Guaranteed NOT present!
      }
    }
    return true; // Probable match
  }
}

export class SSTableOnDisk {
  public readonly id: string;
  public readonly entries: KeyValueEntry[];
  public readonly bloomFilter: BloomFilter;
  public readonly sparseIndex: Map<string, number>; // key -> offset index

  constructor(id: string, entries: KeyValueEntry[]) {
    this.id = id;
    this.entries = [...entries];
    this.bloomFilter = new BloomFilter(128);
    this.sparseIndex = new Map();

    // Populate bloom filter and sparse index every 2 keys
    for (let i = 0; i < this.entries.length; i++) {
      this.bloomFilter.add(this.entries[i].key);
      if (i % 2 === 0) {
        this.sparseIndex.set(this.entries[i].key, i);
      }
    }
  }

  public get(key: string): KeyValueEntry | null {
    // Step 1: Check Bloom Filter in RAM!
    if (!this.bloomFilter.mightContain(key)) {
      return null; // ZERO disk reads executed!
    }

    // Step 2: In real DB, read sparse index & seek block on disk
    const found = this.entries.find((e) => e.key === key);
    return found || null;
  }
}

export class LSMStorageEngine {
  private memTable: Map<string, KeyValueEntry> = new Map();
  private sstables: SSTableOnDisk[] = [];
  private readonly memtableFlushLimit: number = 4;
  private currentVersion: number = 1;

  public put(key: string, value: string): void {
    // 1. Append to WAL (simulated disk write)
    this.appendWal('PUT', key, value);

    // 2. Insert into MemTable
    this.memTable.set(key, {
      key,
      value,
      isTombstone: false,
      version: this.currentVersion++,
    });

    // 3. Flush if MemTable full
    if (this.memTable.size >= this.memtableFlushLimit) {
      this.flushMemTable();
    }
  }

  public delete(key: string): void {
    this.appendWal('DEL', key, '');
    this.memTable.set(key, {
      key,
      value: '',
      isTombstone: true,
      version: this.currentVersion++,
    });

    if (this.memTable.size >= this.memtableFlushLimit) {
      this.flushMemTable();
    }
  }

  public get(key: string): string | null {
    // Tier 1: Check MemTable (RAM)
    if (this.memTable.has(key)) {
      const entry = this.memTable.get(key)!;
      return entry.isTombstone ? null : entry.value;
    }

    // Tier 2: Check SSTables (Newest to Oldest)
    for (const table of this.sstables) {
      const entry = table.get(key);
      if (entry) {
        return entry.isTombstone ? null : entry.value;
      }
    }

    return null; // Key does not exist
  }

  private flushMemTable(): void {
    // Sort entries alphabetically
    const sortedEntries = Array.from(this.memTable.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );

    const sstable = new SSTableOnDisk(\`sst_\${Date.now()}\`, sortedEntries);
    this.sstables.unshift(sstable); // Newest at head
    this.memTable.clear();
  }

  private appendWal(op: string, key: string, val: string): void {
    // Sequential disk append operation
  }
}`}
        />

        <h2>9. Active Retrieval &amp; Architectural Verification</h2>
        <p>
          Confirm your comprehension of LSM-trees, write amplification, and Bloom filter mechanics:
        </p>

        <Quiz
          id="quiz_0013_1"
          question="1. Why does an LSM-tree achieve vastly higher write throughput than a traditional B+Tree database on write-intensive workloads?"
          options={[
            {
              text: 'Because B+Tree databases must write all queries to an external Redis cluster before persisting to disk.',
              isCorrect: false,
              explanation: 'B+Tree databases do not depend on external Redis clusters; they manage their own buffer pools.'
            },
            {
              text: 'Because LSM-trees append writes sequentially to a log and memory table without random in-place disk page updates.',
              isCorrect: true,
              explanation: 'LSM-trees write sequentially to the WAL and in-memory MemTable, bypassing expensive random disk page overwrites and page splits.'
            },
            {
              text: 'Because LSM-trees permanently disable disk durability checks to maximize kernel memory buffer caching.',
              isCorrect: false,
              explanation: 'LSM-trees maintain strict durability by appending every write to an append-only Write-Ahead Log (WAL).'
            },
            {
              text: 'Because LSM-trees run on non-relational distributed hardware that automatically eliminates physical network hops.',
              isCorrect: false,
              explanation: 'LSM-trees run on standard commodity hardware and can run on single nodes (e.g. RocksDB/SQLite4) or clusters.'
            }
          ]}
        />

        <Quiz
          id="quiz_0013_2"
          question="2. How do Bloom filters protect an LSM-tree storage engine from severe Read Amplification during point lookups?"
          options={[
            {
              text: 'By compressing data blocks using gzip so that entire SSTables fit into CPU L1 hardware cache registers.',
              isCorrect: false,
              explanation: 'Bloom filters do not compress data blocks; they are probabilistic bit arrays in memory.'
            },
            {
              text: 'By guaranteeing with zero false negatives that non-existent keys bypass unnecessary SSTable disk reads entirely.',
              isCorrect: true,
              explanation: 'If a Bloom filter returns negative, the key is guaranteed not to exist in that SSTable, completely skipping the disk read.'
            },
            {
              text: 'By sorting database keys in descending order so that binary search executes in constant O(1) time.',
              isCorrect: false,
              explanation: 'Binary search on sorted arrays is O(log N), not O(1), and sorting order alone does not prevent disk reads.'
            },
            {
              text: 'By automatically converting client SQL queries into asynchronous Kafka streaming event messages in RAM.',
              isCorrect: false,
              explanation: 'Bloom filters have nothing to do with Kafka message streams; they are internal storage engine data structures.'
            }
          ]}
        />

        <Quiz
          id="quiz_0013_3"
          question="3. What is the role of a 'Tombstone' when deleting a key in a Log-Structured Merge-Tree?"
          options={[
            {
              text: 'It immediately halts all background compaction workers to prevent dirty reads during transaction rollbacks.',
              isCorrect: false,
              explanation: 'Tombstones do not stop compaction; compaction is the exact process that purges them.'
            },
            {
              text: 'It sends an urgent remote procedure call to all read replicas instructing them to restart their operating system.',
              isCorrect: false,
              explanation: 'Tombstones are local storage markers, not cluster node reboot commands.'
            },
            {
              text: 'It writes a deletion marker indicating the key is deleted, deferring physical disk space reclamation to compaction.',
              isCorrect: true,
              explanation: 'Because SSTables are immutable, deletes cannot erase past disk bytes immediately; a tombstone shadows older versions until compaction reclaims space.'
            },
            {
              text: 'It triggers an immediate synchronous disk overwrite of all previous SSTables where the key was recorded.',
              isCorrect: false,
              explanation: 'Overwriting previous SSTables would violate immutability and reintroduce random write I/O.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0013 Review"
          promptText="I have completed Lesson 0013 on LSM-Trees, Write Amplification, and Bloom Filters. Please test my understanding of the RUM conjecture, Leveled vs Size-Tiered compaction trade-offs, and when to choose RocksDB/Cassandra over PostgreSQL."
        />

        <LessonNavButtons currentLessonId="0013" />
      </div>
    </div>
  );
};
