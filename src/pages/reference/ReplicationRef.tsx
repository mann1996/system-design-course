import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { AgentReminder } from '../../components/UI/AgentReminder';

export const ReplicationRef: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonBadge="Reference Sheet"
            moduleBadge="Distributed Storage"
            time="Storage"
          />
          <h1>Database Replication &amp; Failover Cheat Sheet</h1>
          <p className="lead-text">
            High-density cheat sheet covering Single-Leader, Multi-Leader, and Leaderless replication topologies, lag anomalies, connection pooling rules, and fencing tokens.
          </p>
        </header>

        <h2>1. Replication Topologies at a Glance</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Topology</th>
                <th>Write Handling</th>
                <th>Read Handling</th>
                <th>Strengths</th>
                <th>Weaknesses &amp; Failure Modes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Single-Leader (Primary-Replica)</strong></td>
                <td>Single designated node accepts 100% of writes.</td>
                <td>Distributed across primary &amp; all read replicas.</td>
                <td>Simple consistency model; proven in PostgreSQL/MySQL.</td>
                <td>Write throughput bottlenecked on single primary node; failover downtime.</td>
              </tr>
              <tr>
                <td><strong>Multi-Leader (Active-Active)</strong></td>
                <td>Multiple regional nodes accept writes.</td>
                <td>Read from closest regional leader.</td>
                <td>Survives full datacenter outage; low local write latency.</td>
                <td>Requires complex conflict resolution (LWW, CRDTs); risk of divergent data.</td>
              </tr>
              <tr>
                <td><strong>Leaderless (Dynamo-Style)</strong></td>
                <td>Client writes to multiple nodes directly using Quorum (W + R &gt; N).</td>
                <td>Client reads from multiple nodes; resolves version via vector clocks.</td>
                <td>Zero failover downtime; highly resilient to intermittent crashes.</td>
                <td>No ACID transactions across multiple keys (Cassandra/ScyllaDB).</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. Replication Lag Anomalies &amp; Architectural Mitigations</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Read-Your-Own-Writes</h4>
            <p style={{ fontSize: '14px' }}>
              <strong>Symptom:</strong> User edits profile, clicks Save, and sees old data because GET hits a lagged replica.
            </p>
            <p style={{ fontSize: '13px', margin: 0, fontWeight: 500 }}>
              Fix: Read from Primary for 60 seconds after write, or track user's last updated LSN in session cookie/JWT.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Monotonic Reads</h4>
            <p style={{ fontSize: '14px' }}>
              <strong>Symptom:</strong> Consecutive refreshes bounce between healthy and lagged replicas, causing items to vanish.
            </p>
            <p style={{ fontSize: '13px', margin: 0, fontWeight: 500 }}>
              Fix: Consistent hashing on userId to pin a given user to the same replica.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Consistent Prefix</h4>
            <p style={{ fontSize: '14px' }}>
              <strong>Symptom:</strong> Causal inversion where an answer appears before the question that prompted it.
            </p>
            <p style={{ fontSize: '13px', margin: 0, fontWeight: 500 }}>
              Fix: Ensure causally related writes share identical partition keys and stream sequentially.
            </p>
          </div>
        </div>

        <h2>3. Connection Pool Sizing Architecture</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Layer</th>
                <th>Component</th>
                <th>Standard Configuration</th>
                <th>Architectural Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Application Layer</strong></td>
                <td>Node.js <code>pg.Pool</code></td>
                <td>10&ndash;20 connections per container</td>
                <td>Prevents local container thread starvation without bloating DB</td>
              </tr>
              <tr>
                <td><strong>Proxy Layer</strong></td>
                <td>PgBouncer / AWS RDS Proxy</td>
                <td>Transaction-mode pooling</td>
                <td>Multiplexes thousands of client connections onto dozens of DB sockets</td>
              </tr>
              <tr>
                <td><strong>Database Engine</strong></td>
                <td>PostgreSQL <code>max_connections</code></td>
                <td>100&ndash;300 connections max</td>
                <td>Protects server from OS process fork memory exhaustion</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '40px 0 20px' }}>
          <Link to="/reference/ref-caching" className="btn btn-secondary">
            ← Caching Strategies
          </Link>
          <Link to="/reference/ref-sharding" className="btn btn-primary">
            Next: Sharding &amp; Consistent Hashing →
          </Link>
        </div>

        <AgentReminder
          title="Questions about Primary-Replica failover?"
          promptText='Ask your AI tutor: "How should I configure PgBouncer and Read Replicas in a Node.js microservices architecture?"'
        />
      </div>
    </div>
  );
};
