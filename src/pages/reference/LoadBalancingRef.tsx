import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { AgentReminder } from '../../components/UI/AgentReminder';

export const LoadBalancingRef: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonBadge="Reference Sheet"
            moduleBadge="Compute Architecture"
            time="Networking"
          />
          <h1>Load Balancing &amp; Stateless Compute Reference</h1>
          <p className="lead-text">
            Permanent reference guide for horizontal scaling, traffic distribution patterns, and eliminating stateful traps in Node.js backends.
          </p>
        </header>

        <h2>1. Layer 4 vs. Layer 7 Load Balancing</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Layer 4 (Transport / TCP)</th>
                <th>Layer 7 (Application / HTTP)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Inspection Level</strong></td>
                <td>IP address + TCP/UDP port only. Does not decrypt or inspect HTTP payload.</td>
                <td>Full HTTP/HTTPS inspection (Headers, URLs, Cookies, JSON body).</td>
              </tr>
              <tr>
                <td><strong>Performance &amp; Latency</strong></td>
                <td>Ultra-fast, millions of packets/sec, near-zero CPU overhead per packet.</td>
                <td>Slightly higher compute cost (TLS termination, HTTP request parsing).</td>
              </tr>
              <tr>
                <td><strong>Routing Capabilities</strong></td>
                <td>Simple packet forwarding to backend IP pools.</td>
                <td>Smart path-based routing (e.g., <code>/api/*</code> to Node, <code>/static/*</code> to CDN/S3).</td>
              </tr>
              <tr>
                <td><strong>Common Technologies</strong></td>
                <td>AWS NLB (Network Load Balancer), HAProxy (TCP mode), Linux IPVS.</td>
                <td>AWS ALB (Application Load Balancer), Nginx, Traefik, Envoy, Cloudflare.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. Load Balancing Algorithms</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>How It Works</th>
                <th>Ideal Use Case &amp; Caveats</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Round Robin</strong></td>
                <td>Requests sequentially distributed 1 &rarr; 2 &rarr; 3 &rarr; 1.</td>
                <td>Best when requests require identical processing time.</td>
              </tr>
              <tr>
                <td><strong>Least Connections</strong></td>
                <td>Routes traffic to the node currently serving the fewest active connections.</td>
                <td>Best for uneven workloads, WebSocket connections, or long-running database requests.</td>
              </tr>
              <tr>
                <td><strong>IP Hash / Sticky Sessions</strong></td>
                <td>Client IP is hashed to consistently pin a user to one backend server.</td>
                <td><strong>Antipattern for web apps:</strong> Defeats auto-scaling and causes uneven server load.</td>
              </tr>
              <tr>
                <td><strong>Consistent Hashing</strong></td>
                <td>Keys mapped to a virtual ring; adding/removing a server remaps minimal keys.</td>
                <td>Essential for distributed caches (Memcached/Redis) and sharded databases.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>3. The "Stateless Server" Checklist</h2>
        <p>To safely scale Node.js horizontally, every server process must be completely disposable:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>1. User Sessions &amp; Auth Tokens</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Never store sessions in process memory. Use stateless signed JWTs or external central Redis session stores.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>2. File Uploads</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Never save uploads to local server disk (<code>/uploads/avatar.png</code>). Upload directly to S3 / Cloud Storage via presigned URLs.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>3. Scheduled Cron Tasks</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Never run in-process <code>node-cron</code> across 4 replicas (it runs 4 times!). Use an external trigger (AWS EventBridge, BullMQ).
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>4. Rate Limiting</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Never store rate-limit counters in local RAM. Use Redis sliding-window locks or Cloudflare edge rate limiters.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '40px 0 20px' }}>
          <Link to="/reference/ref-latency" className="btn btn-secondary">
            ← Latency Hierarchy
          </Link>
          <Link to="/reference/ref-caching" className="btn btn-primary">
            Next: Caching Strategies →
          </Link>
        </div>

        <AgentReminder
          title="Scaling a monolithic backend?"
          promptText='Ask your AI tutor: "How do I audit my Express app to ensure it is 100% ready for horizontal scaling behind an ALB?"'
        />
      </div>
    </div>
  );
};
