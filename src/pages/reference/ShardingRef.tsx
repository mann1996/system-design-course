import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';

export const ShardingRef: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonBadge="Reference Sheet"
            moduleBadge="Partitioning"
            time="Partitioning"
          />
          <h1>Sharding &amp; Consistent Hashing Cheat Sheet</h1>
          <p className="lead-text">
            Architectural reference for horizontal database partitioning, consistent hash ring topology, partition key selection, and avoiding cross-shard fanout.
          </p>
        </header>

        <h2>1. Partitioning Strategies Comparison Matrix</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Routing Logic</th>
                <th>Best For</th>
                <th>Primary Strength</th>
                <th>Failure Modes &amp; Risks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Range-Based</strong></td>
                <td>Contiguous intervals (e.g. A–G, date ranges).</td>
                <td>Time-series metrics, catalogs.</td>
                <td>Fast single-shard range scans.</td>
                <td><strong>Severe hotspots!</strong> Current timestamp shard receives 100% of write traffic.</td>
              </tr>
              <tr>
                <td><strong>Hash-Based (Modulo)</strong></td>
                <td><code>hash(key) % N</code></td>
                <td>Static clusters with fixed node counts.</td>
                <td>Uniform data distribution.</td>
                <td><strong>Resharding nightmare:</strong> Adding node N+1 invalidates ~80%+ of keys.</td>
              </tr>
              <tr>
                <td><strong>Consistent Hashing</strong></td>
                <td>Key and nodes mapped on 2³² - 1 ring; clockwise lookup.</td>
                <td>Dynamic distributed clusters (Cassandra, DynamoDB, Redis Cluster).</td>
                <td>Adding node moves only 1/N keys. Minimal rebalancing churn.</td>
                <td>Requires virtual tokens per physical node to prevent uneven ring distribution.</td>
              </tr>
              <tr>
                <td><strong>Directory / Lookup Table</strong></td>
                <td>Central service maps <code>entityId &rarr; shardId</code>.</td>
                <td>Enterprise multi-tenant systems with dedicated VIP shards.</td>
                <td>Complete freedom to reassign arbitrary tenants without key rehashing.</td>
                <td>Lookup directory becomes a single point of failure and read latency bottleneck.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. Rules for Choosing a Partition Key</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--color-primary)' }}>High Cardinality</h4>
            <p style={{ fontSize: '14px' }}>
              The key must have millions of distinct values (e.g. <code>userId</code>, <code>orderId</code>, <code>uuid</code>).
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-error)', margin: 0 }}>
              Anti-pattern: Sharding on <code>countryCode</code> (only 50–200 values), causing irreversible shard skew.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Query Co-Location</h4>
            <p style={{ fontSize: '14px' }}>
              Choose a key included in &gt;90% of write and read query predicates (e.g. <code>tenant_id</code>).
            </p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Enables local single-shard SQL joins without network cross-shard fanout.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Even Write Distribution</h4>
            <p style={{ fontSize: '14px' }}>
              Writes should distribute uniformly across shards at any given second.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-error)', margin: 0 }}>
              Anti-pattern: Auto-incrementing IDs or timestamps that serialize all inserts onto the newest shard.
            </p>
          </div>
        </div>

        <h2>3. Hotspot Remediation: The Salting Formula</h2>
        <CodeWindowCard
          title="Compound Salted Shard Key"
          code={`// Split a single hot key across 10 shards
function getSaltedKey(userId: string): string {
  const salt = Math.floor(Math.random() * 10);
  return \`\${userId}_\${salt}\`;
}`}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '40px 0 20px' }}>
          <Link to="/reference/ref-replication" className="btn btn-secondary">
            ← Replication Cheat Sheet
          </Link>
          <Link to="/reference/ref-queues" className="btn btn-primary">
            Next: Message Queues &amp; Streams →
          </Link>
        </div>

        <AgentReminder
          title="Considering Citus Data, Vitess, or Spanner?"
          promptText='Ask an AI chat of your choice: "How should I structure my database schema before partitioning to avoid cross-shard joins?"'
        />
      </div>
    </div>
  );
};
