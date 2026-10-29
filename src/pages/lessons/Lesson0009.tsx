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
import { RateLimitSimulator } from '../../components/Simulators/RateLimitSimulator';

export const Lesson0009: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0009"
            lessonBadge="Lesson 0009"
            moduleBadge="Module 4: Resilience & Traffic Guardrails"
            time="20 mins"
            tag="Rate Limit Sim"
          />
          <h1>Distributed Rate Limiting: Algorithms, Race Conditions &amp; Overload Protection</h1>
          <p className="lead-text">
            Defend distributed systems against malicious credential stuffing, runaway scrapers, and cascading load spikes. Master Token Bucket and Sliding Window counters, eliminate distributed race conditions with Redis Lua scripts, and engineer CPU-aware load shedding.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0009" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Alex Xu, <em>System Design Interview (Volume 1)</em>, Chapter 5: &ldquo;Design a Rate Limiter&rdquo;; David Yanacek, <em>Using load shedding to avoid overload</em> (AWS Builders' Library, 2020); Cloudflare Engineering, <em>How we built rate limiting capable of handling millions of requests per second</em> (2017); and IETF RFC 6585, Section 4: &ldquo;429 Too Many Requests&rdquo;.
            </p>
          }
        />

        <h2>1. The Ingress Defense Dilemma: Why Compute Clusters Collapse</h2>
        <p>
          In <Link to="/lessons/0002">Lesson 0002</Link>, we established that stateless compute instances scale horizontally behind load balancers. In <Link to="/lessons/0006">Lesson 0006</Link>, we buffered spikes using asynchronous queues. But what happens when an unauthenticated botnet launches 100,000 requests/sec against your authentication endpoint, or a client script gets stuck in a zero-delay <code>while(true)</code> loop?
        </p>
        <p>
          Without an authoritative ingress throttle, incoming surges consume database connection pools, saturate worker CPU threads, and exhaust memory. Downstream services experience latency degradation, which triggers upstream client timeouts, spawning retries that compound into a fatal <strong>cascading collapse</strong>.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Security &amp; Abuse</span>
            <h4 style={{ margin: '8px 0' }}>Preventing Malicious Exploitation</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Rate limiters mitigate brute-force password cracking, credential stuffing attacks, credit card validation bots, and high-frequency content scraping by capping requests per IP, account, or API token.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Operational Stability</span>
            <h4 style={{ margin: '8px 0' }}>Enforcing SLA Boundaries</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Rate limiters ensure "noisy neighbors" in multi-tenant SaaS environments cannot monopolize shared compute, cache, or database resources, safeguarding SLA guarantees for all paying tenants.
            </p>
          </div>
        </div>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Just Use In-Memory Counters in Express"'>
          <p>
            When asked to implement rate limiting, AI coding assistants almost universally generate code using in-memory JavaScript maps (e.g., <code>const hits = new Map()</code> or default <code>express-rate-limit</code> without a store).
          </p>
          <p style={{ margin: '8px 0 0' }}>
            In a horizontally scaled production deployment with 10 Node.js container replicas, in-memory rate limiting fails completely:
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>Traffic fragmentation:</strong> If a user makes 100 requests routed across 10 round-robin replicas, each node only observes 10 requests. A client configured for a 20 req/min limit can effectively execute 200 req/min without being blocked.</li>
            <li><strong>Node restarts &amp; auto-scaling:</strong> When pods scale down, crash, or restart during deployments, all tracked client counters vanish instantly.</li>
            <li><strong>Process memory leaks:</strong> Unbounded tracking of unique IP addresses without TTL eviction quickly causes Node.js process Out-Of-Memory (OOM) crashes.</li>
          </ul>
        </AIPitfallCallout>

        <h2>2. Rate Limiting Algorithms in Depth</h2>
        <p>
          Selecting the right algorithm is a high-level architectural decision balancing memory consumption, computational overhead, and tolerance for temporary bursts.
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Burst Tolerance</th>
                <th>Memory Footprint</th>
                <th>Primary Vulnerability / Trade-off</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Token Bucket</strong></td>
                <td><span style={{ color: 'var(--color-teal)', fontWeight: 600 }}>High (Up to bucket capacity)</span></td>
                <td>O(1) &mdash; 2 numbers (tokens, lastRefill)</td>
                <td>Requires synchronized state updates; allows instantaneous bursts up to capacity.</td>
              </tr>
              <tr>
                <td><strong>Leaky Bucket</strong></td>
                <td><span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>None (Smooth fixed outflow)</span></td>
                <td>O(Queue Size)</td>
                <td>Slows down bursty interactive user traffic; drops requests if queue fills.</td>
              </tr>
              <tr>
                <td><strong>Fixed Window Counter</strong></td>
                <td><span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Flawed (2x burst at boundary)</span></td>
                <td>O(1) &mdash; 1 integer counter + TTL</td>
                <td><strong>Boundary Doubling Spike:</strong> Allows 2x limit at window rollover boundaries.</td>
              </tr>
              <tr>
                <td><strong>Sliding Window Log</strong></td>
                <td><span style={{ color: 'var(--color-teal)', fontWeight: 600 }}>Accurate (Rolling window)</span></td>
                <td>O(Request Count) &mdash; High RAM</td>
                <td>Stores epoch timestamp for every request; high Redis sorted-set memory footprint.</td>
              </tr>
              <tr>
                <td><strong>Sliding Window Counter</strong></td>
                <td><span style={{ color: 'var(--color-teal)', fontWeight: 600 }}>Smooth (Weighted estimate)</span></td>
                <td>O(1) &mdash; 2 integer counters</td>
                <td>Approximates sliding window using previous &amp; current window weights; &lt;0.05% error.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>The Fixed Window Boundary Doubling Trap</h3>
        <p>
          Assume a rate limit of 100 requests per minute, resetting at the top of each clock minute (e.g. <code>12:00:00</code>, <code>12:01:00</code>). A client can submit 100 requests at <code>12:00:59</code>, and another 100 requests at <code>12:01:01</code>.
        </p>
        <p>
          Both batches are accepted because each sits in a distinct window. However, in that 2-second span, <strong>200 requests hammered your database</strong> &mdash; doubling your planned operational capacity! For this reason, mission-critical systems avoid pure Fixed Window counters.
        </p>

        <h2>3. Distributed Rate Limiting &amp; The Redis Race Condition</h2>
        <p>
          To enforce rate limits across horizontally scaled stateless gateways, counters must reside in a centralized, low-latency shared data store like Redis.
        </p>
        <p>
          However, naive implementations introduce a severe <strong>Read-Modify-Write race condition</strong>. Consider two concurrent requests arriving at Gateway A and Gateway B simultaneously for client <code>usr_99</code> whose current count is 99 (limit is 100):
        </p>

        <pre style={{ background: 'var(--color-surface-dark)', color: 'var(--color-on-dark)', padding: '14px', borderRadius: '8px', fontSize: '13px', overflowX: 'auto', fontFamily: 'var(--font-mono)' }}>
{`Timeline of a Read-Modify-Write Race Condition:
Gateway A: Reads count from Redis -> 99
Gateway B: Reads count from Redis -> 99
Gateway A: Evaluates (99 < 100) -> Allowed! Increments in Redis -> 100
Gateway B: Evaluates (99 < 100) -> Allowed! Increments in Redis -> 101

Result: Both requests passed through! Under high concurrency, hundreds of requests bypass limits.`}
        </pre>

        <p>
          Distributed locks (e.g., Redlock) add unacceptable network round-trip latency to the critical request path. The industry-standard solution is an <strong>atomic Redis Lua Script</strong>. Because Redis executes Lua scripts as a single atomic unit on its single-threaded command processor, no other command can interleave during evaluation.
        </p>

        <CodeWindowCard
          title="src/middleware/distributedRateLimiter.ts"
          code={`import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Atomic Sliding Window Counter Lua Script
// KEYS[1]: Current window Redis key (e.g. rl:usr_42:1730198400)
// KEYS[2]: Previous window Redis key (e.g. rl:usr_42:1730198340)
// ARGV[1]: Max limit (e.g. 100)
// ARGV[2]: Current window weight (0.0 to 1.0)
// ARGV[3]: Key TTL in seconds (e.g. 120)
const SLIDING_WINDOW_LUA = \`
  local current_count = tonumber(redis.call('get', KEYS[1]) or '0')
  local prev_count = tonumber(redis.call('get', KEYS[2]) or '0')
  local weight = tonumber(ARGV[2])
  local limit = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[3])

  local estimated_count = math.floor(prev_count * (1.0 - weight) + current_count)

  if estimated_count < limit then
    local new_count = redis.call('incr', KEYS[1])
    if new_count == 1 then
      redis.call('expire', KEYS[1], ttl)
    end
    return {1, limit - (estimated_count + 1), math.ceil((1.0 - weight) * 60)}
  else
    return {0, 0, math.ceil((1.0 - weight) * 60)}
  end
\`;

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
}

export function createDistributedRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientId = options.keyGenerator(req);
    const now = Math.floor(Date.now() / 1000);
    const windowSec = options.windowSeconds;

    const currentWindowSlot = Math.floor(now / windowSec) * windowSec;
    const prevWindowSlot = currentWindowSlot - windowSec;

    const currentKey = \`rl:\${clientId}:\${currentWindowSlot}\`;
    const prevKey = \`rl:\${clientId}:\${prevWindowSlot}\`;

    const weight = (now - currentWindowSlot) / windowSec;

    try {
      const result = (await redis.eval(
        SLIDING_WINDOW_LUA,
        2,
        currentKey,
        prevKey,
        options.maxRequests.toString(),
        weight.toFixed(4),
        (windowSec * 2).toString()
      )) as [number, number, number];

      const [allowed, remaining, retryAfter] = result;

      // RFC 6585 / IETF Standard Rate Limit Headers
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
      res.setHeader('X-RateLimit-Reset', currentWindowSlot + windowSec);

      if (allowed === 1) {
        return next();
      }

      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please back off before retrying.',
        retryAfterSeconds: retryAfter,
      });
    } catch (err) {
      // Production Fail-Open vs Fail-Closed Strategy
      console.error('[RateLimiter] Redis connection failure:', err);
      // Fail-open to preserve availability during Redis degradation
      return next();
    }
  };
}`}
        />

        <h2>4. Interactive Architecture Simulator: Rate Limiting &amp; Spikes</h2>
        <p>
          Use the simulator below to test algorithmic trade-offs. Switch between Token Bucket, Fixed Window, and Sliding Window Counter. Try triggering the <strong>Boundary Spike</strong> to observe how Fixed Window fails under real-world traffic.
        </p>

        <RateLimitSimulator />

        <h2>5. HTTP Contracts, Header Standards &amp; Load Shedding</h2>
        <p>
          A rate limiter must be transparent to clients so legitimate SDKs and frontend applications can throttle themselves gracefully.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Client Contract</span>
            <h4 style={{ margin: '8px 0' }}>RFC 6585 &amp; Standard Headers</h4>
            <ul style={{ fontSize: '13px', margin: 0, paddingLeft: '18px' }}>
              <li><code>HTTP 429 Too Many Requests</code>: Universal rejection status.</li>
              <li><code>X-RateLimit-Limit</code>: Allowed quota in current window.</li>
              <li><code>X-RateLimit-Remaining</code>: Remaining quota available.</li>
              <li><code>Retry-After</code>: Seconds client must wait before retrying.</li>
            </ul>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Internal Protection</span>
            <h4 style={{ margin: '8px 0' }}>Rate Limiting vs. Load Shedding</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              <strong>Rate Limiting</strong> rejects traffic based on client identity (e.g. user ID, IP). <strong>Load Shedding</strong> rejects traffic unconditionally when internal metrics (CPU &gt; 85%, event loop lag &gt; 50ms) indicate the server is about to collapse.
            </p>
          </div>
        </div>

        <h3>Fail-Open vs. Fail-Closed Resilience Strategy</h3>
        <p>
          What happens when the Redis rate-limiting cluster experiences a network partition or hardware failure?
        </p>
        <ul>
          <li><strong>Fail-Open:</strong> Ingress gateways allow traffic through unthrottled. This preserves application availability during transient Redis hiccups, but risks database saturation if a DDoS attack is simultaneously underway.</li>
          <li><strong>Fail-Closed:</strong> Gateways reject all requests or fallback to local in-memory throttles. This protects backends but causes a self-inflicted outage for all users if Redis goes down.</li>
          <li><strong>Production Recommendation:</strong> Use <em>Fail-Open with local fallback</em>: if Redis fails, compute nodes activate a conservative local in-memory token bucket to absorb extreme surges until Redis reconnects.</li>
        </ul>

        <h2>6. Check Your Architectural Understanding</h2>

        <Quiz
          id="quiz_0009_1"
          question="1. Why does the Fixed Window Counter algorithm permit twice the planned request capacity during peak traffic?"
          options={[
            {
              text: 'Because distributed Redis clusters execute asynchronous replication with replica lag.',
              isCorrect: false,
              explanation: 'Replication lag causes stale reads, but the boundary doubling problem is an algorithmic flaw present even on a single node.'
            },
            {
              text: 'Because clients can concentrate full quotas at the end of one window and start of the next.',
              isCorrect: true,
              explanation: 'If a client sends 100% of its quota in the final second of window N and 100% in the first second of window N+1, both are accepted, doubling the load across that short 2-second interval.'
            },
            {
              text: 'Because HTTP reverse proxies automatically duplicate requests when TLS termination fails.',
              isCorrect: false,
              explanation: 'TLS termination proxies do not duplicate HTTP requests on failure.'
            },
            {
              text: 'Because Node.js worker threads divide the window duration across all CPU cores.',
              isCorrect: false,
              explanation: 'Window calculations are mathematical functions of timestamps, not thread divisions.'
            }
          ]}
        />

        <Quiz
          id="quiz_0009_2"
          question="2. Why are atomic Lua scripts preferred over standard GET and SET commands when rate limiting with Redis?"
          options={[
            {
              text: 'Because Lua scripts automatically compress cached session records before saving to disk.',
              isCorrect: false,
              explanation: 'Lua scripts do not compress Redis database records; they provide atomic server-side script execution.'
            },
            {
              text: 'Because concurrent gateway nodes cause read-modify-write race conditions without atomicity.',
              isCorrect: true,
              explanation: 'Between a GET and a SET command, multiple distributed gateway instances can read the same old count, allowing concurrent requests to slip through and exceed the rate limit.'
            },
            {
              text: 'Because Redis prevents Lua scripts from consuming more than one megabyte of network bandwidth.',
              isCorrect: false,
              explanation: 'Redis does not enforce bandwidth caps on Lua scripts.'
            },
            {
              text: 'Because relational databases cannot establish connection pools without Lua script support.',
              isCorrect: false,
              explanation: 'Relational database connection pools are completely independent of Redis Lua scripts.'
            }
          ]}
        />

        <Quiz
          id="quiz_0009_3"
          question="3. What is the fundamental operational difference between Rate Limiting and Load Shedding?"
          options={[
            {
              text: 'Rate limiting drops traffic by client quota; load shedding drops traffic by system saturation.',
              isCorrect: true,
              explanation: 'Rate limiting controls client fairness and quotas (IP/user key). Load shedding protects server survivability when internal resources (CPU, memory, queue depth) breach safe operational limits.'
            },
            {
              text: 'Rate limiting runs exclusively on edge CDNs; load shedding runs exclusively on databases.',
              isCorrect: false,
              explanation: 'Both can run across multiple tiers (API gateways, compute workers, services).'
            },
            {
              text: 'Rate limiting requires relational SQL; load shedding requires distributed Kafka streams.',
              isCorrect: false,
              explanation: 'Neither pattern is tied to SQL or Kafka; rate limiting typically uses Redis and load shedding uses process metrics.'
            },
            {
              text: 'Rate limiting returns HTTP 503; load shedding always returns HTTP 200 with cached fallbacks.',
              isCorrect: false,
              explanation: 'Rate limiting returns HTTP 429 Too Many Requests; load shedding returns HTTP 503 Service Unavailable.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0009" />

        <AgentReminder
          title="Teacher Standby: Evaluating Rate Limiting Architecture"
          promptText="Ask me: 'Can you critique my proposed multi-tier rate limiting topology for a public REST and GraphQL API, including edge Cloudflare WAF, Envoy gateway, and Redis cluster failover?'"
        />
      </div>
    </div>
  );
};
