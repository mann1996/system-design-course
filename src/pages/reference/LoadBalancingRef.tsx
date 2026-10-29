import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';

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
          <h1>Load Balancing &amp; Stateless Ingress Reference</h1>
          <p className="lead-text">
            Architectural reference guide for multi-tier load balancing (L4 vs L7), high-throughput ingress flows, token revocation tradeoffs, cascading health check defenses, and zero-downtime process lifecycles.
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
              <tr>
                <td><strong>IP Stability &amp; Scaling</strong></td>
                <td>Fixed, static Anycast IPs for DNS A-records. Wire-speed packet switching.</td>
                <td>Fleet autoscale dynamically; each proxy pod gets ephemeral private IPs.</td>
              </tr>
              <tr>
                <td><strong>DDoS &amp; SYN Floods</strong></td>
                <td>Absorbs SYN floods and volumetric network attacks at line rate in kernel.</td>
                <td>Vulnerable to memory/CPU exhaustion if directly exposed without L4 protection.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. End-to-End High-Throughput Ingress Topology</h2>
        <p>In Tier-1 distributed architectures, L4 and L7 collaborate in a layered hierarchy:</p>
        <CodeWindowCard
          title="ingress-network-topology.txt"
          code={`[ Internet Users ]
       │
       ▼
[ DNS Anycast (Cloudflare / Route 53) ] ── BGP Anycast routes user to nearest Edge PoP
       │
       ▼
[ Layer 4 NLB / HAProxy TCP ] ── Static Anycast IPs; 5-tuple hash fanning out millions of TCP streams
       │
       ├── Raw TCP ──► [ L7 Envoy Gateway 1 ] ── Decrypts TLS, parses HTTP/2, WAF, routes /api/v1/tickets
       ├── Raw TCP ──► [ L7 Envoy Gateway 2 ] ── Offloads TLS crypto from workers, keep-alive pooling
       └── Raw TCP ──► [ L7 Envoy Gateway 3 ] ── Path-based routing & token bucket rate limiting
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [ Compute Node 1 (4 vCPUs) ]    [ Compute Node 2 (4 vCPUs) ]
    ├── Worker 1 (Core 0)           ├── Worker 1 (Core 0)
    ├── Worker 2 (Core 1)           ├── Worker 2 (Core 1)
    ├── Worker 3 (Core 2)           ├── Worker 3 (Core 2)
    └── Worker 4 (Core 3)           └── Worker 4 (Core 3)
               │                               │
               └───────────────┬───────────────┘
                               ▼
               [ Central Redis Cluster / State Store ]`}
        />

        <h2>3. Load Balancing Algorithms</h2>
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

        <h2>4. Token Verification: Stateless JWT vs. Opaque Token + Redis</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Evaluation Dimension</th>
                <th>Stateless JWT</th>
                <th>Opaque Token + Redis Lookup</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Revocation Speed</strong></td>
                <td>Cannot revoke immediately without stateful blacklist. Compromised bots stay active until TTL expires.</td>
                <td><strong>Instantaneous</strong>: <code>DEL session:token</code> drops access across all nodes in &lt;1ms.</td>
              </tr>
              <tr>
                <td><strong>Compute &amp; Network Overhead</strong></td>
                <td>Zero network I/O per check; larger header payload (500–1500 bytes per request).</td>
                <td>1 network trip to Redis (0.5–1ms); tiny token payload (32 bytes UUID).</td>
              </tr>
              <tr>
                <td><strong>Production Recommendation</strong></td>
                <td>Low-risk read APIs or internal microservice-to-microservice tokens.</td>
                <td><strong>High-stakes flash sales, ticketing, and banking</strong> where instant bot revocation is mandatory.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>5. Health Checks &amp; Preventing Cascading Death Spirals</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Check Type</th>
                <th>Target Endpoint</th>
                <th>Evaluation Scope</th>
                <th>Failure Response</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Liveness</strong></td>
                <td><code>/live</code> or <code>/healthz</code></td>
                <td>Is event loop spinning? Memory below hard ceiling? <strong>Ultra-shallow.</strong></td>
                <td>Restart container/worker process.</td>
              </tr>
              <tr>
                <td><strong>Readiness</strong></td>
                <td><code>/ready</code></td>
                <td>Is node warmed up and ready for traffic? Is worker shutting down?</td>
                <td>Temporarily remove node from load balancer routing pool.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="callout callout-source" style={{ margin: '20px 0' }}>
          <div className="callout-title">Cascading Outage Antipattern</div>
          <p style={{ margin: 0 }}>
            <strong>Never check external downstream databases (PostgreSQL/Redis) inside per-instance health checks!</strong> If the database experiences a 2-second query queue, all compute nodes fail health checks simultaneously. The load balancer terminates traffic to all nodes, producing a global outage from a transient database delay. Set <strong>Envoy Panic Threshold = 50%</strong> (fail-open) so that if &gt;50% of nodes report unhealthy, traffic is routed to all nodes anyway rather than dropping 100% of requests.
          </p>
        </div>

        <h2>6. Zero-Downtime Graceful Shutdown (SIGTERM)</h2>
        <ol style={{ paddingLeft: '20px', lineHeight: '1.7' }}>
          <li><strong>Catch SIGTERM:</strong> Intercept termination signal from auto-scaler or container orchestrator.</li>
          <li><strong>Flip Readiness:</strong> Immediately respond with <code>HTTP 503</code> on <code>/ready</code> so load balancers stop sending new requests.</li>
          <li><strong>Connection Draining Window:</strong> Sleep 5–10 seconds to allow upstream load balancer routing tables to propagate.</li>
          <li><strong>Terminate Keep-Alives:</strong> Inject <code>Connection: close</code> headers into responses of existing HTTP keep-alive connections.</li>
          <li><strong>Close Server Listener:</strong> Execute <code>server.close()</code> to reject new TCP connections while allowing in-flight requests to complete.</li>
          <li><strong>Close Upstream Pools:</strong> Await termination of Redis and database client pools (<code>await redis.quit()</code>).</li>
          <li><strong>Clean Exit:</strong> Call <code>process.exit(0)</code>; fallback to <code>process.exit(1)</code> if a hard timeout (e.g. 25s) is exceeded.</li>
        </ol>

        <h2>7. The &quot;Stateless Server&quot; Checklist</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>1. User Sessions &amp; Auth Tokens</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Never store sessions in process memory. Use external central Redis session stores or ephemeral tokens with central revocation.
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
              Never run in-process <code>node-cron</code> across replicas. Use an external trigger (AWS EventBridge, BullMQ).
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>4. Rate Limiting</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Never store rate-limit counters in local RAM. Use Redis sliding-window locks or Cloudflare edge rate limiters.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>5. Multi-Core Utilization</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Saturate all host vCPUs via <code>node:cluster</code> or container replicas, sharing ports via <code>SO_REUSEPORT</code> without shared memory.
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
          promptText='Ask an AI chat of your choice: "How do I audit my Express/Fastify app to ensure it is 100% ready for horizontal scaling behind an ALB and NLB?"'
        />
      </div>
    </div>
  );
};
