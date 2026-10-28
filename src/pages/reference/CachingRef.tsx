import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { AgentReminder } from '../../components/UI/AgentReminder';

export const CachingRef: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonBadge="Reference Sheet"
            moduleBadge="State &amp; Caching"
            time="Storage"
          />
          <h1>Caching Patterns &amp; Invalidation Reference</h1>
          <p className="lead-text">
            A definitive cheat sheet on caching topologies, eviction policies, stampede mitigation, and cache vs database consistency rules.
          </p>
        </header>

        <h2>1. Caching Topology Decision Matrix</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Data Read Flow</th>
                <th>Data Write Flow</th>
                <th>Consistency</th>
                <th>Write Latency</th>
                <th>Recommended Use Case</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Cache-Aside (Lazy)</strong></td>
                <td>App checks cache; loads from DB on miss</td>
                <td>App writes to DB; <strong>evicts (deletes)</strong> cache key</td>
                <td>Eventual (resilient against dirty writes)</td>
                <td>Low (only writes to DB)</td>
                <td>General web applications; read-heavy with infrequent writes</td>
              </tr>
              <tr>
                <td><strong>Write-Through</strong></td>
                <td>App checks cache; loads from DB on miss</td>
                <td>App writes to cache; cache synchronously writes to DB</td>
                <td>High (cache and DB match on confirm)</td>
                <td>High (2 synchronous network hops)</td>
                <td>Financial transactions, strictly consistent state</td>
              </tr>
              <tr>
                <td><strong>Write-Behind (Write-Back)</strong></td>
                <td>App reads from cache</td>
                <td>App writes to cache; cache asynchronously batch flushes to DB</td>
                <td>Weak (unpersisted writes in RAM)</td>
                <td>Lowest (RAM speed, non-blocking)</td>
                <td>Analytics ingest, page view counters, high-throughput IoT time-series</td>
              </tr>
              <tr>
                <td><strong>Refresh-Ahead</strong></td>
                <td>App reads from cache</td>
                <td>Background worker reloads hot keys before TTL expires</td>
                <td>Eventual</td>
                <td>Neutral (async background)</td>
                <td>Highly predictable hot keys (frontpage feeds, global leaderboards)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. Cache Eviction Policies (Memory Management)</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Policy</th>
                <th>Mechanism</th>
                <th>When to Choose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>LRU (Least Recently Used)</strong></td>
                <td>Evicts keys that have not been read/written for the longest duration.</td>
                <td><strong>Standard default</strong> for almost all general-purpose web caches.</td>
              </tr>
              <tr>
                <td><strong>LFU (Least Frequently Used)</strong></td>
                <td>Evicts keys accessed fewest times over history using a logarithmic counter.</td>
                <td>Long-lived catalogs, media libraries where true popularity dictates value.</td>
              </tr>
              <tr>
                <td><strong>volatile-ttl</strong></td>
                <td>Evicts keys with the shortest remaining Time-To-Live (TTL).</td>
                <td>When keys have diverse, business-critical retention lifespans.</td>
              </tr>
              <tr>
                <td><strong>noeviction</strong></td>
                <td>Returns out-of-memory errors on new writes when memory limit is reached.</td>
                <td>When Redis is used as a strict datastore or broker, not a disposable cache.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>3. The 3 Classic Cache Disasters &amp; Defenses</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>1. Cache Stampede</h4>
            <p style={{ fontSize: '14px' }}>
              A popular key expires. 10,000 requests miss simultaneously and all hit the database at once.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-primary)', margin: 0, fontWeight: 500 }}>
              Fix: Single-Flight locking or Probabilistic Early Expiration (XFetch).
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>2. Cache Penetration</h4>
            <p style={{ fontSize: '14px' }}>
              Requests query non-existent IDs that never exist in the cache, forcing table scans on the DB.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-primary)', margin: 0, fontWeight: 500 }}>
              Fix: Cache null values with short TTL (30s) or deploy a Bloom filter in front of cache.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>3. Cache Avalanche</h4>
            <p style={{ fontSize: '14px' }}>
              Massive batches of keys expire at the exact same second due to uniform TTLs.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-primary)', margin: 0, fontWeight: 500 }}>
              Fix: Add random TTL jitter (e.g., base TTL + rand(0, 15% * base)).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '40px 0 20px' }}>
          <Link to="/reference/ref-lb" className="btn btn-secondary">
            ← Load Balancing
          </Link>
          <Link to="/reference/ref-replication" className="btn btn-primary">
            Next: Database Replication Cheat Sheet →
          </Link>
        </div>

        <AgentReminder
          title="Questions about Redis Cluster or Memcached?"
          promptText='Ask your AI tutor: "How should I design caching for my application to avoid cache stampede?"'
        />
      </div>
    </div>
  );
};
