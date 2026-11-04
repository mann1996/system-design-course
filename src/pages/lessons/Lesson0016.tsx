import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { PresenceMeshSimulator } from '../../components/Simulators/PresenceMeshSimulator';

export const Lesson0016: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0016"
            lessonBadge="Lesson 0016"
            moduleBadge="Module 7: Real-Time &amp; Presence"
            time="20 mins"
            tag="Presence Sim"
          />
          <h1>Distributed Pub/Sub &amp; Presence: Scaling WebSockets Across Cluster Nodes</h1>
          <p className="lead-text">
            When Alice connects to Gateway Pod 1 and Bob connects to Gateway Pod 2, how does Alice route a message to Bob without broadcasting to every server in your fleet? Master distributed real-time messaging: contrast Redis Pub/Sub versus NATS, track millions of active user presence states using Redis Sorted Sets, eliminate zombie connections, and dismantle catastrophic O(N &times; M) presence broadcast storms.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0016" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> <em>Discord Engineering Blog</em>: &ldquo;How Discord Handles Push-Notifications and Presence for 100 Million Users&rdquo;; Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 11: &ldquo;Stream Processing &amp; Message Brokers&rdquo;; Alex Xu, <em>System Design Interview (Volume 1)</em>, Chapter 12: &ldquo;Design a Chat System&rdquo;; and <em>NATS.io Documentation</em> on Subject-Based Messaging and Clustered Superclusters.
            </p>
          }
        />

        <h2>1. The Cross-Node Routing Problem</h2>
        <p>
          In a single-instance development environment, a WebSocket server maintains an in-memory dictionary of connected client sockets: <code>Map&lt;UserId, WebSocket&gt;</code>. Sending a direct message from Alice to Bob is trivial: lookup Bob in the map and call <code>socket.send(payload)</code>.
        </p>
        <p>
          In production, a single server cannot hold millions of connections. Traffic is distributed across dozens of autonomous gateway pods behind a Layer 4 load balancer. <strong>Alice is connected to Pod 1, while Bob is connected to Pod 2</strong>. Pod 1 has no reference to Bob&apos;s physical socket handle in its memory heap.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Anti-Pattern</span>
            <h4 style={{ margin: '8px 0' }}>The Point-to-Point Full Mesh</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Attempting to connect every gateway pod to every other gateway pod via internal TCP sockets creates an <code>O(N&sup2;)</code> connection explosion. With 100 gateway nodes, managing 4,950 inter-pod TCP channels with dynamic membership discovery and failure recovery becomes an operational nightmare.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Standard Enterprise Solution</span>
            <h4 style={{ margin: '8px 0' }}>Decoupled Pub/Sub Message Bus</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Gateway pods connect to a high-speed distributed message bus (e.g. Redis Cluster, NATS, or RabbitMQ). When a user connects to Pod 1, Pod 1 subscribes to the channel <code>user:&#123;userId&#125;</code>. When Alice messages Bob, Pod 1 publishes the message to <code>user:bob</code>. The bus delivers it solely to Pod 2, which pushes it over Bob&apos;s socket.
            </p>
          </div>
        </div>

        <h2>2. Message Bus Selection: Redis Pub/Sub vs. NATS vs. Kafka</h2>
        <p>
          Architects must select the appropriate distributed messaging backbone based on latency, delivery guarantees, and fan-out characteristics:
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Technology</th>
                <th>Delivery Guarantees</th>
                <th>Routing Latency</th>
                <th>Storage &amp; Persistence</th>
                <th>Best Fit for Real-Time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Redis Pub/Sub</strong></td>
                <td>At-most-once (Fire-and-forget; no buffer)</td>
                <td>Sub-millisecond (&lt;0.5ms)</td>
                <td>Zero disk persistence; dropped if subscriber disconnected</td>
                <td>Ephemeral ephemeral chat routing, typing indicators, presence</td>
              </tr>
              <tr>
                <td><strong>NATS Core</strong></td>
                <td>At-most-once (JetStream offers at-least-once)</td>
                <td>Ultra-low (&lt;0.2ms, written in Go)</td>
                <td>In-memory or disk streams via JetStream</td>
                <td>Large-scale microservice messaging, multi-region clusters</td>
              </tr>
              <tr>
                <td><strong>Apache Kafka</strong></td>
                <td>At-least-once (Log partitioned commit)</td>
                <td>Low (5ms to 25ms batching)</td>
                <td>Immutable append-only disk commit log</td>
                <td>Audited financial logs, analytics pipelines, durable event store</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          <strong>Why not use Kafka for real-time chat routing?</strong> Kafka requires pre-partitioned topics. Creating an individual Kafka topic per user (e.g., 5,000,000 topics) destroys Kafka&apos;s Zookeeper/KRaft metadata layer and exhausts JVM heap. Conversely, Redis Pub/Sub and NATS support millions of dynamic ephemeral channels with zero disk overhead.
        </p>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Store all user presence in Redis as key-value pairs with EXPIRE"'>
          <p>
            When asked how to implement user online presence, AI code generators invariably suggest:
            <code>await redis.set(&apos;presence:&apos; + userId, &apos;online&apos;, &apos;EX&apos;, 60);</code> and querying with <code>redis.get</code> or <code>redis.keys(&apos;presence:*&apos;)</code>.
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>Why it crashes Redis at scale:</strong> Setting 10,000,000 individual keys with independent TTL timers consumes over 8 GB of Redis metadata overhead and stresses Redis&apos;s active expiration cycle.</li>
            <li><strong>The Fatal `KEYS *` Disaster:</strong> AI assistants frequently suggest querying <code>redis.keys('presence:*')</code> to count online users. Because Redis is single-threaded, running <code>KEYS</code> over 10M keys blocks the entire database for 4 to 8 seconds, causing a complete platform outage!</li>
            <li><strong>Architectural Remedy:</strong> Store presence in a <strong>Redis Sorted Set (ZSET)</strong>: <code>ZADD presence:online &lt;timestamp&gt; &lt;userId&gt;</code>. Sizing drops by 80%, querying total online count is an instant <code>ZCARD</code> (O(1)), and pruning dead connections is a single atomic <code>ZREMRANGEBYSCORE</code> command.</li>
          </ul>
        </AIPitfallCallout>

        <h2>3. Ephemeral Presence &amp; The Zombie Connection Pruner</h2>
        <p>
          A persistent challenge in mobile and real-time networking is the <strong>Half-Open TCP Connection (Zombie Socket)</strong>.
          When a mobile client drives into a subway tunnel or loses battery power, the device abruptly disconnects without emitting a TCP <code>FIN</code> or <code>RST</code> packet.
        </p>
        <p>
          To the gateway server, the operating system socket appears completely open and healthy. If left unchecked, dead sockets accumulate in server memory indefinitely, leading to ghost online states and memory exhaustion.
        </p>

        <div style={{ background: '#faf9f5', border: '1px solid var(--color-hairline)', borderRadius: '12px', padding: '16px', margin: '20px 0' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>The Heartbeat Sliding-Window Engine:</h4>
          <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
            <li><strong>Client Heartbeat:</strong> Every active client transmits a <code>PING</code> frame every 30 seconds.</li>
            <li><strong>Atomic Score Update:</strong> The gateway executes <code>ZADD presence:online &lt;current_epoch_ms&gt; &lt;userId&gt;</code>.</li>
            <li><strong>Periodic Sweeper:</strong> A background cron worker runs every 10 seconds:
              <br />
              <code>ZREMRANGEBYSCORE presence:online 0 &lt;current_epoch_ms - 60000&gt;</code>
              <br />
              Any client that failed to ping within 60 seconds is automatically purged from the online set.
            </li>
          </ol>
        </div>

        <h2>4. The Fatal O(N &times; M) Presence Broadcast Storm</h2>
        <p>
          Consider a platform like Discord or Slack where a gaming guild or company workspace contains 50,000 members.
          If your architecture follows the naive push pattern: <em>&ldquo;Whenever a user changes status (online, idle, gaming, offline), broadcast the event to all guild members&rdquo;</em>, a catastrophic mathematical trap occurs:
        </p>

        <div style={{ background: '#181715', color: '#faf9f5', padding: '16px', borderRadius: '10px', margin: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
          <div>Presence Events per Second = Active Guild Members &times; Status Transitions &times; Guild Size</div>
          <div style={{ color: '#ff8a80', marginTop: '6px' }}>
            1,000 users logging in &times; 50,000 friends/members = 50,000,000 messages to fan-out!
          </div>
        </div>

        <p>
          Under peak morning hours, millions of simultaneous logins trigger a <strong>Presence Broadcast Storm</strong> that floods Redis Pub/Sub buffers, exhausts gateway network egress bandwidth, and chokes client mobile data connections.
        </p>

        <h3>How Discord Solved the Presence Storm: Viewport-Based Presence</h3>
        <p>
          To scale to hundreds of millions of users, Discord re-engineered presence from a global push model to a <strong>Viewport-Limited / Lazy Fetch Architecture</strong>:
        </p>
        <ul>
          <li><strong>Quiet Ingestion:</strong> When a user logs in or updates their status, the gateway writes the update to the central presence store (Redis / ScyllaDB). <strong>No broadcast is sent to members.</strong></li>
          <li><strong>Viewport Subscription:</strong> The client application only subscribes to presence updates for users <em>currently visible in the user&apos;s UI sidebar</em> (typically 30 to 50 members). When the user scrolls down the channel member list, the client sends a message requesting presence for the newly visible window of users.</li>
          <li><strong>Outcome:</strong> Bandwidth consumption drops by over <strong>99.5%</strong>. A 100,000-member Discord server generates virtually zero presence broadcast traffic for inactive members.</li>
        </ul>

        <h2>5. Interactive Architecture Simulator</h2>
        <p>
          Interact with cross-node message routing, heartbeat tracking, zombie connection pruning, and compare naive broadcast storms with viewport presence:
        </p>

        <PresenceMeshSimulator />

        <h2>6. Production Implementation: Distributed Gateway &amp; Presence Node</h2>
        <p>
          Here is a production TypeScript implementation demonstrating how a WebSocket gateway integrates with Redis Pub/Sub for cross-pod routing and Redis Sorted Sets for presence tracking:
        </p>

        <CodeWindowCard
          title="src/presence/DistributedGatewayNode.ts"
          code={`import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';

export class DistributedGatewayNode {
  private wss: WebSocketServer;
  private pubClient: Redis;
  private subClient: Redis;
  private localSockets = new Map<string, WebSocket>();
  private readonly podId: string;

  constructor(port = 8080, redisUrl = 'redis://localhost:6379') {
    this.podId = \`pod_\${Math.random().toString(36).substring(2, 8)}\`;
    this.pubClient = new Redis(redisUrl);
    this.subClient = new Redis(redisUrl);
    this.wss = new WebSocketServer({ port });

    this.initializeRedisSubscription();
    this.initializeWebSocketServer();
    this.startPresenceSweeper();
  }

  private initializeRedisSubscription(): void {
    // Pattern subscribe to user topics routed to this cluster
    this.subClient.psubscribe('user:*', 'room:*', (err) => {
      if (err) console.error('[Redis] Subscription failed:', err);
    });

    this.subClient.on('pmessage', (pattern, channel, message) => {
      const payload = JSON.parse(message);

      if (channel.startsWith('user:')) {
        const targetUserId = channel.replace('user:', '');
        const socket = this.localSockets.get(targetUserId);
        // If the recipient is connected to this physical pod, push over socket!
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(payload));
        }
      } else if (channel.startsWith('room:')) {
        // Local fan-out only for clients in this room connected to THIS pod
        this.broadcastLocalRoom(channel, payload);
      }
    });
  }

  private initializeWebSocketServer(): void {
    this.wss.on('connection', (socket: WebSocket, req) => {
      // Authenticate & extract userId from JWT/session query
      const userId = new URL(req.url || '', 'http://localhost').searchParams.get('userId');
      if (!userId) {
        socket.close(4001, 'Unauthorized');
        return;
      }

      this.localSockets.set(userId, socket);
      this.recordHeartbeat(userId);

      socket.on('message', async (raw) => {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'PING') {
          await this.recordHeartbeat(userId);
          socket.send(JSON.stringify({ type: 'PONG' }));
          return;
        }

        if (msg.type === 'DM') {
          // Route cross-node via Redis Pub/Sub: O(1) publisher overhead
          await this.pubClient.publish(\`user:\${msg.toUserId}\`, JSON.stringify({
            from: userId,
            text: msg.text,
            timestamp: Date.now()
          }));
        }
      });

      socket.on('close', async () => {
        this.localSockets.delete(userId);
        // Remove from online presence immediately on clean TCP close
        await this.pubClient.zrem('presence:online', userId);
      });
    });
  }

  /**
   * Refreshes user presence score in Redis Sorted Set
   */
  private async recordHeartbeat(userId: string): Promise<void> {
    const now = Date.now();
    // ZADD presence:online <epoch_ms> <userId>
    await this.pubClient.zadd('presence:online', now, userId);
  }

  /**
   * Sweeper Worker: Prunes dead/half-open zombie sockets where clients crashed
   */
  private startPresenceSweeper(): void {
    setInterval(async () => {
      const cutoff = Date.now() - 45000; // 45 second zombie threshold
      // Atomically remove all members whose score is older than cutoff
      const prunedCount = await this.pubClient.zremrangebyscore('presence:online', 0, cutoff);
      if (prunedCount > 0) {
        console.log(\`[Sweeper] Pruned \${prunedCount} zombie sessions from presence set.\`);
      }
    }, 15000);
  }

  private broadcastLocalRoom(roomChannel: string, payload: any): void {
    // Deliver message to local subscribers connected to this specific pod
  }
}`}
        />

        <h2>7. Active Retrieval &amp; Architectural Verification</h2>
        <p>
          Verify your mastery of cross-node WebSocket routing, presence tracking, and broadcast storm prevention:
        </p>

        <Quiz
          id="quiz_0016_1"
          question="1. Why does an architecture using point-to-point inter-server TCP sockets collapse when scaling a fleet of 150 WebSocket gateway servers?"
          options={[
            {
              text: 'Because managing an O(N^2) full-mesh requires over 11,000 persistent inter-pod connections, causing configuration and discovery gridlock.',
              isCorrect: true,
              explanation: 'A full-mesh requires N*(N-1)/2 connections. With 150 nodes, that is 11,175 inter-server connections, creating extreme discovery and failure churn.'
            },
            {
              text: 'Because Linux kernels strictly forbid opening more than 16 inter-process TCP sockets within the same virtual private cloud subnet.',
              isCorrect: false,
              explanation: 'Linux kernels impose no 16-socket VPC limit; kernels can handle thousands of TCP connections.'
            },
            {
              text: 'Because Point-to-Point sockets permanently disable TLS encryption algorithms, violating standard PCI-DSS data privacy compliance.',
              isCorrect: false,
              explanation: 'TLS encryption operates independently of network topologies and can be used on any TCP socket.'
            },
            {
              text: 'Because inter-server TCP sockets force all Node.js event loops to run synchronously on a single physical central processing unit.',
              isCorrect: false,
              explanation: 'Inter-server sockets are network connections and do not synchronize execution across independent CPU hardware.'
            }
          ]}
        />

        <Quiz
          id="quiz_0016_2"
          question="2. How does using a Redis Sorted Set (ZSET) for user presence solve the scaling defects of storing individual Redis keys with TTL expirations?"
          options={[
            {
              text: 'It automatically transmits all offline user records to an external Cassandra database using asynchronous hardware replication channels.',
              isCorrect: false,
              explanation: 'Redis Sorted Sets do not replicate data to Cassandra; they are an in-memory data structure inside Redis.'
            },
            {
              text: 'It compresses user IP addresses into 8-bit integers so that the entire presence table fits within the CPU L2 hardware cache.',
              isCorrect: false,
              explanation: 'Redis does not compress IP addresses into CPU cache; it organizes members by float64 scores in memory.'
            },
            {
              text: 'It stores timestamps as scores, slashing key metadata bloat and enabling atomic O(log N) zombie pruning via ZREMRANGEBYSCORE.',
              isCorrect: true,
              explanation: 'A single ZSET holds millions of users, eliminating individual key metadata overhead and allowing simple timestamp range pruning.'
            },
            {
              text: 'It guarantees that all connected mobile clients will never lose battery power during active WebSocket background streaming sessions.',
              isCorrect: false,
              explanation: 'Server-side data structures have no control over physical mobile device battery retention.'
            }
          ]}
        />

        <Quiz
          id="quiz_0016_3"
          question="3. How did Discord eliminate the catastrophic O(N × M) presence broadcast storm when scaling servers with over 100,000 members?"
          options={[
            {
              text: 'By switching from WebSockets to unidirectional UDP multicast packets routed directly across global residential Internet service providers.',
              isCorrect: false,
              explanation: 'Public residential ISPs do not route arbitrary UDP multicast packets from cloud servers to home browsers.'
            },
            {
              text: 'By eliminating all user presence features entirely and forcing clients to send manual ping requests before displaying usernames.',
              isCorrect: false,
              explanation: 'Discord did not remove presence; they re-architected how and when presence is fetched and pushed.'
            },
            {
              text: 'By permanently restricting all Discord channels and guilds to a maximum hard ceiling of 50 simultaneous active members.',
              isCorrect: false,
              explanation: 'Discord supports massive guilds with hundreds of thousands of members simultaneously.'
            },
            {
              text: 'By adopting viewport-based presence, quietly updating Redis and only pushing updates for contacts visible in the client UI list.',
              isCorrect: true,
              explanation: 'Viewport presence caps updates to the 30–50 members visible on screen, reducing fan-out network bandwidth by over 99.5%.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0016 Review"
          promptText="I have completed Lesson 0016 on Distributed Pub/Sub, Redis Sorted Set Presence, and Viewport-Based Presence Architecture. Please quiz me on how to handle cross-node message routing failures, how Redis Pub/Sub differs from NATS and Kafka, and how to mathematically size presence storage in Redis."
        />

        <LessonNavButtons currentLessonId="0016" />
      </div>
    </div>
  );
};