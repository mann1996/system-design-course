import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { WebSocketGatewaySimulator } from '../../components/Simulators/WebSocketGatewaySimulator';

export const Lesson0015: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0015"
            lessonBadge="Lesson 0015"
            moduleBadge="Module 7: Real-Time &amp; Presence"
            time="20 mins"
            tag="WebSocket Sim"
          />
          <h1>Real-Time Gateway Architecture: WebSockets, SSE &amp; Long-Lived Connection Scaling</h1>
          <p className="lead-text">
            How do Discord, Slack, and financial exchanges maintain millions of open, bidirectional connections without exhausting operating system memory or crashing during rolling deployments? Deconstruct real-time ingress: evaluate WebSockets versus Server-Sent Events, calculate kernel TCP buffer footprints, master Linux file descriptor limits, and engineer zero-downtime socket draining.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0015" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Alex Xu and Sahn Lam, <em>System Design Interview &ndash; An Insider&apos;s Guide: Volume 2</em>, Chapter 3: &ldquo;Real-time Gaming / Chat Architecture&rdquo;; <em>Discord Engineering Blog</em>: &ldquo;How Discord Scaled Elixir to 5,000,000 Concurrent Users&rdquo; and &ldquo;Why Discord is Switching From Go to Rust&rdquo;; RFC 6455: <em>The WebSocket Protocol</em>; and Linux Kernel Documentation on <code>tcp_rmem</code>, <code>tcp_wmem</code>, and <code>fs.file-max</code>.
            </p>
          }
        />

        <h2>1. The Real-Time Dilemma: Polling vs. SSE vs. WebSockets</h2>
        <p>
          Traditional HTTP request-response architectures are pull-based: the client requests data, the server responds, and the TCP connection terminates or enters an idle keep-alive pool. In real-time systems (instant messaging, live gaming, collaborative canvases, financial market tickers), data updates originate at the server and must reach clients within milliseconds.
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Protocol Pattern</th>
                <th>Directionality</th>
                <th>Framing Overhead</th>
                <th>Transport Mechanism</th>
                <th>Ideal Production Workload</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>HTTP Short Polling</strong></td>
                <td>Client &rarr; Server (Pull)</td>
                <td>Severe (~800B headers per request)</td>
                <td>Repeated short-lived TCP/TLS handshakes</td>
                <td>Legacy systems with rare updates (&gt;60s)</td>
              </tr>
              <tr>
                <td><strong>HTTP Long Polling</strong></td>
                <td>Client &rarr; Server (Hanging Pull)</td>
                <td>High (~500B headers per reconnect)</td>
                <td>Hanging HTTP request held open until event occurs</td>
                <td>Fallback when corporate proxies block WebSockets</td>
              </tr>
              <tr>
                <td><strong>Server-Sent Events (SSE)</strong></td>
                <td>Server &rarr; Client (Unidirectional Push)</td>
                <td>Minimal (Text stream over HTTP/2)</td>
                <td>Persistent HTTP/2 stream; browser auto-reconnects</td>
                <td>AI chat token streaming, live sports, stock tickers</td>
              </tr>
              <tr>
                <td><strong>WebSockets (RFC 6455)</strong></td>
                <td>Bidirectional (Full-Duplex)</td>
                <td>Microscopic (2 to 14 bytes per frame)</td>
                <td>Upgraded TCP connection with persistent framing</td>
                <td>Interactive gaming, collaborative docs, chat rooms</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          A common architectural mistake is defaulting to WebSockets for every real-time feature. If your data flow is strictly unidirectional (server pushing events to client, such as LLM response streaming or dashboard metrics), <strong>Server-Sent Events (SSE) over HTTP/2</strong> is vastly simpler and more resilient:
        </p>
        <ul>
          <li><strong>Multiplexing:</strong> Over HTTP/2, dozens of SSE streams share a single underlying TCP connection, avoiding browser connection limits and ephemeral port exhaustion.</li>
          <li><strong>Native Reconnection:</strong> The browser&apos;s <code>EventSource</code> API automatically handles reconnection and transmits the <code>Last-Event-ID</code> header so the server can resume uninterrupted.</li>
          <li><strong>Proxy &amp; Firewall Friendliness:</strong> SSE is standard HTTP (content-type: <code>text/event-stream</code>), meaning CDNs, corporate firewalls, and standard L7 load balancers route it without custom configuration.</li>
        </ul>
        <p>
          However, when low-latency client-to-server messaging is mandatory (e.g. typing indicators, player movement, audio/video signalling), <strong>WebSockets</strong> are irreplaceable.
        </p>

        <h2>2. The C1000K Memory &amp; Operating System Limits</h2>
        <p>
          Scaling stateless HTTP compute requires adding instances behind a round-robin load balancer. Scaling WebSockets is fundamentally different because <strong>each connection is a stateful, long-lived kernel object</strong>. Handling 1,000,000 concurrent sockets exposes four strict hardware and operating system bottlenecks:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Kernel Limit 1</span>
            <h4 style={{ margin: '8px 0' }}>File Descriptor Limits (nofile)</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              In Linux, everything is a file. Every active TCP socket allocates an integer File Descriptor (FD). Linux defaults to <code>ulimit -n 1024</code>. If a Node.js process attempts to accept connection #1025, the kernel returns <code>EMFILE: too many open files</code> and silently drops all new connections. Production servers must tune <code>/etc/security/limits.conf</code> and <code>sysctl -w fs.file-max=2097152</code>.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Kernel Limit 2</span>
            <h4 style={{ margin: '8px 0' }}>Kernel Socket Buffer Memory</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              The Linux kernel allocates receive (<code>rmem</code>) and transmit (<code>wmem</code>) buffers for every TCP socket. By default, Linux can assign 128 KB to 256 KB per socket. For 500,000 connections, default buffers require <code>500,000 &times; 256 KB &approx; 128 GB RAM</code>! Architects must tune <code>net.ipv4.tcp_rmem</code> and <code>tcp_wmem</code> to minimum viable sizes (4 KB to 16 KB) for idle connections.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Kernel Limit 3</span>
            <h4 style={{ margin: '8px 0' }}>Ephemeral Port Exhaustion</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              TCP connections are identified by a 4-tuple: <code>(Source IP, Source Port, Dest IP, Dest Port)</code>. A single gateway IP connecting outbound to an upstream service is limited to 65,535 ephemeral ports. When reverse proxies sit between clients and gateway nodes, port exhaustion can starve the cluster unless multiple IP addresses or Layer 4 pass-through is used.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Runtime Limit 4</span>
            <h4 style={{ margin: '8px 0' }}>Node.js / V8 Heap Overhead</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              In Node.js, every <code>ws.WebSocket</code> instance holds EventEmitter listeners, TLS session contexts, and user metadata in V8 heap memory (~4 KB to 10 KB per socket). 50,000 sockets per Node.js process consume ~500 MB of heap. Exceeding 100,000 sockets per process triggers massive Garbage Collection (GC) pauses that freeze the event loop.
            </p>
          </div>
        </div>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Just put WebSockets behind an AWS Application Load Balancer (ALB) with auto-scaling"'>
          <p>
            When asked how to scale a real-time WebSocket cluster, AI tools routinely output:
            <em>&ldquo;Deploy your WebSocket Node.js app on AWS ECS behind an ALB, set an auto-scaling policy based on CPU utilization, and enable sticky sessions.&rdquo;</em>
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>Why ALB fails at scale:</strong> An AWS ALB terminates the TCP connection and re-establishes a new connection to the backend. It charges per LCU (Load Balancer Capacity Unit) based on active connection minutes and new connections per second. At 500,000 concurrent sockets, ALB costs explode into thousands of dollars monthly. Furthermore, ALBs enforce strict idle timeouts (default 60s) that disconnect quiet sockets.</li>
            <li><strong>Auto-Scaling Collapse:</strong> WebSocket connections are stateful. When auto-scaling provisions 5 new pods, existing connections stay pinned to old pods. Zero traffic shifts to new pods until new users connect! Conversely, when auto-scaling terminates an old pod, all connected sockets sever instantly.</li>
            <li><strong>Production Solution:</strong> Use a Layer 4 Network Load Balancer (AWS NLB) with TLS pass-through or TCP termination. Terminating TLS at L4 bypasses HTTP protocol overhead and routes pure TCP packets with sub-millisecond latency.</li>
          </ul>
        </AIPitfallCallout>

        <h2>3. Ingress Topology: L4 NLB vs. L7 Reverse Proxy</h2>
        <p>
          At hyperscale, real-time architectures decouple TCP connection termination from business compute using a dedicated <strong>Connection Gateway Layer</strong>:
        </p>

        <div style={{ background: '#181715', color: '#faf9f5', padding: '20px', borderRadius: '12px', margin: '20px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '1.6' }}>
          <div>[Clients Worldwide]</div>
          <div style={{ color: '#888' }}>     &darr; Anycast DNS + TCP 443</div>
          <div>[Layer 4 Network Load Balancer (AWS NLB / Maglev)]</div>
          <div style={{ color: '#888' }}>     &darr; Direct TCP routing across Availability Zones (Zero TLS renegotiation)</div>
          <div>[Edge WebSocket Gateway Pods (Node.js / Rust / Go)] &mdash; 50k sockets/pod</div>
          <div style={{ color: '#888' }}>     &darr; Decoupled Message Bus (Redis Pub/Sub / NATS / Kafka)</div>
          <div>[Core Microservices (Order, Chat, Presence, Billing)]</div>
        </div>

        <p>
          By terminating WebSocket connections on lightweight gateway workers that do nothing except manage socket I/O, you insulate your core business services from memory bloat and socket connection churn.
        </p>

        <h2>4. Rolling Deployments &amp; The Reconnection Stampede</h2>
        <p>
          What happens when you deploy new code to a cluster holding 1,000,000 active WebSocket connections?
          If you issue a standard rolling update (killing old pods immediately), <strong>disaster strikes</strong>:
        </p>
        <ol>
          <li>100,000 sockets connected to Pod 1 sever simultaneously in 5 milliseconds.</li>
          <li>100,000 client applications immediately execute reconnect logic.</li>
          <li>Every client issues a new TLS handshake against the remaining pods. Cryptographic TLS handshakes consume 10&times; more CPU than ongoing data transfer.</li>
          <li>Surviving pods experience 100% CPU lockup from the TLS storm, fail their health checks, and are killed by the load balancer.</li>
          <li>A complete cascading cluster outage ensues (the classic <strong>Thundering Herd Reconnection Stampede</strong>).</li>
        </ol>

        <h3>The Architectural Guardrail: Rate-Limited Graceful Draining</h3>
        <p>
          To survive rolling deployments, gateway pods must implement rate-limited socket draining with client-side randomized retry jitter:
        </p>
        <ul>
          <li><strong>Step 1 (Deregister):</strong> When <code>SIGTERM</code> is intercepted, the gateway immediately fails its readiness probe, causing the L4 load balancer to stop routing new TCP connections to it.</li>
          <li><strong>Step 2 (Paced Eviction):</strong> Rather than severing all sockets at once, the server iterates through active sockets and transmits a WebSocket Close Frame (RFC 6455 status code <code>1001 Going Away</code>) at a controlled rate (e.g. 200 sockets/sec).</li>
          <li><strong>Step 3 (Client Full Jitter):</strong> Client applications must implement exponential backoff with full jitter (e.g. reconnect delay = <code>random(0, min(max_backoff, base &times; 2^attempt))</code>). This distributes the reconnection load evenly over several minutes.</li>
        </ul>

        <h2>5. Interactive Architecture Simulator</h2>
        <p>
          Experiment with cluster sizing, memory constraints, Linux file descriptor ceilings, and rolling deployment draining:
        </p>

        <WebSocketGatewaySimulator />

        <h2>6. Production Implementation: Resilient Node.js WebSocket Gateway</h2>
        <p>
          Examine this production-grade TypeScript implementation of a WebSocket Gateway featuring socket heartbeats (detecting dead half-open connections), backpressure mitigation, and rate-limited graceful draining on <code>SIGTERM</code>:
        </p>

        <CodeWindowCard
          title="src/gateway/WebSocketGateway.ts"
          code={`import { createServer, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface MonitoredSocket extends WebSocket {
  isAlive: boolean;
  userId?: string;
}

export class WebSocketGateway {
  private wss: WebSocketServer;
  private httpServer: HttpServer;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isDraining = false;

  constructor(port = 8080) {
    this.httpServer = createServer((req, res) => {
      // Readiness probe fails immediately during draining
      if (req.url === '/ready') {
        if (this.isDraining) {
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end('Draining');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Ready');
        }
        return;
      }
      res.writeHead(404).end();
    });

    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      // Enforce backpressure ceiling on incoming frame payload
      maxPayload: 64 * 1024 // 64 KB max message size
    });

    this.initializeEvents();
    this.startHeartbeatTimer();
    this.registerSignalHandlers();

    this.httpServer.listen(port, () => {
      console.log(\`[Gateway] Listening on port \${port}\`);
    });
  }

  private initializeEvents(): void {
    this.wss.on('connection', (ws: MonitoredSocket, req) => {
      if (this.isDraining) {
        // Reject connections during drain with standard 1001 code
        ws.close(1001, 'Server is draining');
        return;
      }

      ws.isAlive = true;

      // Pong handler resets liveness flag
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        // Guard against Slowloris socket buffer bloat
        if (ws.bufferedAmount > 256 * 1024) {
          console.warn('[Gateway] Socket buffer overflow; dropping connection');
          ws.terminate();
          return;
        }
        // Process application payload
      });

      ws.on('close', () => {
        // Cleanup local session state
      });
    });
  }

  /**
   * Heartbeat detector: eliminates zombie TCP connections where client
   * lost connectivity without emitting a TCP FIN packet (e.g. subway tunnels).
   */
  private startHeartbeatTimer(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((client) => {
        const socket = client as MonitoredSocket;
        if (!socket.isAlive) {
          // Half-open connection detected; sever immediately to free kernel FD
          return socket.terminate();
        }
        socket.isAlive = false;
        socket.ping(); // Expecting pong reply
      });
    }, 30000); // 30 second keepalive interval
  }

  /**
   * Paced Graceful Draining: Prevents the Thundering Herd Reconnection Stampede
   */
  public async drainGracefully(socketsPerBatch = 100, intervalMs = 200): Promise<void> {
    if (this.isDraining) return;
    this.isDraining = true;
    console.log('[Gateway] SIGTERM received. Initiating paced graceful socket drain...');

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    const clients = Array.from(this.wss.clients) as MonitoredSocket[];
    console.log(\`[Gateway] Evicting \${clients.length} active sockets gradually...\`);

    for (let i = 0; i < clients.length; i += socketsPerBatch) {
      const batch = clients.slice(i, i + socketsPerBatch);
      for (const socket of batch) {
        if (socket.readyState === WebSocket.OPEN) {
          // 1001 indicates 'Going Away' — signals client to apply full-jitter reconnect
          socket.close(1001, 'Server restarting: reconnect with jitter');
        }
      }
      // Yield execution to allow I/O buffers to flush cleanly
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    this.httpServer.close(() => {
      console.log('[Gateway] HTTP server terminated. Zero dropped messages.');
      process.exit(0);
    });
  }

  private registerSignalHandlers(): void {
    process.on('SIGTERM', () => this.drainGracefully());
    process.on('SIGINT', () => this.drainGracefully());
  }
}`}
        />

        <h2>7. Active Retrieval &amp; Architectural Verification</h2>
        <p>
          Confirm your comprehension of real-time ingress protocols, kernel constraints, and connection scaling:
        </p>

        <Quiz
          id="quiz_0015_1"
          question="1. When architecting an LLM token streaming or live dashboard metrics feature where only the server transmits updates, why is Server-Sent Events (SSE) often superior to WebSockets?"
          options={[
            {
              text: 'Because SSE allows the browser to dynamically allocate multiple TCP ports per sub-domain to bypass the single-thread event loop.',
              isCorrect: false,
              explanation: 'Browsers cannot dynamically allocate port ranges to bypass the event loop; networking remains handled by the browser engine.'
            },
            {
              text: 'Because SSE runs over native HTTP/2 multiplexing, integrates with existing reverse proxies, and provides built-in browser reconnection.',
              isCorrect: true,
              explanation: 'SSE operates over standard HTTP/2, sharing existing TCP connections and utilizing native EventSource auto-reconnect with Last-Event-ID.'
            },
            {
              text: 'Because SSE compresses all JSON payloads using hardware GPU encryption before streaming them through UDP multicast channels.',
              isCorrect: false,
              explanation: 'SSE transmits plaintext text/event-stream chunks over standard TCP/TLS, not GPU-encrypted UDP multicast.'
            },
            {
              text: 'Because WebSockets are restricted by RFC 6455 to a maximum concurrent throughput ceiling of 100 messages per minute per host.',
              isCorrect: false,
              explanation: 'RFC 6455 imposes no arbitrary message rate limits; WebSockets can transmit thousands of frames per second.'
            }
          ]}
        />

        <Quiz
          id="quiz_0015_2"
          question="2. Why must production WebSocket clusters be fronted by Layer 4 Network Load Balancers (NLB) rather than standard Layer 7 Application Load Balancers (ALB)?"
          options={[
            {
              text: 'Because Layer 4 NLBs automatically rewrite HTTP cookie headers into cryptographic JWT tokens during TCP connection handshakes.',
              isCorrect: false,
              explanation: 'Layer 4 balancers operate at the transport layer (TCP/UDP) and cannot inspect or rewrite application-level HTTP cookies.'
            },
            {
              text: 'Because Layer 7 ALBs lack support for TLS termination and permanently reject all incoming HTTPS and WSS traffic at the edge.',
              isCorrect: false,
              explanation: 'ALBs fully support TLS termination; their drawback is high proxy memory usage, connection minute pricing, and idle timeouts.'
            },
            {
              text: 'Because Layer 4 NLBs pass raw TCP streams directly, avoiding expensive per-connection HTTP buffering, LCU surcharges, and idle timeouts.',
              isCorrect: true,
              explanation: 'NLBs route pure TCP packets without re-buffering frames at Layer 7, providing massive throughput and eliminating ALB per-socket minute fees.'
            },
            {
              text: 'Because Layer 4 NLBs permanently store all active WebSocket messages in a distributed NVMe storage cache to survive pod crashes.',
              isCorrect: false,
              explanation: 'Load balancers do not store message payloads on disk; they simply route packets between network endpoints.'
            }
          ]}
        />

        <Quiz
          id="quiz_0015_3"
          question="3. What catastrophic failure occurs if a WebSocket gateway pod holding 150,000 active connections is terminated abruptly without paced socket draining?"
          options={[
            {
              text: 'The operating system kernel runs out of virtual memory addresses and deletes the node root filesystem from the local SSD.',
              isCorrect: false,
              explanation: 'Process terminations do not erase filesystems; Linux cleans up allocated memory cleanly.'
            },
            {
              text: '150,000 clients simultaneously attempt immediate TLS reconnections, triggering a thundering herd that paralyzes surviving pods with 100% CPU.',
              isCorrect: true,
              explanation: 'A sudden severance forces all clients to reconnect at once. Cryptographic TLS handshakes exhaust CPU capacity on remaining nodes, causing cascading failure.'
            },
            {
              text: 'The clients permanently cache the severed TCP connection and refuse to transmit any subsequent HTTP queries for 24 hours.',
              isCorrect: false,
              explanation: 'Clients do not refuse HTTP queries; their WebSocket client code will immediately attempt aggressive reconnection.'
            },
            {
              text: 'The DNS provider blacklists the domain name due to excessive TCP SYN packets detected across global root nameservers.',
              isCorrect: false,
              explanation: 'DNS resolvers are cached and do not blacklist domains because of localized TCP reconnection attempts.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0015 Review"
          promptText="I have completed Lesson 0015 on Real-Time Gateways, WebSockets, SSE, and Connection Scaling. Please challenge me on operating system file descriptor tuning, kernel buffer sizing calculations (tcp_rmem/wmem), and how to engineer rate-limited graceful socket draining with full-jitter reconnects."
        />

        <LessonNavButtons currentLessonId="0015" />
      </div>
    </div>
  );
};