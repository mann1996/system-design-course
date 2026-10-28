import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { CacheSimulator } from '../../components/Simulators/CacheSimulator';

export const Lesson0003: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0003"
            lessonBadge="Lesson 0003"
            moduleBadge="Module 2: Distributed State & Data"
            time="15 mins"
            tag="Interactive Sim"
          />
          <h1>Caching Strategies &amp; Distributed Invalidation</h1>
          <p className="lead-text">
            How to protect your primary database from collapse, choose the right write policy (Cache-Aside vs Write-Through), and master the hardest problem in computer science without serving stale data.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0003" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 3 &amp; Chapter 11; and Alex Xu, <em>System Design Interview (Vol. 1)</em>, Chapter 1: "Scale from Zero to Millions of Users — Cache Tier".
            </p>
          }
        />

        <h2>1. The Problem: The Latency &amp; Throughput Chasm</h2>
        <p>
          In <Link to="/lessons/0001">Lesson 0001</Link> and <Link to="/lessons/0002">Lesson 0002</Link>, we learned that stateless Node.js compute servers can be scaled horizontally behind a load balancer with near-linear elasticity. However, every stateless worker ultimately funnels requests down into the state layer: <strong>the database</strong>.
        </p>
        <p>
          While an in-memory cache like Redis or Memcached can deliver responses in under <strong>0.5 milliseconds</strong> and sustain over <strong>100,000 queries per second (QPS)</strong> on a single node, a relational database querying SSD disk and executing joins typically caps out at <strong>2,000&ndash;5,000 read QPS</strong> with latencies of <strong>10&ndash;50 milliseconds</strong>.
        </p>
        <p>
          When client traffic spikes by 10x, your application tier scales up in seconds. If every request hits PostgreSQL or MongoDB directly, connection pools exhaust, disk I/O saturates to 100%, and the database suffers a catastrophic cascading brownout. A caching tier is not merely a performance optimization—it is your database's survival shield.
        </p>

        <AIPitfallCallout title='The AI Blind Spot: "Just Cache It with a 60-Second TTL"'>
          <p>
            Ask any AI coding tool how to fix slow endpoints, and it will blindly wrap your database query in Redis with <code>redis.set(key, val, 'EX', 60)</code>. This naive pattern introduces three silent production disasters:
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>Stale Data Inconsistency:</strong> If a user updates their billing address or cancels an order, they immediately read stale data for up to 60 seconds.</li>
            <li><strong>Cache Stampede (Thundering Herd):</strong> The second a high-traffic key expires at second 60, 5,000 concurrent Node.js requests simultaneously experience a cache miss and blast the exact same heavy SQL query into the database, crushing it.</li>
            <li><strong>Dual-Write Race Conditions:</strong> Updating Redis and PostgreSQL sequentially without a clear invalidation strategy results in dirty writes where the cache permanently diverges from the database.</li>
          </ul>
        </AIPitfallCallout>

        <h2>2. The Read &amp; Write Caching Patterns</h2>
        <p>
          Architects must choose caching topology deliberately based on whether the workload is read-heavy or write-heavy, and how much consistency drift is tolerable.
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pattern</th>
                <th>How Reads Work</th>
                <th>How Writes Work</th>
                <th>Ideal Workload</th>
                <th>Key Trade-Off</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Cache-Aside (Lazy Loading)</strong></td>
                <td>App checks cache. On miss, app reads DB and populates cache.</td>
                <td>App writes directly to DB, then <em>deletes</em> the cache key.</td>
                <td>Read-heavy workloads with intermittent writes (e.g. user profiles, articles).</td>
                <td>Cache misses incur 3 network hops. Requires explicit invalidation handling.</td>
              </tr>
              <tr>
                <td><strong>Write-Through</strong></td>
                <td>App checks cache. On miss, cache loads from DB.</td>
                <td>App writes to cache; cache synchronously writes to DB before confirming.</td>
                <td>Workloads requiring strict consistency and read resilience immediately after write.</td>
                <td>Write latency is penalized (two synchronous writes). Unread data fills cache memory.</td>
              </tr>
              <tr>
                <td><strong>Write-Behind (Write-Back)</strong></td>
                <td>App reads from cache.</td>
                <td>App writes to cache immediately; cache asynchronously flushes batch writes to DB.</td>
                <td>Extreme write throughput (e.g. page view counters, real-time analytics, IoT metrics).</td>
                <td>Risk of permanent data loss if cache node crashes before flushing dirty buffers to DB.</td>
              </tr>
              <tr>
                <td><strong>Refresh-Ahead</strong></td>
                <td>App reads from cache.</td>
                <td>Background worker proactively refreshes hot cache keys before their TTL expires.</td>
                <td>Predictable hot keys (e.g. leaderboard, homepage feeds).</td>
                <td>Wasted compute and network if key access patterns are mispredicted.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>3. Interactive Visualizer: Cache-Aside vs Write-Through</h2>
        <p>
          Interact with the simulator below to trace how data and invalidation requests flow through the Node.js application tier, Redis cache, and PostgreSQL database.
        </p>

        <CacheSimulator />

        <h2>4. The Invalidation Dilemma: Update vs Delete?</h2>
        <p>
          When an entity is updated in the database, should your application <strong>update the cache value</strong> or <strong>delete (evict) the cache key</strong>?
        </p>
        <div className="callout callout-coral">
          <h3>The Golden Architectural Rule: Evict, Never Update</h3>
          <p>
            Always <strong>delete the cache key</strong> on write rather than updating it with new data. Why?
          </p>
          <p style={{ margin: 0 }}>
            <strong>Race Conditions:</strong> Imagine two concurrent requests A and B update the same record. Thread A writes to DB first, then Thread B writes to DB. But due to network jitter, Thread B updates Redis first, and Thread A updates Redis second. 
            The cache now holds Thread A's stale data indefinitely! If you delete the key instead, subsequent reads will cleanly reload the true latest version from the database.
          </p>
        </div>

        <h2>5. Production TypeScript Implementation</h2>
        <p>
          Here is how a battle-tested Cache-Aside pattern is structured in TypeScript, incorporating <strong>mutex locking</strong> (Single-Flight) to completely eliminate cache stampedes.
        </p>

        <CodeWindowCard
          title="src/cache/cache-aside-service.ts"
          code={`import Redis from 'ioredis';
import { Pool } from 'pg';

export class UserProfileService {
  constructor(
    private readonly redis: Redis,
    private readonly db: Pool,
    private readonly inFlightReads = new Map<string, Promise<any>>()
  ) {}

  // 1. Read Path: Single-flight Cache-Aside (Eliminates Cache Stampede)
  async getUserProfile(userId: string): Promise<any> {
    const cacheKey = \`user:\${userId}\`;

    // Fast Path: Check in-memory cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Stampede Guard: Coalesce concurrent missing requests into ONE database query
    if (this.inFlightReads.has(cacheKey)) {
      return await this.inFlightReads.get(cacheKey);
    }

    const fetchPromise = (async () => {
      try {
        const result = await this.db.query(
          'SELECT id, name, email FROM users WHERE id = $1',
          [userId]
        );
        const user = result.rows[0] ?? null;

        // Cache result with jittered TTL (e.g. 300s + rand(0..30s))
        const ttl = 300 + Math.floor(Math.random() * 30);
        await this.redis.set(cacheKey, JSON.stringify(user), 'EX', ttl);
        return user;
      } finally {
        this.inFlightReads.delete(cacheKey);
      }
    })();

    this.inFlightReads.set(cacheKey, fetchPromise);
    return await fetchPromise;
  }

  // 2. Write Path: Update DB, then EVICT (Delete) cache key
  async updateUserProfile(userId: string, data: { name: string }): Promise<void> {
    const cacheKey = \`user:\${userId}\`;

    // Step 1: Commit source of truth in PostgreSQL first
    await this.db.query(
      'UPDATE users SET name = $1 WHERE id = $2',
      [data.name, userId]
    );

    // Step 2: Delete cache key. Next read will lazily re-populate.
    await this.redis.del(cacheKey);
  }
}`}
        />

        <h2>6. The Three Infamous Cache Catastrophes</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Failure Mode</th>
                <th>The Mechanism</th>
                <th>The Catastrophic Result</th>
                <th>The Architectural Cure</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Cache Stampede (Thundering Herd)</strong></td>
                <td>A high-traffic key expires or is evicted. 10,000 requests miss simultaneously.</td>
                <td>All requests hit DB at once, locking connection pools and crashing the DB.</td>
                <td><strong>Single-Flight / Mutex Locking</strong> or <strong>Probabilistic Early Expiration (XFetch)</strong>.</td>
              </tr>
              <tr>
                <td><strong>Cache Penetration</strong></td>
                <td>Attackers query for non-existent IDs (e.g., <code>id: -999999</code>) that are never in cache.</td>
                <td>Every request bypasses cache and forces an expensive table scan on the DB.</td>
                <td><strong>Cache Null Values with short TTL</strong> or deploy a <strong>Bloom Filter</strong> in front of cache.</td>
              </tr>
              <tr>
                <td><strong>Cache Avalanche</strong></td>
                <td>Thousands of cache keys are seeded at startup with the exact same 3600-second TTL.</td>
                <td>At second 3600, massive chunks of memory expire simultaneously, overwhelming the DB.</td>
                <td><strong>TTL Jitter</strong>: Add uniform random variance (e.g. <code>TTL = base + rand(0, 15% * base)</code>) to stagger expirations.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>7. Active Retrieval: Architectural Knowledge Check</h2>
        <p>Test your storage strength on caching trade-offs and invalidation dynamics:</p>

        <Quiz
          id="quiz_0003_1"
          question="1. Why is deleting (evicting) a cache key on write preferred over updating the cached entry directly?"
          options={[
            {
              text: 'Updating the cache key consumes significantly more Redis CPU cycles than deleting it.',
              isCorrect: false,
              explanation: 'Redis updates take microseconds; raw write speed is not the primary architectural reason.'
            },
            {
              text: 'Concurrent requests can finish out-of-order, leaving stale data permanently in the cache.',
              isCorrect: true,
              explanation: 'Concurrent updates with varying network latencies cause older data to overwrite newer data in Redis. Eviction avoids stale writes.'
            },
            {
              text: 'Deleting the key reduces total memory consumption across the entire Redis cluster.',
              isCorrect: false,
              explanation: 'Cache size matters, but memory capacity is secondary to data correctness and consistency.'
            },
            {
              text: 'Updating Redis keys requires full schema deserialization which crashes the Node app.',
              isCorrect: false,
              explanation: 'Redis can serialize complex objects just as easily as updating simple strings or hashes.'
            }
          ]}
        />

        <Quiz
          id="quiz_0003_2"
          question="2. A flash sale platform with 50,000 QPS queries for a promo code that expires at 12:00:00. What happens at 12:00:01 without guards?"
          options={[
            {
              text: 'A cache stampede occurs as 50,000 concurrent requests miss and simultaneously hit the database.',
              isCorrect: true,
              explanation: 'This is the classic Cache Stampede. All 50,000 requests miss simultaneously and hit the database at the exact same millisecond.'
            },
            {
              text: 'The database automatically catches the traffic surge and writes a refreshed key to Redis.',
              isCorrect: false,
              explanation: 'The database won\'t automatically redirect anything to cache—it has no knowledge of Redis keys.'
            },
            {
              text: 'A cache penetration event occurs because the promo code key is deleted from the database.',
              isCorrect: false,
              explanation: 'Penetration is querying for non-existent IDs. Here the key existed but simply expired.'
            },
            {
              text: 'The Layer 7 load balancer buffers all 50,000 requests in memory until Redis recovers.',
              isCorrect: false,
              explanation: 'Load balancers distribute HTTP traffic, but cannot prevent backend application workers from querying the database.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0003" />

        <AgentReminder
          title="Explore Further with AI"
          promptText='Have a question about cache consistency, write-behind buffers, or how to implement a Bloom Filter in TypeScript? Ask an AI chat of your choice: "How do I implement single-flight caching in my project?"'
        />
      </div>
    </div>
  );
};
