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
import { DistributedLockSimulator } from '../../components/Simulators/DistributedLockSimulator';

export const Lesson0012: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0012"
            lessonBadge="Lesson 0012"
            moduleBadge="Module 5: Coordination &amp; Consensus"
            time="20 mins"
            tag="Lock Simulator"
          />
          <h1>Distributed Locking &amp; Consensus: Redlock, Fencing Tokens &amp; Leader Election</h1>
          <p className="lead-text">
            Safely coordinate distributed resources without split-brain state corruption. Deconstruct the Redlock controversy, analyze the fatal &ldquo;Zombie Client&rdquo; GC pause race condition, master Martin Kleppmann's fencing tokens, and implement consensus-driven leader election with etcd.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0012" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>How to do distributed locking</em> (2016); Salvatore Sanfilippo, <em>Is Redlock safe?</em> (2016); Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 9: &ldquo;Consistency and Consensus&rdquo;; Diego Ongaro and John Ousterhout, <em>In Search of an Understandable Consensus Algorithm (Raft)</em> (USENIX ATC, 2014); and etcd Documentation on <em>Leases and Distributed Concurrency</em>.
            </p>
          }
        />

        <h2>1. The Fallacy of the Simple Distributed Lock</h2>
        <p>
          In single-process programming, mutual exclusion (mutex) is a solved problem. The OS kernel and CPU provide atomic instructions (e.g. Compare-And-Swap) backed by shared physical memory. If Thread A holds a lock, Thread B waits. If Thread A pauses, it still owns the lock.
        </p>
        <p>
          In a distributed system, developers frequently attempt to mimic single-server mutexes across network hops (e.g., using Redis keys). But distributed systems operate in an <strong>asynchronous network model</strong> where:
        </p>
        <ul>
          <li><strong>Network delays are unbounded:</strong> A packet can be delayed in a router or switch for seconds or minutes.</li>
          <li><strong>Clocks are unsynchronized:</strong> As we saw in <Link to="/lessons/0011">Lesson 0011</Link>, physical hardware clocks experience drift and NTP adjustments.</li>
          <li><strong>Process execution pauses are unbounded:</strong> A node can experience a &ldquo;stop-the-world&rdquo; Garbage Collection (GC) pause, page fault, VM migration, or Node.js event-loop freeze at any arbitrary instant.</li>
        </ul>
        <p>
          Because of these three realities, <strong>a distributed lock with a time-to-live (TTL) expiration does not guarantee mutual exclusion for data correctness on its own</strong>.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Use Case 1</span>
            <h4 style={{ margin: '8px 0' }}>Locks for Efficiency (Best-Effort)</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Preventing redundant, expensive computational work (e.g. video rendering, cache warming, cron job trigger). If the lock fails rarely and two workers do duplicate work, no data is corrupted. A simple Redis lock is acceptable here.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Use Case 2</span>
            <h4 style={{ margin: '8px 0' }}>Locks for Correctness (Zero-Loss)</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Preventing financial ledger double-spends, inventory over-allocation, or partitioned database overwrites. If two nodes write simultaneously, permanent data corruption occurs. Simple TTL locks fail catastrophically here.
            </p>
          </div>
        </div>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Just redis.set(key, val, &apos;NX&apos;, &apos;EX&apos;) and redis.del(key)"'>
          <p>
            When asked to implement a distributed lock in Node.js, AI assistants almost always generate code with two fatal security and race-condition flaws:
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>The Lock Deletion Race:</strong> Worker 1 acquires the lock with a 10s TTL. Worker 1 takes 12 seconds to finish. The lock expires in Redis, and Worker 2 acquires the lock. Worker 1 finishes and runs <code>redis.del(key)</code>. Worker 1 just silently deleted Worker 2's active lock! Now Worker 3 also acquires the lock, destroying all concurrency guarantees!</li>
            <li><strong>Fix:</strong> Lock release MUST execute an atomic Lua script that verifies the unique client identifier before deleting:
              <code>if redis.call(&quot;get&quot;, KEYS[1]) == ARGV[1] then return redis.call(&quot;del&quot;, KEYS[1]) else return 0 end</code>
            </li>
            <li><strong>The Zombie Process Illusion:</strong> Even with atomic Lua release, the assistant assumes that holding the lock protects storage writes. As Kleppmann proved, it does not!</li>
          </ul>
        </AIPitfallCallout>

        <h2>2. The Zombie Client Disaster: Kleppmann vs. Redlock</h2>
        <p>
          In 2016, Martin Kleppmann published his famous critique of Redis Redlock. The fatal flaw stems from the inability of a worker to know whether its lock expired while it was asleep:
        </p>

        <div style={{ background: '#181715', color: '#faf9f5', padding: '20px', borderRadius: '8px', margin: '20px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.7 }}>
          <div style={{ color: 'var(--color-primary)', fontWeight: 700, marginBottom: '6px' }}>// The Distributed Lock Zombie Sequence:</div>
          <div>1. Worker A requests lock for 'account:9042' &rarr; Lock granted with 10-second TTL.</div>
          <div>2. Worker A reads balance = $1,000, calculates new balance = $1,100.</div>
          <div style={{ color: '#ff5252' }}>3. Worker A experiences an unexpected 12-second Stop-The-World GC pause or event-loop freeze!</div>
          <div style={{ color: '#ffab00' }}>4. In Redis, the 10-second TTL expires! The lock is released automatically.</div>
          <div>5. Worker B requests lock for 'account:9042' &rarr; Lock granted with 10-second TTL.</div>
          <div>6. Worker B reads balance = $1,000, updates balance to $1,500, writes to DB, releases lock.</div>
          <div style={{ color: '#ff5252' }}>7. Worker A wakes up from GC pause! Completely unaware that 12 seconds elapsed and its lock expired!</div>
          <div style={{ color: '#ff5252' }}>8. Worker A sends its pending write (balance = $1,100) to the DB!</div>
          <div style={{ color: '#ff5252', fontWeight: 700 }}>9. DISASTER: Worker A's stale write overwrites Worker B's fresh $1,500 balance! Permanent data corruption!</div>
        </div>

        <h2>3. The Mathematical Solution: Monotonic Fencing Tokens</h2>
        <p>
          How do we prevent a zombie worker from corrupting storage after its lock lease expires?
        </p>
        <p>
          Kleppmann demonstrated that <strong>the storage system itself must validate authorization at the exact instant of the write</strong>. This is achieved using <strong>Fencing Tokens</strong>:
        </p>
        <ul>
          <li>Every time the lock coordinator grants a lock, it increments and returns a monotonically increasing integer (e.g., Token <code>41</code>, Token <code>42</code>, Token <code>43</code>).</li>
          <li>The worker must include this fencing token with every storage write request.</li>
          <li>The database enforces an atomic conditional write:
            <div style={{ background: '#f5f4f0', padding: '10px 14px', borderRadius: '6px', margin: '8px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', border: '1px solid var(--color-hairline)' }}>
              UPDATE accounts<br />
              SET balance = :newBalance, fencing_token = :token<br />
              WHERE id = :accountId AND fencing_token &lt; :token;
            </div>
          </li>
          <li>When Worker B wrote its update, the database recorded <code>fencing_token = 42</code>.</li>
          <li>When Zombie Worker A wakes up and sends its write with Token <code>41</code>, the database checks: <code>41 &lt; 42</code> is FALSE! The write is <strong>rejected</strong>, and an error is raised. Data integrity remains 100% intact!</li>
        </ul>

        <h2>4. Leader Election &amp; Distributed Consensus Primitives</h2>
        <p>
          What if your architecture requires electing a single active leader (e.g. an active-passive master controller or a scheduled task dispatcher)?
        </p>
        <p>
          Using Redis for leader election is risky because Redis uses asynchronous replication: if the primary Redis node crashes before replicating the lock key to replicas, a replica will be promoted and grant the lock to a second leader (split-brain).
        </p>
        <p>
          For authoritative leader election and configuration coordination, distributed systems use <strong>Consensus Systems</strong> based on Raft or Paxos (such as <strong>etcd</strong> or <strong>Apache ZooKeeper</strong>):
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Technology</th>
                <th>Underlying Protocol</th>
                <th>Consistency Model</th>
                <th>Best Architectural Fit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Redis (Single / Cluster)</strong></td>
                <td>Asynchronous replication</td>
                <td>Eventual consistency (Data loss on primary failover)</td>
                <td>Rate limiting, short-lived caching, locks for efficiency</td>
              </tr>
              <tr>
                <td><strong>etcd</strong></td>
                <td>Raft Consensus</td>
                <td><span style={{ color: 'var(--color-teal)', fontWeight: 600 }}>Strict Linearizability (Quorum writes)</span></td>
                <td>Leader election, service discovery, configuration, Kubernetes state</td>
              </tr>
              <tr>
                <td><strong>ZooKeeper</strong></td>
                <td>ZAB Protocol</td>
                <td><span style={{ color: 'var(--color-teal)', fontWeight: 600 }}>Strict Linearizability</span></td>
                <td>Kafka metadata (historically), Hadoop, distributed group membership</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Interactive Simulator */}
        <DistributedLockSimulator />

        <h2>5. Production TypeScript Implementation with Lua Scripts &amp; Heartbeats</h2>
        <p>
          Below is a production-grade distributed lock wrapper in TypeScript. It uses atomic Lua scripts for acquisition and release, maintains an automatic heartbeat lease renewal to prevent premature TTL expiration, and generates monotonic fencing tokens:
        </p>

        <CodeWindowCard
          title="distributed-lock.ts"
          code={`// Production-Grade Distributed Lock Client with Atomic Lua Scripts & Heartbeat Lease Renewal
import { randomUUID } from 'crypto';

interface RedisClient {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<any>;
}

export class DistributedLock {
  private readonly lockId: string;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isHolding = false;

  // Atomic Lua script to acquire lock and increment global fencing token atomically
  private static readonly ACQUIRE_LUA = \`
    local lockKey = KEYS[1]
    local tokenCounterKey = KEYS[2]
    local clientId = ARGV[1]
    local ttlMs = tonumber(ARGV[2])

    -- Try to acquire lock if not already set
    if redis.call("set", lockKey, clientId, "NX", "PX", ttlMs) then
      -- Monotonically increment fencing token
      local token = redis.call("incr", tokenCounterKey)
      return {1, token}
    else
      return {0, 0}
    end
  \`;

  // Atomic Lua script to release lock ONLY if client ID matches (prevents deleting another worker's lock)
  private static readonly RELEASE_LUA = \`
    local lockKey = KEYS[1]
    local clientId = ARGV[1]

    if redis.call("get", lockKey) == clientId then
      return redis.call("del", lockKey)
    else
      return 0
    end
  \`;

  // Atomic Lua script to extend lease TTL while process is actively working (Heartbeat)
  private static readonly RENEW_LUA = \`
    local lockKey = KEYS[1]
    local clientId = ARGV[1]
    local ttlMs = tonumber(ARGV[2])

    if redis.call("get", lockKey) == clientId then
      return redis.call("pexpire", lockKey, ttlMs)
    else
      return 0
    end
  \`;

  constructor(
    private readonly redis: RedisClient,
    private readonly resourceName: string,
    private readonly ttlMs = 10000 // 10s default lease
  ) {
    this.lockId = randomUUID(); // Unique owner identifier per acquire instance
  }

  /**
   * Attempts to acquire the lock and returns a Monotonic Fencing Token.
   * Returns null if resource is currently locked by another worker.
   */
  public async acquire(): Promise<{ fencingToken: number } | null> {
    const lockKey = \`lock:\${this.resourceName}\`;
    const counterKey = \`fencing_counter:\${this.resourceName}\`;

    const result = await this.redis.eval(
      DistributedLock.ACQUIRE_LUA,
      [lockKey, counterKey],
      [this.lockId, this.ttlMs]
    );

    const [acquired, token] = result as [number, number];

    if (acquired === 1) {
      this.isHolding = true;
      this.startHeartbeat(lockKey);
      return { fencingToken: token };
    }

    return null;
  }

  /**
   * Heartbeat to renew TTL lease every (ttlMs / 3) while work is in flight.
   */
  private startHeartbeat(lockKey: string): void {
    const interval = Math.floor(this.ttlMs / 3);
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isHolding) return;

      try {
        const renewed = await this.redis.eval(
          DistributedLock.RENEW_LUA,
          [lockKey],
          [this.lockId, this.ttlMs]
        );
        if (renewed !== 1) {
          // Lost lock! Process must cease work immediately
          console.error(\`Lost distributed lock for \${this.resourceName} during heartbeat renewal!\`);
          this.isHolding = false;
          if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        }
      } catch (err) {
        console.error('Heartbeat network failure:', err);
      }
    }, interval);

    // Prevent heartbeat timer from blocking Node.js process exit
    this.heartbeatTimer.unref?.();
  }

  /**
   * Atomically releases the lock verifying owner ID.
   */
  public async release(): Promise<boolean> {
    this.isHolding = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    const lockKey = \`lock:\${this.resourceName}\`;
    const result = await this.redis.eval(
      DistributedLock.RELEASE_LUA,
      [lockKey],
      [this.lockId]
    );

    return (result as number) === 1;
  }
}`}
        />

        <h2>6. Active Retrieval &amp; Architectural Verification</h2>
        <p>
          Confirm your comprehension of distributed locking trade-offs, zombie processes, and fencing tokens:
        </p>

        <Quiz
          id="quiz_0012_1"
          question="1. In a distributed lock implementation, why is releasing a lock using a simple redis.del(key) considered a dangerous anti-pattern?"
          options={[
            {
              text: 'Because Redis connection pools automatically close when a DEL command is executed without an index key.',
              isCorrect: false,
              explanation: 'Redis connection pools remain open after normal key deletion commands.'
            },
            {
              text: 'Because if Worker 1 paused and its TTL expired, it will accidentally delete Worker 2’s active lock.',
              isCorrect: true,
              explanation: 'If Worker 1’s lock expired while it was slow, Worker 2 acquired it. A blind DEL by Worker 1 deletes Worker 2’s lock, allowing a third worker to enter.'
            },
            {
              text: 'Because DEL commands force Redis to synchronize all dirty memory pages synchronously to solid-state disks.',
              isCorrect: false,
              explanation: 'DEL is an in-memory pointer removal and does not force an immediate synchronous disk flush.'
            },
            {
              text: 'Because Layer 4 load balancers will treat the deleted key as an HTTP gateway connection timeout.',
              isCorrect: false,
              explanation: 'Layer 4 load balancers operate on TCP packets and have zero visibility into Redis database commands.'
            }
          ]}
        />

        <Quiz
          id="quiz_0012_2"
          question="2. How do Monotonic Fencing Tokens prevent Zombie Clients from corrupting persistent database records?"
          options={[
            {
              text: 'By encrypting network payloads using asymmetric RSA keys generated during each leader election vote.',
              isCorrect: false,
              explanation: 'Fencing tokens are sequence numbers, not cryptographic payload encryption keys.'
            },
            {
              text: 'By enforcing database writes to check that the incoming token is strictly greater than the recorded token.',
              isCorrect: true,
              explanation: 'The storage engine checks: WHERE fencing_token < :incoming_token. If a zombie worker wakes up with an old token, the storage engine rejects the write.'
            },
            {
              text: 'By pausing all database shard CPU cores until the lock coordinator confirms the client is alive.',
              isCorrect: false,
              explanation: 'Database CPUs are never paused; the validation is an atomic row-level conditional SQL expression.'
            },
            {
              text: 'By terminating the worker node operating system process via a SIGKILL signal before write submission.',
              isCorrect: false,
              explanation: 'The lock coordinator has no access to the client’s operating system to issue SIGKILL.'
            }
          ]}
        />

        <Quiz
          id="quiz_0012_3"
          question="3. Why is etcd or ZooKeeper preferred over Redis for mission-critical cluster leader election?"
          options={[
            {
              text: 'Because etcd uses the Raft consensus algorithm with quorum writes, preventing split-brain on node failovers.',
              isCorrect: true,
              explanation: 'etcd requires majority quorum agreement before committing state changes. Redis asynchronous replication can lose lock state during failover, electing two leaders simultaneously.'
            },
            {
              text: 'Because etcd stores all records in uncompressed plaintext JSON files on NFS network file shares.',
              isCorrect: false,
              explanation: 'etcd uses bbolt (B+tree) storage on local disks, not NFS network shares.'
            },
            {
              text: 'Because Redis limits the maximum number of network TCP connections across all clients to 256.',
              isCorrect: false,
              explanation: 'Redis easily handles tens of thousands of concurrent TCP client connections.'
            },
            {
              text: 'Because ZooKeeper automatically converts all TypeScript asynchronous promises into synchronous threads.',
              isCorrect: false,
              explanation: 'ZooKeeper has no relationship to JavaScript V8 runtime threading or Promises.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0012" />

        <AgentReminder
          title="Teacher Standby: Evaluating Consensus & Coordination"
          promptText="Ask me: 'Can you critique my proposed leader election and distributed lock topology for a mission-critical billing scheduler running across 3 Kubernetes availability zones?'"
        />
      </div>
    </div>
  );
};
