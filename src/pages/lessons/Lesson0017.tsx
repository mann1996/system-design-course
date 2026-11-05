import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { SearchClusterSimulator } from '../../components/Simulators/SearchClusterSimulator';

export const Lesson0017: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0017"
            lessonBadge="Lesson 0017"
            moduleBadge="Module 8: Search &amp; Analytics"
            time="25 mins"
            tag="Search Sim"
          />
          <h1>Distributed Search Engines: Inverted Indexes, Lucene Segments &amp; Scatter-Gather Sharding</h1>
          <p className="lead-text">
            Why does querying <code>WHERE description LIKE &apos;%wireless headphones%&apos;</code> paralyze relational databases at scale, while search engines like Elasticsearch and OpenSearch return ranked results across 100,000,000 documents in 15 milliseconds? Deconstruct search engine internals: inverted indexes, postings lists, Lucene segment immutability, scatter-gather query phases, and tenant-based shard routing.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0017" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 3: &ldquo;Storage and Retrieval &ndash; Lucene and Full-Text Search&rdquo;; Alex Xu and Sahn Lam, <em>System Design Interview &ndash; An Insider&apos;s Guide: Volume 2</em>, Chapter 7: &ldquo;Search Autocomplete / Distributed Search&rdquo;; Lucene Core Documentation: &ldquo;Finite State Transducers, Postings Lists, and TieredMergePolicy&rdquo;; and Elastic Engineering: &ldquo;Anatomy of an Elasticsearch Cluster: Shard Allocation and Query Phases.&rdquo;
            </p>
          }
        />

        <h2>1. The Search Problem: Relational B-Trees vs. Inverted Indexes</h2>
        <p>
          In a relational database (PostgreSQL, MySQL), indexing relies primarily on <strong>B-Trees</strong>. A B-Tree index on a text column allows fast point lookups (<code>WHERE sku = &apos;WH-1000XM5&apos;</code>) and prefix lookups (<code>WHERE sku LIKE &apos;WH-%&apos;</code>) in $O(\log N)$ time.
        </p>
        <p>
          However, real-world user search is inherently <strong>fuzzy, multi-term, and substring-oriented</strong>:
        </p>
        <ul>
          <li>Users type <code>&quot;noise cancelling wireless headphones&quot;</code> in arbitrary word orders.</li>
          <li>Users enter morphological variants: <code>&quot;cancellation&quot;</code>, <code>&quot;cancelling&quot;</code>, <code>&quot;cancels&quot;</code>.</li>
          <li>Users make spelling typos: <code>&quot;hedphones&quot;</code>.</li>
        </ul>
        <p>
          A relational query like <code>WHERE description LIKE &apos;%headphones%&apos;</code> has a leading wildcard. This renders B-Tree indexes completely useless, forcing the database engine to execute a sequential <strong>Full Table Scan</strong> across every single row. On a table of 50,000,000 e-commerce products, this saturates disk IOPS, consumes gigabytes of buffer cache, and takes tens of seconds.
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Architectural Dimension</th>
                <th>Relational B-Tree (OLTP)</th>
                <th>Inverted Index (Lucene / Elasticsearch)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Primary Mapping</strong></td>
                <td>Document ID (Row) &rarr; Field Values</td>
                <td>Term (Word) &rarr; Sorted List of Document IDs</td>
              </tr>
              <tr>
                <td><strong>Substring Search (<code>%term%</code>)</strong></td>
                <td>$O(N)$ Sequential disk scan</td>
                <td>$O(1)$ Hash / FST memory dictionary lookup</td>
              </tr>
              <tr>
                <td><strong>Multi-Term Intersection</strong></td>
                <td>Multiple index scans + expensive bitmap joins</td>
                <td>Fast intersection of sorted postings lists (Skip Lists / Roaring Bitmaps)</td>
              </tr>
              <tr>
                <td><strong>Relevance Scoring</strong></td>
                <td>Manual calculation (unscalable)</td>
                <td>Native BM25 / TF-IDF scoring calculated during index traversal</td>
              </tr>
              <tr>
                <td><strong>Write Path Cost</strong></td>
                <td>Single B-Tree page lock &amp; update</td>
                <td>Tokenization pipeline, analyzer, and segment buffer allocation</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. Anatomy of an Inverted Index: Term Dictionary &amp; Postings Lists</h2>
        <p>
          An <strong>Inverted Index</strong> reverses the standard storage hierarchy. Instead of storing documents and asking what terms they contain, it stores all unique terms and records which documents contain them.
        </p>

        <h3>The Analysis Pipeline</h3>
        <p>
          Before text enters the index, it passes through an <strong>Analyzer Pipeline</strong> consisting of three stages:
        </p>
        <ol>
          <li><strong>Character Filters:</strong> Strip HTML tags (<code>&lt;b&gt;</code>), decode XML entities (<code>&amp;amp;</code> &rarr; <code>&amp;</code>).</li>
          <li><strong>Tokenizer:</strong> Splits continuous strings into discrete word tokens based on whitespace and punctuation (e.g., <code>&quot;Fast-charging&quot;</code> &rarr; <code>[&quot;fast&quot;, &quot;charging&quot;]</code>).</li>
          <li><strong>Token Filters:</strong>
            <ul>
              <li><em>Lowercasing:</em> Normalizes all text to lowercase.</li>
              <li><em>Stop-word Removal:</em> Drops high-frequency, low-signal words (<code>&quot;the&quot;</code>, <code>&quot;is&quot;</code>, <code>&quot;at&quot;</code>).</li>
              <li><em>Stemming (Porter / Snowball):</em> Reduces words to their grammatical root (e.g., <code>&quot;running&quot;</code>, <code>&quot;runs&quot;</code>, <code>&quot;ran&quot;</code> &rarr; <code>&quot;run&quot;</code>).</li>
              <li><em>Synonym Expansion:</em> Maps <code>&quot;earphones&quot;</code> &rarr; <code>&quot;headphones&quot;</code>.</li>
            </ul>
          </li>
        </ol>

        <h3>The Two Core Data Structures</h3>
        <p>
          A Lucene index consists of two primary internal components:
        </p>
        <ul>
          <li>
            <strong>1. Term Dictionary:</strong> A sorted vocabulary of all unique terms across all documents. To fit millions of terms in RAM, Lucene encodes the dictionary as a <strong>Finite State Transducer (FST)</strong> &mdash; a highly compressed, memory-resident directed graph that acts like a trie with suffix sharing.
          </li>
          <li>
            <strong>2. Postings Lists:</strong> For every term in the dictionary, a postings list contains a sorted array of Document IDs containing that term, along with Term Frequency (TF) and byte offsets/positions (for phrase searches). Because postings lists can contain millions of integers, they are compressed using <strong>Frame of Reference (FoR)</strong> or <strong>Roaring Bitmaps</strong>.
          </li>
        </ul>

        <div
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '20px',
            margin: '24px 0',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 700, color: '#cc785c', marginBottom: '8px' }}>
            POSTINGS LIST INTERSECTION: (&quot;wireless&quot; AND &quot;headphones&quot;)
          </div>
          <div>Term &quot;wireless&quot;   &rarr; Postings: [101, 102, 103, 107, 115, 120]</div>
          <div>Term &quot;headphones&quot; &rarr; Postings: [101, 104, 107, 109, 120, 135]</div>
          <div style={{ margin: '8px 0', borderTop: '1px dashed var(--color-border)' }} />
          <div style={{ color: '#2e7d32', fontWeight: 600 }}>
            Intersect (Two-Pointer / Skip Lists) &rarr; Matching DocIDs: [101, 107, 120]
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '6px' }}>
            Using Skip Lists embedded in the postings, Lucene skips large blocks of non-matching DocIDs in $O(\log N)$ steps rather than scanning sequentially.
          </div>
        </div>

        <h2>3. Lucene Storage Engine: Segments, Immutability &amp; Merge Policy</h2>
        <p>
          Unlike a relational database that overwrites pages in-place, <strong>Lucene segments are 100% immutable</strong>. Once written to disk, a segment file is never modified.
        </p>
        <ul>
          <li><strong>In-Memory Index Buffer:</strong> Incoming write operations (documents) are parsed and held in an in-memory indexing buffer. Concurrently, writes are appended to an on-disk <strong>Translog (Transaction Log / WAL)</strong> for crash durability.</li>
          <li><strong>Refresh (Near-Real-Time NRT):</strong> Every 1 second (configurable via <code>index.refresh_interval</code>), the buffer is flushed into a new immutable Lucene segment in the OS Page Cache. The documents become searchable immediately.</li>
          <li><strong>Flush:</strong> Every 30 minutes (or when Translog reaches 512 MB), an <code>fsync</code> commits all segments permanently to disk, and the Translog is cleared.</li>
          <li><strong>Deletes and Updates:</strong> Because segments are immutable, a <code>DELETE</code> does not erase data on disk; it marks a bit in an auxiliary <code>.del</code> bitset tombstone. An <code>UPDATE</code> is an atomic delete followed by a new insert.</li>
          <li><strong>Tiered Merge Policy:</strong> Over time, hundreds of small segment files accumulate. A background thread pool periodically merges multiple small segments into a single larger segment, physically purging deleted tombstone records and rebuilding contiguous postings lists.</li>
        </ul>

        <h2>4. Distributed Shard Topology &amp; Query Execution Paths</h2>
        <p>
          In an Elasticsearch or OpenSearch cluster, an index is divided into one or more <strong>Primary Shards</strong>, and each primary can have zero or more <strong>Replica Shards</strong> distributed across data nodes.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            margin: '24px 0',
          }}
        >
          <div style={{ background: 'var(--color-card)', padding: '16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: '#cc785c' }}>Phase 1: Query Phase (Scatter)</h4>
            <p style={{ fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
              The client sends a query to any node (acting as <strong>Coordinating Node</strong>). The coordinator broadcasts the request to a copy (primary or replica) of <em>every shard</em> in the index. Each shard evaluates the query against its local inverted index, builds a priority queue of size $(from + size)$ sorted by relevance score, and returns only doc IDs and scores to the coordinator.
            </p>
          </div>

          <div style={{ background: 'var(--color-card)', padding: '16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: '#2e7d32' }}>Phase 2: Fetch Phase (Gather)</h4>
            <p style={{ fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
              The coordinating node merges the priority queues from all shards into a global sorted list. It discards the first $from$ results and selects the top $size$ document IDs. Finally, it sends point <code>GET</code> requests only to the specific shards holding those exact top documents to retrieve the full <code>_source</code> JSON payload, assembling the final client response.
            </p>
          </div>
        </div>

        <h3>The Power of Shard Routing Keys (<code>_routing</code>)</h3>
        <p>
          By default, Elasticsearch decides which shard holds a document using:
        </p>
        <div style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--color-card)', padding: '10px 16px', borderRadius: 'var(--rounded-md)', margin: '12px 0', fontSize: '13px' }}>
          shard = murmur3(doc_id) % number_of_primary_shards
        </div>
        <p>
          Because documents are scattered randomly across all shards, every search query must <strong>scatter-gather across all shards</strong>. If you have 20 shards, 1 search query consumes CPU threads on 20 separate machines.
        </p>
        <p>
          In multi-tenant or merchant architectures, you can provide an explicit <strong>Routing Key</strong>:
        </p>
        <div style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--color-card)', padding: '10px 16px', borderRadius: 'var(--rounded-md)', margin: '12px 0', fontSize: '13px' }}>
          shard = murmur3(routing_key) % number_of_primary_shards // e.g. routing=tenant_id
        </div>
        <p>
          When querying with <code>?routing=merchant_123</code>, the coordinating node knows mathematically that all matching documents reside exclusively on <strong>Shard 3</strong>. It sends the query to Shard 3 alone, eliminating 95% of cluster network overhead and CPU contention!
        </p>

        {/* Interactive Simulator */}
        <SearchClusterSimulator />

        <h2>5. Production TypeScript Client Implementation</h2>
        <p>
          Below is a senior-architect-grade TypeScript Elasticsearch client demonstrating shard routing, resilient connection pooling, and the safe cursor-based <code>search_after</code> pagination pattern.
        </p>

        <CodeWindowCard
          title="src/search/ElasticsearchResilientClient.ts"
          code={`import { Client, ApiResponse } from '@elastic/elasticsearch';

export interface ProductDocument {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  price: number;
  createdAt: number;
}

export interface SearchPageResult {
  hits: ProductDocument[];
  totalHits: number;
  nextSearchAfterCursor: (string | number)[] | null;
}

export class ResilientSearchService {
  private client: Client;
  private readonly INDEX_NAME = 'products_v2';

  constructor(nodes: string[]) {
    this.client = new Client({
      nodes,
      maxRetries: 3,
      requestTimeout: 3000,
      sniffOnStart: true, // Auto-discover cluster topology nodes
      sniffInterval: 60000,
    });
  }

  /**
   * Indexed with custom _routing to isolate tenant documents to a single shard.
   */
  async indexProduct(product: ProductDocument): Promise<void> {
    await this.client.index({
      index: this.INDEX_NAME,
      id: product.id,
      routing: product.merchantId, // Critical: routes document by merchant
      document: product,
      refresh: false, // Avoid forcing immediate refresh in hot write paths
    });
  }

  /**
   * Scalable cursor-based search using search_after instead of 'from + size'.
   * O(1) memory overhead on coordinating node and shard priority queues.
   */
  async searchMerchantCatalog(params: {
    merchantId: string;
    keyword: string;
    pageSize: number;
    searchAfterCursor?: (string | number)[];
  }): Promise<SearchPageResult> {
    const response = await this.client.search<ProductDocument>({
      index: this.INDEX_NAME,
      routing: params.merchantId, // Target query exclusively to tenant's shard!
      size: params.pageSize,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: params.keyword,
                fields: ['title^3', 'description'], // Title boosted 3x
                fuzziness: 'AUTO', // Handles minor typos
              },
            },
          ],
          filter: [
            { term: { merchantId: params.merchantId } },
          ],
        },
      },
      // Stable sort order mandatory for search_after
      sort: [
        { _score: { order: 'desc' } },
        { createdAt: { order: 'desc' } },
        { id: { order: 'asc' } },
      ],
      search_after: params.searchAfterCursor,
      track_total_hits: 10000, // Caps expensive total counting
    });

    const hits = response.hits.hits.map((h) => h._source as ProductDocument);
    const lastHit = response.hits.hits[response.hits.hits.length - 1];
    const nextCursor = lastHit ? (lastHit.sort as (string | number)[]) : null;
    const totalHits = typeof response.hits.total === 'number' 
      ? response.hits.total 
      : response.hits.total?.value || 0;

    return {
      hits,
      totalHits,
      nextSearchAfterCursor: nextCursor,
    };
  }
}`}
        />

        <AIPitfallCallout title="Staff-Level Search Pitfalls: The Deep Pagination Trap &amp; Dynamic Mapping Explosions">
          <p>
            AI coding models routinely produce code with disastrous Elasticsearch anti-patterns:
          </p>
          <ul>
            <li>
              <strong>The Deep Pagination Catastrophe (<code>from: 100000, size: 20</code>):</strong> When an AI writes pagination using <code>from + size</code>, novices assume Elasticsearch skips the first 100,000 records. In reality, in a 5-shard cluster, <strong>every single shard must collect 100,020 documents into RAM</strong>, score them, and stream all 500,100 results across the internal network to the coordinating node. The coordinator must then merge-sort 500,100 documents in JVM heap before discarding 500,080 of them. This triggers catastrophic GC pauses and Out-Of-Memory (OOM) crashes. <em>Production Rule:</em> Always enforce cursor-based <code>search_after</code> with Doc Values for deep browsing.
            </li>
            <li>
              <strong>Dynamic Mapping Explosions:</strong> By default, Elasticsearch automatically creates a new field mapping whenever it encounters an unknown JSON key. If an AI pipes unvalidated client metadata (e.g. arbitrary user-defined JSON tags) into an index, the cluster state balloons with tens of thousands of dynamic fields. Because the cluster state is synchronized across all nodes in memory, this causes cluster state serialization deadlocks and paralyzes master nodes. <em>Production Rule:</em> Set <code>&quot;dynamic&quot;: &quot;strict&quot;</code> or <code>&quot;runtime&quot;</code> in production index templates.
            </li>
          </ul>
        </AIPitfallCallout>

        <h2>6. Architectural Knowledge Verification</h2>
        <p>
          Test your comprehension of distributed search topology, inverted index data structures, and segment mechanics before advancing.
        </p>

        <Quiz
          id="quiz_0017_1"
          question="1. Why does an inverted index resolve multi-term keyword search (e.g., 'wireless headphones') orders of magnitude faster than a relational B-Tree index?"
          options={[
            {
              text: 'Because an inverted index maps terms directly to pre-sorted lists of Document IDs, enabling rapid intersection via skip lists without reading full rows.',
              isCorrect: true,
              explanation: 'Inverted indexes store sorted postings lists per term. Multi-term searches simply intersect these postings lists in memory without disk row scans.'
            },
            {
              text: 'Because an inverted index executes full table scans across raw disk sectors using parallel GPU matrix multiplication algorithms.',
              isCorrect: false,
              explanation: 'Inverted indexes avoid full table scans; they operate on compressed postings lists and finite state transducers in RAM.'
            },
            {
              text: 'Because an inverted index replaces all text characters with 64-bit cryptographic hashes that fit inside a single CPU L1 cache register.',
              isCorrect: false,
              explanation: 'Lucene preserves terms in a term dictionary (FST) and compresses postings lists with Frame of Reference, not single L1 cache registers.'
            },
            {
              text: 'Because an inverted index forces the operating system kernel to disable TLS encryption for all internal search queries.',
              isCorrect: false,
              explanation: 'TLS encryption has no bearing on algorithmic full-text search indexing efficiency.'
            }
          ]}
        />

        <Quiz
          id="quiz_0017_2"
          question="2. In a multi-tenant e-commerce system with 20 primary shards, what is the primary architectural benefit of indexing and querying with '_routing=merchant_id'?"
          options={[
            {
              text: 'It automatically compresses the merchant product images using Reed-Solomon erasure coding before writing them to NVMe SSDs.',
              isCorrect: false,
              explanation: 'Routing keys dictate shard placement for search documents; they do not perform image erasure coding.'
            },
            {
              text: 'It routes the search query strictly to the single shard containing that merchant\'s products, avoiding a cluster-wide scatter-gather broadcast.',
              isCorrect: true,
              explanation: 'Routing guarantees all documents with the same key reside on one shard, allowing queries to bypass all other 19 shards entirely.'
            },
            {
              text: 'It enables immediate synchronous writes to disk without appending to the Lucene Translog or in-memory indexing buffer.',
              isCorrect: false,
              explanation: 'Writes still flow through the memory buffer and Translog for crash durability.'
            },
            {
              text: 'It converts all Lucene text analyzers into relational SQL stored procedures executed directly inside the Linux kernel.',
              isCorrect: false,
              explanation: 'Elasticsearch runs on JVM in user space; it does not execute SQL stored procedures in the Linux kernel.'
            }
          ]}
        />

        <Quiz
          id="quiz_0017_3"
          question="3. Why is using 'from: 150000, size: 20' considered a catastrophic anti-pattern in distributed search clusters?"
          options={[
            {
              text: 'Because Lucene deletes the underlying index segments if the requested page offset exceeds the operating system file descriptor limit.',
              isCorrect: false,
              explanation: 'Offsets do not delete index segments; segments remain immutable.'
            },
            {
              text: 'Because the coordinator node and all shards must allocate and sort priority queues of size 150,020 in RAM, triggering massive heap bloat and GC pauses.',
              isCorrect: true,
              explanation: 'Deep pagination forces every shard to collect (from + size) documents and the coordinator to merge them, exhausting JVM heap memory.'
            },
            {
              text: 'Because RFC 6455 prohibits HTTP GET query strings containing integer parameters greater than 65,535.',
              isCorrect: false,
              explanation: 'RFC 6455 specifies the WebSocket protocol, which has nothing to do with HTTP pagination query limits.'
            },
            {
              text: 'Because Elasticsearch automatically converts queries with large offsets into unindexed MySQL full-table scans.',
              isCorrect: false,
              explanation: 'Elasticsearch is an independent search engine; it does not fall back to MySQL.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0017 Review"
          promptText="I have completed Lesson 0017 on Distributed Search Engines, Inverted Indexes, Lucene Segments, and Shard Routing. Please challenge me on how the Query Phase (Scatter) and Fetch Phase (Gather) interact, why search_after prevents coordinating node heap exhaustion, and how to size primary shards for a 200M document cluster."
        />

        <LessonNavButtons currentLessonId="0017" />
      </div>
    </div>
  );
};
