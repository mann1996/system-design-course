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
import { ClusterSimulator } from '../../components/Simulators/ClusterSimulator';

export const Lesson0002: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0002"
            lessonBadge="Lesson 0002"
            moduleBadge="Module 1: Foundations & Compute"
            time="25 mins"
            tag="Ingress & Compute"
          />
          <h1>Scaling the Compute Layer: Horizontal Scaling, Ingress &amp; Resilience</h1>
          <p className="lead-text">
            How to architect high-throughput stateless compute clusters: multi-tier load balancing (L4 vs L7), saturating multi-core Node.js runtimes, immediate token revocation, cascading health check avoidance, and zero-downtime graceful shutdown.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0002" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 1 (&quot;Reliability &amp; Maintainability&quot;), the{' '}
              <a href="https://12factor.net/processes" target="_blank" rel="noopener noreferrer">
                Twelve-Factor App Methodology: VI. Processes
              </a>, and the AWS Builders&apos; Library:{' '}
              <a href="https://aws.amazon.com/builders-library/graceful-shutdowns-with-ecs/" target="_blank" rel="noopener noreferrer">
                Graceful Shutdowns &amp; Health Checks in Production
              </a>.
            </p>
          }
        />

        <h2>1. The Two Ways to Scale Compute</h2>
        <p>
          In <Link to="/lessons/0001">Lesson 0001</Link>, we saw how back-of-the-envelope estimation determines when a single server is sufficient and when scale demands distributed infrastructure. When traffic surges beyond ~2,000 QPS, or when high-availability guarantees dictate zero downtime during hardware failures, we must evaluate scaling dimensions:
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Vertical Scaling (Scale Up)</th>
                <th>Horizontal Scaling (Scale Out)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Mechanism</strong></td>
                <td>Upgrade existing hardware (e.g. 4 vCPUs &rarr; 64 vCPUs, 16GB &rarr; 256GB RAM).</td>
                <td>Add identical compute replicas behind a Load Balancer (1 node &rarr; 20 nodes).</td>
              </tr>
              <tr>
                <td><strong>Complexity</strong></td>
                <td>Zero code changes. Everything remains on <code>localhost</code>.</td>
                <td>Requires <strong>total statelessness</strong>, multi-tier load balancers, and externalized state stores.</td>
              </tr>
              <tr>
                <td><strong>Ceiling &amp; Cost</strong></td>
                <td>Hard physical hardware limits. Exponential cost curve.</td>
                <td>Virtually unbounded ceiling using elastic, cost-efficient commodity virtual machines.</td>
              </tr>
              <tr>
                <td><strong>Availability</strong></td>
                <td><strong>Single Point of Failure (SPOF)</strong>. Hardware crashes take down the entire system.</td>
                <td><strong>High Availability (HA)</strong>. If individual nodes die, traffic is rerouted seamlessly with zero downtime.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. The Node.js Multi-Core Challenge: Saturating 4+ vCPUs</h2>
        <p>
          Because Node.js executes JavaScript on a single-threaded event loop, <strong>one Node.js process can utilize exactly ONE CPU core</strong>.
        </p>
        <p>
          Deploying a Node.js application to a 4-vCPU or 16-vCPU cloud instance using a simple <code>node server.js</code> command is an immediate red flag:
        </p>
        <ul>
          <li>1 core runs at 100% capacity under peak load.</li>
          <li>The remaining cores sit idle at <strong>0% utilization</strong>. You waste 75% to 93% of the provisioned compute capacity.</li>
        </ul>

        <div className="callout callout-source">
          <div className="callout-title">The Architect&apos;s Solution: Process Concurrency</div>
          <p style={{ margin: 0 }}>
            To utilize all CPU cores without inter-process state sharing, production systems use one of two battle-tested topologies:
            <br /><br />
            <strong>1. The Native Cluster Module (<code>node:cluster</code>):</strong> The master process forks one worker per vCPU. Workers share the server port using OS-level <code>SO_REUSEPORT</code> or kernel socket distribution. Each worker runs an isolated V8 heap and garbage collector.
            <br /><br />
            <strong>2. Container Replicas (Kubernetes / ECS / Nomad):</strong> Rather than in-process clustering, orchestrators schedule independent single-process containers pinned to 1 vCPU each, distributing traffic directly to container network interfaces.
          </p>
        </div>

        <CodeWindowCard
          title="cluster-server.ts — Multi-Core Node.js Worker Architecture"
          code={`import cluster from 'node:cluster';
import http from 'node:http';
import os from 'node:os';

const numCPUs = os.cpus().length; // e.g. 4 vCPUs

if (cluster.isPrimary) {
  console.log(\`Primary master \${process.pid} is online. Forking \${numCPUs} workers...\`);

  // Fork workers — 1 process per vCPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Self-healing: Automatically replace any crashed worker process
  cluster.on('exit', (worker, code, signal) => {
    console.warn(\`Worker \${worker.process.pid} died (\${signal || code}). Spawning replacement...\`);
    cluster.fork();
  });
} else {
  // Workers share the TCP connection pool via the underlying OS socket
  const server = http.createServer((req, res) => {
    // Workers are 100% stateless: All persistent state lives in Redis
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', workerPid: process.pid }));
  });

  server.listen(3000);
  console.log(\`Worker process \${process.pid} listening on port 3000\`);
}`}
        />

        <h2>3. Multi-Tier Ingress Topology: DNS Anycast &rarr; L4 &rarr; L7 &rarr; Compute</h2>
        <p>
          At enterprise scale (e.g., 60,000+ peak QPS), a single load balancer cannot handle both packet-level wire throughput and deep application-layer inspection. We position a <strong>Layer 4 Load Balancer</strong> in front of a horizontally autoscaling <strong>Layer 7 API Gateway</strong> fleet:
        </p>

        <CodeWindowCard
          title="network-topology-flow.txt"
          code={`[ Client Traffic ]
       │
       ▼
[ DNS Anycast (Cloudflare / Route 53) ] ── (Routes user to topologically closest edge PoP)
       │
       ▼
[ Layer 4 Load Balancer (AWS NLB / HAProxy TCP) ] ── (Ultra-fast IP+Port hashing; millions of pkts/sec)
       │
       ├── Raw TCP Stream ──► [ L7 Envoy / NGINX Gateway 1 ] ── TLS Termination, WAF, Routing
       ├── Raw TCP Stream ──► [ L7 Envoy / NGINX Gateway 2 ] ── Token validation, Path-based routing
       └── Raw TCP Stream ──► [ L7 Envoy / NGINX Gateway 3 ] ── Keep-alive connection pooling
                                       │
               ┌───────────────────────┴───────────────────────┐
               ▼                                               ▼
    [ Compute Node A (4 vCPUs) ]                    [ Compute Node B (4 vCPUs) ]
    ├── Worker 1 (Port 3000)                        ├── Worker 1 (Port 3000)
    ├── Worker 2 (Port 3000)                        ├── Worker 2 (Port 3000)
    ├── Worker 3 (Port 3000)                        ├── Worker 3 (Port 3000)
    └── Worker 4 (Port 3000)                        └── Worker 4 (Port 3000)
               │                                               │
               └───────────────────────┬───────────────────────┘
                                       ▼
                       [ Shared Redis Cluster (Memory) ]`}
        />

        <h3>Why Position L4 in Front of L7?</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Factor</th>
                <th>Layer 4 (e.g. AWS NLB / HAProxy TCP)</th>
                <th>Layer 7 (e.g. Envoy / NGINX / ALB)</th>
                <th>Architectural Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Inspection Level</strong></td>
                <td>Transport layer only (IP + TCP/UDP port). No TLS decryption or HTTP payload parsing.</td>
                <td>Application layer (decrypts TLS, parses HTTP headers, cookies, URL paths, JSON bodies).</td>
                <td>L4 executes in kernel space with negligible CPU cost, allowing wire-speed packet switching.</td>
              </tr>
              <tr>
                <td><strong>Throughput &amp; Scaling</strong></td>
                <td>Handles <strong>millions of packets/sec</strong> per interface with sub-millisecond latency.</td>
                <td>CPU-bound due to TLS crypto handshakes and HTTP frame processing (tens of thousands of QPS).</td>
                <td>L4 fans out raw TCP traffic across a dynamically autoscaling fleet of L7 proxies.</td>
              </tr>
              <tr>
                <td><strong>IP Stability</strong></td>
                <td>Provides deterministic, static Elastic Anycast IPs.</td>
                <td>Backend proxy instances autoscale dynamically with ephemeral private IPs.</td>
                <td>DNS A-records point to unchanging L4 IPs, eliminating DNS propagation delays during autoscaling.</td>
              </tr>
              <tr>
                <td><strong>DDoS &amp; SYN Floods</strong></td>
                <td>Absorbs SYN floods and volumetric attacks at line rate.</td>
                <td>Vulnerable to socket and memory exhaustion if exposed directly to raw floods.</td>
                <td>L4 shields L7 from connection-exhaustion attacks without paying TLS handshake costs.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>4. The #1 AI Coding Bug: The Stateful Server Trap</h2>
        <p>
          When AI coding assistants generate authentication, rate limiting, or session management, they instinctively store state in local process memory:
        </p>

        <CodeWindowCard
          title="naive-ai-server.js — Dangerous In-Memory Pattern"
          code={`// NAIVE AI PATTERN: In-memory session store
const activeSessions = new Map();

app.post('/login', (req, res) => {
  const sessionId = crypto.randomUUID();
  activeSessions.set(sessionId, { userId: user.id }); // Stored in Server RAM!
  res.cookie('sid', sessionId);
  res.send('Logged in');
});

app.get('/dashboard', (req, res) => {
  const session = activeSessions.get(req.cookies.sid);
  if (!session) return res.status(401).send('Unauthorized'); // BUG UNDER HORIZONTAL SCALING!
  res.send('Welcome');
});`}
        />

        <AIPitfallCallout title="Why This Works on Localhost but Fails in Production">
          <p>
            On a developer machine, there is only 1 server instance. Both <code>/login</code> and <code>/dashboard</code> hit the same process RAM.
          </p>
          <p>In production with multiple replicas behind a round-robin load balancer:</p>
          <ol style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li>User logs in via <code>POST /login</code> &rarr; Load Balancer routes to <strong>Worker A</strong>. Session saved in Worker A&apos;s RAM.</li>
            <li>User navigates to <code>GET /dashboard</code> &rarr; Load Balancer routes to <strong>Worker B</strong>.</li>
            <li>Worker B inspects its own local memory &rarr; Session not found &rarr; <strong>HTTP 401 Unauthorized!</strong></li>
            <li>The user is randomly logged out on almost every click or refresh.</li>
          </ol>
        </AIPitfallCallout>

        <h2>5. Interactive Simulator: Stateful vs. Stateless Cluster</h2>
        <p>
          Experience this distributed failure firsthand. Toggle between Stateful and Stateless modes, click <strong>&quot;1. Login User&quot;</strong>, and then click <strong>&quot;2. Fetch Profile&quot;</strong> repeatedly to watch how requests route across servers.
        </p>

        <ClusterSimulator />

        <h2>6. Session &amp; Auth Architecture: Stateless JWT vs. Opaque Token with Redis</h2>
        <p>
          When architecting high-throughput ingress for flash sales, ticket drops, or financial transactions, a critical design decision emerges: <strong>Stateless JWT</strong> vs. <strong>Opaque Token with Redis Lookup</strong>.
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Criteria</th>
                <th>Stateless JWT</th>
                <th>Opaque Token + Redis Lookup</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Verification Cost</strong></td>
                <td>Zero network I/O. Verified locally via cryptographic signature (RS256 / Ed25519).</td>
                <td>Requires 1 fast network round-trip to Redis (<code>~0.5ms to 1.0ms</code>).</td>
              </tr>
              <tr>
                <td><strong>Payload Size</strong></td>
                <td>Large (500 to 1,500+ bytes per request). Increases ingress bandwidth.</td>
                <td>Tiny (32 to 64 bytes for a UUID/hex nonce). Minimizes network overhead.</td>
              </tr>
              <tr>
                <td><strong>Immediate Revocation</strong></td>
                <td>
                  <strong style={{ color: 'var(--error, #c64545)' }}>Impossible without central state.</strong> If a bot is discovered, its JWT remains valid until the token reaches expiration.
                </td>
                <td>
                  <strong style={{ color: 'var(--success, #5db872)' }}>Instantaneous.</strong> Deleting the session key in Redis (<code>DEL session:id</code>) revokes access on the very next millisecond.
                </td>
              </tr>
              <tr>
                <td><strong>Recommended Use Case</strong></td>
                <td>Read-heavy public APIs where tokens are short-lived (e.g. 5 mins) and immediate revocation is not critical.</td>
                <td><strong>High-stakes flash sales, ticketing, and banking</strong> where bot detection and fraud rings must be terminated immediately.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="callout callout-source">
          <div className="callout-title">The Senior Architect&apos;s Recommendation</div>
          <p style={{ margin: 0 }}>
            If you need <strong>immediate bot and compromised account revocation</strong> during a live drop, pure stateless JWTs fail because compute nodes cannot detect revocation without querying shared state. A centralized <strong>Opaque Token with Redis cache lookup</strong> (or a hybrid short-lived JWT backed by an in-memory Redis revocation blacklist) is required to guarantee immediate eviction across all compute instances.
          </p>
        </div>

        <h2>7. Resilience: Defeating the Cascading Health-Check Death Spiral</h2>
        <p>
          Health checks are designed to protect availability, but poor configuration frequently transforms minor slowdowns into <strong>total cluster collapse</strong>.
        </p>

        <h3>Separating Endpoint Roles: /live vs. /ready</h3>
        <ul>
          <li>
            <strong>Liveness (<code>/live</code> or <code>/healthz</code>):</strong> Answers: <em>&quot;Is the Node.js event loop alive and responsive, or is the process deadlocked/crashed?&quot;</em> Must be ultra-shallow. Return HTTP 200 immediately. If it fails consecutively, the orchestrator kills and restarts the process.
          </li>
          <li>
            <strong>Readiness (<code>/ready</code>):</strong> Answers: <em>&quot;Is this instance currently prepared to accept live user traffic?&quot;</em> Verifies local memory headroom and connection initialization. If it fails, the load balancer stops routing traffic to this node until it recovers.
          </li>
        </ul>

        <AIPitfallCallout title="The Cascading Outage Scenario (Death Spiral)">
          <p>
            Imagine 40 compute nodes running at 65% CPU. A traffic spike pushes CPU to 85%, causing event loop delay to reach 600ms.
          </p>
          <p>
            If the load balancer health check is misconfigured with an aggressive 500ms timeout, or if the health check query synchronously pings the database/Redis:
          </p>
          <ol style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li>15% of nodes take 650ms to answer their health ping and time out.</li>
            <li>The load balancer marks those 6 nodes <strong>UNHEALTHY</strong> and drops them from the pool.</li>
            <li>100% of incoming traffic now slams into the remaining 34 nodes (+18% traffic increase per node).</li>
            <li>Remaining nodes hit 95% CPU; their event loops lag even further. More health checks time out.</li>
            <li>The load balancer evicts another 10 nodes. Within 60 seconds, <strong>every single healthy node is marked dead</strong>. Total system collapse.</li>
          </ol>
        </AIPitfallCallout>

        <div className="callout callout-source">
          <div className="callout-title">Production Guardrails Against Health Check Cascades</div>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>Never check external downstream databases in shallow health pings:</strong> A minor database slowdown must not cause the load balancer to kill your stateless compute tier.</li>
            <li><strong>Tune thresholds conservatively:</strong> Require 3 to 5 consecutive failures across 15–30 seconds before evicting a compute node.</li>
            <li><strong>Configure Load Balancer Panic Threshold (Fail-Open):</strong> In Envoy and modern L7 gateways, set a <code>panic_threshold = 50%</code>. If more than 50% of your fleet is marked unhealthy simultaneously, the proxy ignores health status and routes traffic across <strong>all</strong> nodes. Serving traffic with degraded latency is vastly superior to routing 60,000 QPS into an empty pool.</li>
          </ul>
        </div>

        <h2>8. Zero-Downtime Graceful Shutdown (The SIGTERM Lifecycle)</h2>
        <p>
          When an auto-scaler scales down nodes after a traffic spike, or during zero-downtime rolling deployments, the orchestrator sends a <code>SIGTERM</code> signal.
        </p>
        <p>
          If the process executes <code>process.exit(0)</code> immediately, active TCP connections drop abruptly, causing <code>ECONNRESET</code> socket errors and HTTP 502 Bad Gateway responses for users in the middle of purchasing tickets.
        </p>

        <CodeWindowCard
          title="graceful-shutdown.ts — Production Node.js Zero-Downtime Handler"
          code={`import http from 'node:http';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

let isShuttingDown = false;

const server = http.createServer((req, res) => {
  // 1. Readiness Probe
  if (req.url === '/ready') {
    if (isShuttingDown) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      return res.end('Deregistering from pool');
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Ready');
  }

  // 2. Liveness Probe (always shallow)
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Alive');
  }

  // 3. Signal clients to close keep-alive TCP connections during shutdown
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
  }

  // Execute business logic...
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'success' }));
});

// Configure keep-alive timeout higher than upstream LB idle timeout
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(3000);

// --- THE GRACEFUL SHUTDOWN SEQUENCE ---
const handleShutdown = (signal: string) => {
  console.log(\`Received \${signal}. Initiating zero-downtime graceful drain...\`);
  isShuttingDown = true;

  // STEP 1: Wait for Load Balancer Connection Draining window (e.g. 5 seconds)
  // This allows the LB to detect /ready returning 503 and stop routing NEW requests.
  setTimeout(() => {
    // STEP 2: Stop accepting new TCP connections
    server.close(() => {
      console.log('HTTP listener closed. In-flight requests drained.');

      // STEP 3: Cleanly close persistent database & Redis pools
      redis.quit().then(() => {
        console.log('Redis connections closed cleanly. Exiting.');
        process.exit(0);
      });
    });

    // STEP 4: Hard deadline fallback (prevent hanging promises from blocking exit)
    setTimeout(() => {
      console.error('Graceful drain exceeded deadline (25s). Forcing termination.');
      process.exit(1);
    }, 25000).unref();

  }, 5000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));`}
        />

        <h2>9. The 5-Point Statelessness Checklist</h2>
        <p>To safely scale Node.js horizontally without downtime or lost data, enforce these five architectural rules:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>1. Auth &amp; Sessions</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Zero in-memory user maps. Use external Redis session stores or signed tokens with centralized revocation.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>2. File Storage</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Never save uploads to local server disk. Stream uploads directly to S3 or object storage via presigned URLs.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>3. Background Cron Jobs</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Never run in-process timers (<code>node-cron</code>) across replicas. Delegate to external orchestrators (AWS EventBridge, BullMQ).
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>4. Rate Limiting</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Store rate-limiting counters in Redis sliding-window logs or at the L7/Cloudflare edge, never in worker RAM.
            </p>
          </div>
          <div className="card card-cream" style={{ padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginTop: 0 }}>5. Graceful Drainage</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Intercept <code>SIGTERM</code>, fail <code>/ready</code>, drain in-flight requests, close keep-alives, and terminate cleanly.
            </p>
          </div>
        </div>

        <p>
          For a permanent deep-dive reference on load balancer algorithms and routing matrices, consult the{' '}
          <Link to="/reference/ref-lb">Load Balancing &amp; Stateless Compute Reference Sheet</Link>.
        </p>

        <h2>10. Active Knowledge Retrieval</h2>
        <p>Test your understanding of multi-tier ingress, token revocation, and failure modes:</p>

        <Quiz
          id="quiz_0002_1"
          question="1. An engineer deploys a Node.js API with 4 replicas behind an Application Load Balancer. Users report that they are randomly logged out when navigating between pages. What is the root cause?"
          options={[
            {
              text: 'Network gateways experienced severe packet drops.',
              isCorrect: false,
              explanation: 'Packet drops cause connection timeouts or retries, not HTTP 401 unauthenticated session resets.'
            },
            {
              text: 'Database connections exceeded configured pool sizes.',
              isCorrect: false,
              explanation: 'Exhausting pool connections causes database connection timeouts (500/504 errors), not random session loss.'
            },
            {
              text: 'Authentication sessions resided inside process memory.',
              isCorrect: true,
              explanation: 'When sessions live in local process RAM, requests routed to any replica other than the one where the user logged in fail to find the session.'
            },
            {
              text: 'Reverse proxies dropped incoming session cookies.',
              isCorrect: false,
              explanation: 'Reverse proxies forward session cookies by default unless explicitly configured otherwise.'
            }
          ]}
        />

        <Quiz
          id="quiz_0002_2"
          question="2. Why is a Layer 4 Load Balancer (e.g. AWS NLB) positioned in front of a Layer 7 API Gateway (e.g. Envoy/NGINX) in high-throughput architectures?"
          options={[
            {
              text: 'L4 provides static Anycast IPs and wire-speed packet distribution, allowing the CPU-intensive L7 fleet to scale horizontally.',
              isCorrect: true,
              explanation: 'L4 operates at the transport layer with wire-speed throughput and stable Anycast IPs, shielding L7 and multiplexing raw TCP streams across horizontally scaling L7 proxies that perform expensive TLS decryption and HTTP parsing.'
            },
            {
              text: 'L4 decrypts TLS handshakes faster than L7 proxies.',
              isCorrect: false,
              explanation: 'L4 does not decrypt TLS at all; it passes encrypted TCP packets directly to L7.'
            },
            {
              text: 'L4 inspects JSON request bodies to block SQL injection attacks.',
              isCorrect: false,
              explanation: 'L4 only inspects IP headers and TCP/UDP ports. It has zero visibility into HTTP or JSON payloads.'
            },
            {
              text: 'L4 guarantees sticky session affinity for distributed databases.',
              isCorrect: false,
              explanation: 'Sticky sessions are an antipattern for stateless architectures and do not justify L4 positioning.'
            }
          ]}
        />

        <Quiz
          id="quiz_0002_3"
          question="3. During a high-concurrency flash sale, security operations identifies a fleet of scalper bot accounts. Why is a pure Stateless JWT inadequate for this scenario?"
          options={[
            {
              text: 'JWT cryptographic signatures cannot be validated on Node.js 20.',
              isCorrect: false,
              explanation: 'Node.js has built-in crypto modules that validate RSA and ECDSA signatures in microseconds.'
            },
            {
              text: 'A pure Stateless JWT cannot be revoked immediately before its expiration timestamp without consulting shared state.',
              isCorrect: true,
              explanation: 'Because JWTs are self-contained and validated locally on each compute node without database lookups, there is no native way to revoke a compromised JWT before it expires without introducing a shared blacklist in Redis.'
            },
            {
              text: 'JWT tokens cannot be transmitted over HTTPS connections.',
              isCorrect: false,
              explanation: 'JWTs are standard base64URL strings routinely transmitted in HTTP Authorization headers.'
            },
            {
              text: 'JWT validation requires locking MySQL table rows.',
              isCorrect: false,
              explanation: 'Stateless JWT validation does not touch MySQL or take database locks.'
            }
          ]}
        />

        <Quiz
          id="quiz_0002_4"
          question="4. Why can configuring a load balancer health check to ping the primary database or Redis synchronously trigger a catastrophic total system collapse?"
          options={[
            {
              text: 'A brief database latency spike causes all replica health checks to time out simultaneously, prompting the load balancer to evict every healthy node.',
              isCorrect: true,
              explanation: 'If health checks depend on downstream databases, a minor database delay causes all nodes to fail health checks at once. The load balancer drops all instances from the routing pool, turning a minor database delay into a global blackout.'
            },
            {
              text: 'Health pings consume all available network bandwidth across the VPC.',
              isCorrect: false,
              explanation: 'Health check pings consume negligible bandwidth (a few bytes).'
            },
            {
              text: 'Reverse proxies drop encrypted TLS handshakes when database latency increases.',
              isCorrect: false,
              explanation: 'TLS handshakes are handled at the network edge and are completely decoupled from database queries.'
            },
            {
              text: 'Database connection drivers deadlock when pinged by more than one process.',
              isCorrect: false,
              explanation: 'Database drivers support concurrent connection pooling without deadlock.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0002" />

        <AgentReminder
          title="Architectural Audit with AI"
          promptText='Ask an AI chat of your choice: "Review my Express/Fastify application for zero-downtime horizontal scaling. Verify my SIGTERM shutdown sequence, /ready endpoint implementation, and confirm that no sessions or rate limits reside in process memory."'
        />
      </div>
    </div>
  );
};
