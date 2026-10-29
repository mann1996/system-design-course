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
import { CircuitBreakerSimulator } from '../../components/Simulators/CircuitBreakerSimulator';

export const Lesson0010: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0010"
            lessonBadge="Lesson 0010"
            moduleBadge="Module 4: Resilience & Traffic Guardrails"
            time="20 mins"
            tag="Resilience Sim"
          />
          <h1>Cascading Failure Prevention: Circuit Breakers, Retries with Jitter &amp; Deadlines</h1>
          <p className="lead-text">
            Halt catastrophic domino outages across distributed microservices. Master the Circuit Breaker state machine in TypeScript, eliminate self-inflicted retry storms with Full Jitter, and enforce end-to-end deadline budgets to eliminate wasted server work.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0010" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Michael T. Nygard, <em>Release It! Design and Deploy Production-Ready Software</em> (Pragmatic Bookshelf, 2nd ed.), Chapters 4 &amp; 5: &ldquo;Stability Patterns: Circuit Breaker, Timeouts, Bulkheads&rdquo;; Marc Brooker, <em>Timeouts, retries, and backoff with jitter</em> (The Amazon Builders' Library, 2015); Martin Fowler on <em>CircuitBreaker</em>; and Google Site Reliability Engineering (SRE) Book, Chapter 22: &ldquo;Addressing Cascading Failures&rdquo;.
            </p>
          }
        />

        <h2>1. The Anatomy of a Cascading Outage</h2>
        <p>
          In <Link to="/lessons/0002">Lesson 0002</Link>, we scaled stateless compute horizontally, and in <Link to="/lessons/0009">Lesson 0009</Link>, we shielded ingress gateways using distributed rate limiting. But what protects our architecture when an external or downstream dependency degrades?
        </p>
        <p>
          In a monolithic architecture, a failed function returns an error in microseconds. In a distributed microservice topology, services communicate over fallible network hops. When a downstream dependency degrades (e.g., a third-party payment gateway or a database table experiencing row-level lock contention), it rarely crashes outright. Instead, it becomes <strong>slow</strong>.
        </p>
        <p>
          Slowness is far more dangerous than immediate crashes. Consider an upstream service receiving 500 requests/sec. Normally, requests resolve in 20ms:
        </p>

        <div style={{ textAlign: 'center', margin: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-primary)' }}>
          Concurrent In-Flight Requests = 500 QPS &times; 0.02s = 10 active sockets / connections
        </div>

        <p>
          Now assume the downstream payment provider degrades to 5,000ms latency. The math changes catastrophically:
        </p>

        <div style={{ textAlign: 'center', margin: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#ff6b6b' }}>
          Concurrent In-Flight Requests = 500 QPS &times; 5.00s = 2,500 active sockets / connections!
        </div>

        <p>
          Within seconds, HTTP connection pools are exhausted, Node.js event loop queues fill with uncompleted callbacks, and available socket file descriptors hit OS limits. The upstream service becomes unresponsive to <em>all</em> traffic &mdash; even unrelated endpoints &mdash; causing load balancers to mark healthy instances dead. The outage cascades tier by tier until the entire platform collapses.
        </p>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Just Retry 3 Times in a While Loop"'>
          <p>
            When handling downstream API errors, AI coding assistants almost always recommend a naive retry loop:
          </p>
          <pre style={{ background: 'var(--color-surface-dark)', color: 'var(--color-on-dark)', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
{`// Classic Naive AI Suggestion: The Retry Storm Trap
for (let i = 0; i < 3; i++) {
  try { return await callDownstream(); }
  catch (err) { await sleep(1000); }
}`}
          </pre>
          <p style={{ margin: '8px 0 0' }}>
            This snippet contains three catastrophic architectural flaws:
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li><strong>The Retry Storm (Amplification):</strong> If an already struggling service receives 10,000 QPS and starts failing, every client immediately retries 3 times, amplifying the load to <strong>40,000 QPS</strong> &mdash; delivering the final death blow.</li>
            <li><strong>Non-Transient Error Retries:</strong> It retries HTTP <code>400 Bad Request</code>, <code>401 Unauthorized</code>, or <code>404 Not Found</code> &mdash; errors that will never succeed on retry and waste valuable compute.</li>
            <li><strong>Lack of Idempotency Guard:</strong> Retrying non-idempotent operations (e.g. <code>POST /charges</code>) without idempotency keys risks double-charging customers.</li>
          </ul>
        </AIPitfallCallout>

        <h2>2. The Circuit Breaker Pattern: Fail-Fast Protection</h2>
        <p>
          First popularized in software by Michael Nygard in <em>Release It!</em>, the <strong>Circuit Breaker</strong> acts as an electrical safety switch wrapped around unreliable remote network calls.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px', borderLeft: '4px solid #2b8a3e' }}>
            <span className="badge" style={{ background: '#ebfbee', color: '#2b8a3e', marginBottom: '8px' }}>1. CLOSED (Normal)</span>
            <h4 style={{ margin: '8px 0' }}>Traffic Flows Freely</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Requests pass to the remote service. The breaker monitors the rolling error rate. If failures remain below the threshold (e.g. &lt;50%), the breaker stays CLOSED.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px', borderLeft: '4px solid #c92a2a' }}>
            <span className="badge" style={{ background: '#ffe3e3', color: '#c92a2a', marginBottom: '8px' }}>2. OPEN (Tripped)</span>
            <h4 style={{ margin: '8px 0' }}>Fail-Fast Instantly</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              The breaker intercepts all calls immediately. <strong>Zero network traffic is dispatched.</strong> The breaker returns a cached fallback or error in 1ms, giving the struggling dependency breathing room to recover.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px', borderLeft: '4px solid #e67700' }}>
            <span className="badge" style={{ background: '#fff9db', color: '#e67700', marginBottom: '8px' }}>3. HALF-OPEN (Probing)</span>
            <h4 style={{ margin: '8px 0' }}>Trial Probe Verification</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              After a configured cooldown sleep window (e.g. 5 seconds), the breaker allows a small number of trial requests through. If trials succeed, it resets to CLOSED. If any trial fails, it trips back to OPEN.
            </p>
          </div>
        </div>

        <h2>3. Jitter Mathematics: De-synchronizing the Stampede</h2>
        <p>
          When an outage occurs, hundreds of disconnected clients immediately attempt to reconnect. If they use standard exponential backoff (e.g. <code>sleep = base * 2^attempt</code>), their retry timers align in lockstep:
        </p>
        <div style={{ textAlign: 'center', margin: '14px 0', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-muted)' }}>
          Wave 1: Exactly 1.000s &rarr; Wave 2: Exactly 2.000s &rarr; Wave 3: Exactly 4.000s
        </div>
        <p>
          These synchronized spikes are called a <strong>Retry Stampede</strong>. The server experiences zero traffic for 999ms, followed by a violent 10,000-request shock at the second mark that immediately crashes it again.
        </p>

        <p>
          In a landmark AWS Builders' Library paper, Marc Brooker evaluated three exponential backoff algorithms against synchronized workloads:
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Jitter Algorithm</th>
                <th>Mathematical Formula</th>
                <th>Traffic Pattern &amp; Evaluation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>No Jitter</strong></td>
                <td><code>sleep = min(cap, base &times; 2^attempt)</code></td>
                <td><span style={{ color: '#c92a2a', fontWeight: 600 }}>Terrible.</span> Sharp periodic stampede waves. Zero load distribution.</td>
              </tr>
              <tr>
                <td><strong>Equal Jitter</strong></td>
                <td>
                  <code>temp = min(cap, base &times; 2^attempt) / 2</code><br />
                  <code>sleep = temp + random(0, temp)</code>
                </td>
                <td><span style={{ color: '#e67700', fontWeight: 600 }}>Moderate.</span> Guarantees minimum backoff, but still shows slight periodic pulsing.</td>
              </tr>
              <tr>
                <td><strong>Full Jitter</strong></td>
                <td><code>sleep = random(0, min(cap, base &times; 2^attempt))</code></td>
                <td><span style={{ color: '#2b8a3e', fontWeight: 600 }}>Optimal (AWS Recommended).</span> Completely flattens the retry curve into uniform, smooth background traffic.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>4. Distributed Deadlines &amp; Wasted Work</h2>
        <p>
          In a multi-hop microservice architecture (Gateway &rarr; Order Service &rarr; Inventory Service &rarr; Database), each service often defines its own independent HTTP timeout (e.g. 10 seconds).
        </p>
        <p>
          Assume a client browser initiates a request with a 3-second timeout. At second 3, the user closes their browser tab or receives a client timeout. However, the Order Service and Inventory Service are still running expensive SQL queries, consuming database CPU and disk I/O for another 7 seconds!
        </p>
        <p>
          This is called <strong>Wasted Work</strong>. Under high load, servers spend 80% of their compute processing requests that have already been abandoned by the caller!
        </p>
        <p>
          <strong>The Solution: Propagate Deadlines.</strong> At the ingress gateway, calculate an absolute deadline timestamp (e.g. <code>Date.now() + 3000</code>). Transmit this deadline down every HTTP and gRPC hop in the <code>X-Request-Deadline</code> header. Each downstream service checks this deadline: if the deadline has already passed, <strong>drop the request immediately without doing any work</strong>. In Node.js, bind this deadline to an <code>AbortController</code> to cancel in-flight network sockets.
        </p>

        <CodeWindowCard
          title="src/resilience/CircuitBreaker.ts"
          code={`export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThresholdPct: number; // e.g. 50%
  minSamples: number;          // e.g. 10 requests
  cooldownPeriodMs: number;    // e.g. 5000ms
  timeoutMs: number;           // e.g. 2000ms
  maxRetries: number;          // e.g. 3
  baseBackoffMs: number;       // e.g. 200ms
}

export class ResilientCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastStateChanged = Date.now();
  private halfOpenTrials = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  public async execute<T>(
    action: (signal: AbortSignal) => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    this.evaluateStateTransition();

    if (this.state === 'OPEN') {
      // Fail fast in <1ms without touching network
      return fallback();
    }

    try {
      const result = await this.executeWithRetries(action);
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      return fallback();
    }
  }

  private async executeWithRetries<T>(
    action: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

      try {
        const result = await action(controller.signal);
        clearTimeout(timer);
        return result;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;

        if (attempt < this.options.maxRetries) {
          // AWS Full Jitter: random_between(0, min(cap, base * 2^attempt))
          const maxWait = Math.min(2000, this.options.baseBackoffMs * Math.pow(2, attempt));
          const sleepWithJitter = Math.floor(Math.random() * maxWait);
          await new Promise((resolve) => setTimeout(resolve, sleepWithJitter));
        }
      }
    }

    throw lastError;
  }

  private evaluateStateTransition(): void {
    const now = Date.now();
    if (this.state === 'OPEN' && now - this.lastStateChanged > this.options.cooldownPeriodMs) {
      this.state = 'HALF_OPEN';
      this.halfOpenTrials = 0;
      this.lastStateChanged = now;
    }
  }

  private recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenTrials++;
      if (this.halfOpenTrials >= 2) {
        this.state = 'CLOSED';
        this.resetCounters();
      }
    } else if (this.state === 'CLOSED') {
      this.successCount++;
    }
  }

  private recordFailure(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.lastStateChanged = Date.now();
    } else if (this.state === 'CLOSED') {
      this.failureCount++;
      const total = this.failureCount + this.successCount;
      if (total >= this.options.minSamples) {
        const rate = (this.failureCount / total) * 100;
        if (rate >= this.options.failureThresholdPct) {
          this.state = 'OPEN';
          this.lastStateChanged = Date.now();
        }
      }
    }
  }

  private resetCounters(): void {
    this.failureCount = 0;
    this.successCount = 0;
  }

  public getState(): CircuitState {
    return this.state;
  }
}`}
        />

        <h2>5. Interactive Architecture Simulator: Circuit Breakers &amp; Jitter</h2>
        <p>
          Simulate downstream network degradation below. Observe how the circuit breaker transitions from <strong>CLOSED</strong> to <strong>OPEN</strong> to protect socket pools, watch the cooldown timer allow trial probes in <strong>HALF-OPEN</strong>, and contrast No-Jitter vs. Full-Jitter retry waves.
        </p>

        <CircuitBreakerSimulator />

        <h2>6. Check Your Architectural Understanding</h2>

        <Quiz
          id="quiz_0010_1"
          question="1. Why does an OPEN circuit breaker return a fallback error immediately rather than attempting the network call?"
          options={[
            {
              text: 'Because HTTP reverse proxies drop connections if responses take longer than one millisecond.',
              isCorrect: false,
              explanation: 'Proxies tolerate multi-second timeouts; circuit breakers fail fast to preserve internal resources.'
            },
            {
              text: 'Because failing fast stops thread pool exhaustion and gives degraded downstreams time to recover.',
              isCorrect: true,
              explanation: 'When a downstream service is failing or slow, continuing to send requests exhausts upstream sockets and memory while further overloading the struggling dependency. Failing fast in 1ms protects both systems.'
            },
            {
              text: 'Because TypeScript runtime engines cannot execute asynchronous promises while in an error state.',
              isCorrect: false,
              explanation: 'JavaScript and TypeScript runtimes handle errors via standard async try/catch without restriction.'
            },
            {
              text: 'Because the CAP theorem requires all network partitions to be resolved within five seconds.',
              isCorrect: false,
              explanation: 'The CAP theorem is a theoretical model of consistency and availability, not a millisecond timer rule.'
            }
          ]}
        />

        <Quiz
          id="quiz_0010_2"
          question="2. Why is Full Jitter superior to standard Exponential Backoff without jitter during a system outage?"
          options={[
            {
              text: 'Because Full Jitter guarantees that every retry request succeeds on its very first attempt.',
              isCorrect: false,
              explanation: 'Jitter randomizes wait times; it does not guarantee that downstream services will succeed.'
            },
            {
              text: 'Because standard exponential backoff synchronizes retry waves, producing violent stampede spikes.',
              isCorrect: true,
              explanation: 'Without jitter, all failing clients wait the exact same mathematical duration (1s, 2s, 4s), hitting the recovering backend in synchronized pulses. Full Jitter spreads retry attempts uniformly across the time spectrum.'
            },
            {
              text: 'Because Full Jitter bypasses the need for relational database indexes during table lockups.',
              isCorrect: false,
              explanation: 'Retry backoff is a client-side network flow control pattern and has no impact on database indexing.'
            },
            {
              text: 'Because Full Jitter automatically converts synchronous HTTP requests into Kafka append events.',
              isCorrect: false,
              explanation: 'Jitter does not alter transport protocols or convert HTTP calls into Kafka events.'
            }
          ]}
        />

        <Quiz
          id="quiz_0010_3"
          question="3. What catastrophic architectural problem do Distributed Deadlines prevent across microservice chains?"
          options={[
            {
              text: 'Downstream services wasting compute on requests already abandoned by upstream callers.',
              isCorrect: true,
              explanation: 'When a caller times out or closes their browser after 3 seconds, downstream services that do not enforce distributed deadlines continue computing queries and allocating memory for abandoned requests, squandering capacity.'
            },
            {
              text: 'Relational database primaries failing to replicate changes to asynchronous read replicas.',
              isCorrect: false,
              explanation: 'Database replication lag is addressed through write-through routing or session tokens, not deadlines.'
            },
            {
              text: 'Kafka consumer groups rebalancing when new worker nodes join the distributed partition cluster.',
              isCorrect: false,
              explanation: 'Consumer rebalancing is managed through heartbeat intervals and max poll intervals.'
            },
            {
              text: 'DNS Anycast servers routing geographic traffic to the nearest regional cloud datacenter.',
              isCorrect: false,
              explanation: 'Anycast DNS routing is an infrastructure network protocol unaffected by application deadlines.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0010" />

        <AgentReminder
          title="Teacher Standby: Evaluating Resiliency & Circuit Breakers"
          promptText="Ask me: 'Can you critique my circuit breaker configuration and retry strategy for our mission-critical payment orchestration service calling external bank APIs?'"
        />
      </div>
    </div>
  );
};
