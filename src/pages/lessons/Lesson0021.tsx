import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { StreamWindowSimulator } from '../../components/Simulators/StreamWindowSimulator';

export const Lesson0021: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0021"
            lessonBadge="Lesson 0021"
            moduleBadge="Module 10: Stream Processing &amp; Pipelines"
            time="25 mins"
            tag="Stream Window Sim"
          />
          <h1>Real-Time Stream Processing: Event Time, Watermarks &amp; Windowing Strategies</h1>
          <p className="lead-text">
            When millions of devices emit continuous telemetry, transactions, and ad clicks, waiting for daily batch ETL jobs is no longer acceptable. However, processing unbounded streams in real time introduces fundamental distributed challenges: mobile network delays cause events to arrive minutes out of order, server clocks drift, and data volume is infinite. Deconstruct real-time stream processing: Event Time vs. Processing Time vs. Ingestion Time, windowing primitives (Tumbling, Sliding, and Session windows), heuristic Watermarks, and late-arriving data quarantine using side outputs.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0021" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 11: &ldquo;Stream Processing &ndash; Event Streams, Processing Streams (Event Time vs Processing Time, Windows, Stream Joins)&rdquo;; Tyler Akidau, Slava Chernyak, and Reuven Lax, <em>Streaming Systems: The What, Where, When, and How of Large-Scale Data Processing</em> (O&apos;Reilly); Apache Flink Documentation: <em>&ldquo;Timely Stream Processing &amp; Event Time / Watermarks&rdquo;</em>; and Alex Xu &amp; Sahn Lam, <em>System Design Interview &ndash; Volume 2</em>, Chapter 11: &ldquo;Ad Click Event Aggregation&rdquo;.
            </p>
          }
        />

        <h2>1. The Paradigm Shift: Bounded Batches vs. Unbounded Streams</h2>
        <p>
          In classical data engineering, computation operated over <strong>bounded datasets</strong>: a fixed collection of records (e.g. yesterday&apos;s log files or an SQL database table snapshot). A batch MapReduce or SQL query starts, reads all input records, computes an aggregation, and terminates.
        </p>
        <p>
          In production systems, real-world data never stops generating. Credit card transactions, IoT sensor readings, gaming actions, and GPS coordinates are <strong>unbounded streams</strong>: continuously arriving, infinite sequences of events. Treating unbounded streams as a series of rigid batch intervals introduces operational friction:
        </p>
        <ul>
          <li><strong>High Latency:</strong> A 1-hour batch ETL job means analytical insights are always 1&ndash;2 hours stale, making real-time fraud prevention or dynamic pricing impossible.</li>
          <li><strong>Artificial Boundary Clipping:</strong> If an ad click occurs at <code>11:59:59 PM</code> and the purchase occurs at <code>12:00:01 AM</code>, daily batch jobs allocate them to separate days, breaking conversion attribution.</li>
          <li><strong>Traffic Spikes &amp; Resource Waste:</strong> Batch jobs cause massive hourly compute spikes that idle between runs, whereas continuous streaming smooths resource utilization.</li>
        </ul>

        <h2>2. The Three Dimensions of Time</h2>
        <p>
          The most critical architectural decision in stream processing is determining which clock governs your aggregations. There are three distinct time dimensions:
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Time Dimension</th>
                <th>Origin &amp; Definition</th>
                <th>Pros</th>
                <th>Cons &amp; Distributed Hazards</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Event Time</strong></td>
                <td>The exact instant the event occurred on the originating client device (embedded in the event payload as a timestamp).</td>
                <td><strong>Deterministic and reproducible:</strong> Replaying historical Kafka logs produces the exact same aggregated results regardless of network latency or server speed.</td>
                <td>Events arrive out of order due to network jitter, cellular dead zones, or device offline buffering.</td>
              </tr>
              <tr>
                <td><strong>Ingestion Time</strong></td>
                <td>The instant the event entered the messaging broker (e.g. Kafka broker append timestamp).</td>
                <td>Monotonically increasing within a single partition; immune to client clock spoofing.</td>
                <td>Does not reflect when the business event actually occurred; distorted by network transmission queues.</td>
              </tr>
              <tr>
                <td><strong>Processing Time</strong></td>
                <td>The local system clock of the stream worker node currently executing the aggregation operator.</td>
                <td>Simplest to implement; zero buffering overhead; lowest latency.</td>
                <td><strong>Non-deterministic:</strong> Re-running code produces completely different answers. Consumer lag or GC pauses skew time windows.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>3. Windowing Topologies: Slicing the Unbounded Continuum</h2>
        <p>
          Because unbounded streams have no end, operations like <code>SELECT COUNT(*)</code> would require infinite memory and never return a result. We must slice unbounded streams into finite temporal buckets using <strong>Windowing</strong>:
        </p>

        <ol>
          <li>
            <strong>Tumbling Windows (Fixed &amp; Non-Overlapping):</strong>
            <br />
            Divides the stream into fixed-duration, contiguous time blocks. Every event belongs to exactly one window.
            <br />
            <em>Example:</em> 5-minute sales totals: <code>[12:00, 12:05)</code>, <code>[12:05, 12:10)</code>.
          </li>
          <li>
            <strong>Sliding / Hopping Windows (Fixed Duration, Overlapping):</strong>
            <br />
            Defined by a window duration and a sliding step. When the step is smaller than the duration, windows overlap, and a single event falls into multiple concurrent windows.
            <br />
            <em>Example:</em> A 10-minute rolling fraud check sliding every 1 minute: <code>[12:00, 12:10)</code>, <code>[12:01, 12:11)</code>.
          </li>
          <li>
            <strong>Session Windows (Dynamic Inactivity Gaps):</strong>
            <br />
            Groups events by user interaction bursts. The window expands dynamically as long as events arrive within a specified gap threshold (e.g. 5 minutes). When no events arrive for 5 minutes, the session window closes.
            <br />
            <em>Example:</em> E-commerce shopping session analytics tracking active customer engagement.
          </li>
        </ol>

        <h2>4. The Out-of-Order Problem &amp; Watermark Heuristics</h2>
        <p>
          In a distributed system, network latency is non-deterministic. A user in a subway tunnel might perform an action at <code>12:01:00</code> (Event Time), but their phone cannot transmit the packet until they exit the station at <code>12:08:00</code>.
        </p>
        <p>
          If your stream processor evaluates a <code>[12:00, 12:05)</code> tumbling window: <em>When can the operator safely close the window and emit the final aggregated sum?</em>
        </p>
        <ul>
          <li>If it closes at <code>12:05:00</code> processing time, it drops the subway user&apos;s legitimate event.</li>
          <li>If it waits forever for potential late arrivals, the operator runs out of RAM and real-time alerts are indefinitely delayed.</li>
        </ul>

        <h3>The Watermark Solution</h3>
        <p>
          A <strong>Watermark</strong> is a special control signal flowing through the stream that provides a temporal progress metric. A watermark with timestamp <code>W(t)</code> asserts:
        </p>
        <blockquote>
          <em>&ldquo;The stream processor estimates that all events with Event Time &le; t have now been observed across upstream partitions.&rdquo;</em>
        </blockquote>
        <p>
          When the watermark passes the window end boundary (<code>W(t) &ge; Window End</code>), the stream processor triggers window evaluation and emits the aggregated result downstream.
        </p>

        <p>
          The most prevalent watermark generator in production is the <strong>Bounded-Out-of-Order Watermark</strong>:
        </p>
        <div style={{ background: '#f5f2eb', padding: '12px 18px', borderRadius: '8px', borderLeft: '4px solid #cc785c', fontFamily: 'monospace', margin: '16px 0' }}>
          Watermark = max(observed_event_timestamp) &minus; delay_threshold
        </div>
        <p>
          If <code>delay_threshold = 10 seconds</code> and the latest observed event timestamp is <code>12:05:30</code>, the current watermark is <code>12:05:20</code>. Any window ending at or before <code>12:05:20</code> is triggered.
        </p>

        <h2>5. Handling Late-Arriving Data: Allowed Lateness &amp; Side Outputs</h2>
        <p>
          Because watermarks are heuristic estimates, occasionally an event arrives <em>after</em> the watermark has already advanced past its window (e.g. an event from <code>12:02</code> arrives when the watermark is <code>12:06</code>).
        </p>
        <p>
          How should an enterprise architecture handle late arrivals? There are three standard strategies:
        </p>
        <ul>
          <li><strong>Drop Silently:</strong> The default behavior of naive systems. Causes severe revenue undercounting and silent data divergence.</li>
          <li><strong>Allowed Lateness (Window Revision):</strong> Keep the window state in operator memory for a defined grace period (e.g. 5 minutes). When a late event arrives, recompute the window and emit an updated (or retraction) message.</li>
          <li><strong>Dead-Letter Side Output:</strong> When an event arrives beyond the allowed lateness threshold (when window state is purged), route the orphaned event to a secondary stream (Kafka dead-letter topic) for offline ledger reconciliation without crashing the real-time engine.</li>
        </ul>

        <h2>6. Technical Implementation: TypeScript Stream Window Aggregator</h2>
        <p>
          The following production-grade TypeScript snippet demonstrates a stateful Bounded-Out-of-Order Window Aggregator with Watermark generation, late event updating, and side-output routing:
        </p>

        <CodeWindowCard
          title="StreamWindowAggregator.ts"
          code={`export interface StreamRecord<T> {
  key: string;
  eventTimeMs: number;
  payload: T;
}

export interface WindowResult<T> {
  windowStart: number;
  windowEnd: number;
  key: string;
  aggregatedValue: T;
  isRetractionUpdate: boolean;
}

export class BoundedOutOfOrderWindowAggregator {
  private maxObservedEventTimeMs = 0;
  private readonly windowSizeMs: number;
  private readonly delayToleranceMs: number;
  private readonly allowedLatenessMs: number;

  // Active in-memory state: key -> windowStart -> accumulatedSum
  private windowState = new Map<string, Map<number, number>>();
  // Side output handler for unrecoverably late events
  private onSideOutput: (record: StreamRecord<number>, lateByMs: number) => void;
  // Downstream sink handler
  private onEmit: (result: WindowResult<number>) => void;

  constructor(
    windowSizeSec: number,
    delayToleranceSec: number,
    allowedLatenessSec: number,
    onEmit: (result: WindowResult<number>) => void,
    onSideOutput: (record: StreamRecord<number>, lateByMs: number) => void
  ) {
    this.windowSizeMs = windowSizeSec * 1000;
    this.delayToleranceMs = delayToleranceSec * 1000;
    this.allowedLatenessMs = allowedLatenessSec * 1000;
    this.onEmit = onEmit;
    this.onSideOutput = onSideOutput;
  }

  public get currentWatermarkMs(): number {
    return Math.max(0, this.maxObservedEventTimeMs - this.delayToleranceMs);
  }

  public processRecord(record: StreamRecord<number>): void {
    if (record.eventTimeMs > this.maxObservedEventTimeMs) {
      this.maxObservedEventTimeMs = record.eventTimeMs;
    }

    const windowStart = Math.floor(record.eventTimeMs / this.windowSizeMs) * this.windowSizeMs;
    const windowEnd = windowStart + this.windowSizeMs;
    const watermark = this.currentWatermarkMs;

    // Check if event arrives after window is already finalized and purged
    if (watermark >= windowEnd + this.allowedLatenessMs) {
      const lateBy = watermark - windowEnd;
      this.onSideOutput(record, lateBy);
      return;
    }

    // Accumulate in state
    if (!this.windowState.has(record.key)) {
      this.windowState.set(record.key, new Map());
    }
    const keyWindows = this.windowState.get(record.key)!;
    const currentSum = keyWindows.get(windowStart) || 0;
    const updatedSum = currentSum + record.payload;
    keyWindows.set(windowStart, updatedSum);

    // If watermark has already triggered initial emit, emit an incremental revision
    if (watermark >= windowEnd) {
      this.onEmit({
        windowStart,
        windowEnd,
        key: record.key,
        aggregatedValue: updatedSum,
        isRetractionUpdate: true,
      });
    }

    this.advanceWatermarkAndTrigger(watermark);
  }

  private advanceWatermarkAndTrigger(watermark: number): void {
    for (const [key, windows] of this.windowState.entries()) {
      for (const [start, sum] of windows.entries()) {
        const end = start + this.windowSizeMs;
        // Trigger window when watermark reaches windowEnd
        if (watermark >= end) {
          this.onEmit({
            windowStart: start,
            windowEnd: end,
            key,
            aggregatedValue: sum,
            isRetractionUpdate: false,
          });

          // Purge state if watermark has exceeded allowed lateness
          if (watermark >= end + this.allowedLatenessMs) {
            windows.delete(start);
          }
        }
      }
    }
  }
}`}
        />

        <h2>7. Interactive Simulator: Event Time, Watermarks &amp; Windowing</h2>
        <p>
          Test your intuition on out-of-order event streams. Experiment with <strong>Tumbling</strong>, <strong>Sliding</strong>, and <strong>Session</strong> windowing. Observe how advancing the watermark triggers window emission, how allowed lateness permits window state revisions, and how severely lagging events are quarantined into side outputs.
        </p>

        <StreamWindowSimulator />

        <AIPitfallCallout title="The 'Date.now() in the Stream Consumer' Trap">
          <p>
            When asking AI models to write a real-time rate limiter, fraud rule, or session aggregation for a message consumer, models almost universally suggest code like:
          </p>
          <pre style={{ background: '#2d1515', color: '#ffc9c9', padding: '10px 14px', borderRadius: '6px', fontSize: '12px' }}>
            {`// NAIVE AI CODE: Completely broken during consumer lag or backfill!
const currentTime = Date.now();
if (currentTime - userSession.lastActivity > 600000) {
  triggerFraudAlert(user);
}`}
          </pre>
          <p>
            <strong>Why this causes catastrophic production outages:</strong> In distributed stream processing, the instant a worker node consumes a message from Kafka has <em>zero relationship</em> to when the user performed the action. If Kafka experiences a consumer rebalance, a 5-minute network lag spike, or if you replay 24 hours of data from an offset reset, <code>Date.now()</code> evaluates all historical events within a 2-second burst! Thousands of false-positive fraud alerts fire, accounts are blocked, and window aggregations are hopelessly corrupted. <strong>Never evaluate streaming state against wall-clock system time; always evaluate state against the event&apos;s embedded Event Time and monotonically advancing Watermarks.</strong>
          </p>
        </AIPitfallCallout>

        <h2>8. Active Retrieval: Test Your Understanding</h2>
        <p>
          Reinforce your knowledge of timely stream processing and windowing trade-offs with these three architectural questions:
        </p>

        <Quiz
          id="quiz_0021_1"
          question="1. What is the fundamental operational distinction between Event Time and Processing Time in a stream processing engine?"
          options={[
            {
              text: 'Event Time reflects when the event occurred on the source client; Processing Time is the local server clock when the stream worker executes the operator.',
              isCorrect: true,
              explanation: 'Event Time is embedded in the event at creation time, ensuring reproducible historical re-runs regardless of when workers process the data.'
            },
            {
              text: 'Event Time is only supported by relational databases; Processing Time is exclusively used by NoSQL document databases like MongoDB.',
              isCorrect: false,
              explanation: 'Time semantics apply to distributed streaming platforms (Flink, Kafka, Spark) and are not database-type constraints.'
            },
            {
              text: 'Processing Time guarantees zero dropped events during cellular network disconnections; Event Time always drops delayed events immediately.',
              isCorrect: false,
              explanation: 'Processing Time creates false window aggregations during network lag; Event Time correctly aggregates delayed events.'
            },
            {
              text: 'Event Time requires an atomic GPS satellite clock attached to every compute instance; Processing Time uses standard NTP software clocks.',
              isCorrect: false,
              explanation: 'Event Time uses client-provided timestamps inside the payload and does not require satellite hardware.'
            }
          ]}
        />

        <Quiz
          id="quiz_0021_2"
          question="2. How does a Bounded-Out-of-Order Watermark generator balance output latency against data completeness?"
          options={[
            {
              text: 'By compressing event payloads using LZ4 dictionary algorithms before emitting JSON records to downstream REST webhooks.',
              isCorrect: false,
              explanation: 'Compression is a payload encoding concern, unrelated to watermark time heuristics.'
            },
            {
              text: 'A smaller delay threshold reduces window emission latency but increases the risk of dropping valid late-arriving events.',
              isCorrect: true,
              explanation: 'Watermarks balance timeliness vs completeness: an aggressive low delay emits fast answers but clips stragglers; a large delay waits for all events but increases memory buffering.'
            },
            {
              text: 'It forces all upstream IoT client devices to pause event generation until the central message broker acknowledges receipt.',
              isCorrect: false,
              explanation: 'Watermarks are computed inside the stream processor and do not block client devices from generating telemetry.'
            },
            {
              text: 'By round-robining incoming messages across multiple worker threads to bypass the Node.js event-loop execution queue.',
              isCorrect: false,
              explanation: 'Thread round-robining is a concurrency technique, not a temporal watermark heuristic.'
            }
          ]}
        />

        <Quiz
          id="quiz_0021_3"
          question="3. In a streaming architecture, why is late-arriving data routed to a 'Dead-Letter Side Output' rather than keeping window state in memory indefinitely?"
          options={[
            {
              text: 'Because keeping infinite window state in memory leads to catastrophic Out-Of-Memory (OOM) crashes and prevents state compaction.',
              isCorrect: true,
              explanation: 'Unbounded retention of window states causes heap exhaustion. Purging state after allowed lateness and routing stragglers to side outputs protects cluster stability.'
            },
            {
              text: 'Because Kafka brokers reject any message that has an event timestamp older than sixty seconds from the current time.',
              isCorrect: false,
              explanation: 'Kafka stores messages based on log retention policies (days or weeks) and does not reject older event timestamps.'
            },
            {
              text: 'Because TLS 1.3 certificates expire if an HTTP TCP socket is held open for longer than the window duration limit.',
              isCorrect: false,
              explanation: 'TLS certificates have nothing to do with stream processing window state retention.'
            },
            {
              text: 'Because Reed-Solomon erasure coding cannot reconstruct parity blocks if data is received out of chronological order.',
              isCorrect: false,
              explanation: 'Erasure coding is a storage-layer redundancy scheme and does not govern streaming window lifetimes.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0021 Review"
          promptText="I have completed Lesson 0021 on Real-Time Stream Processing, Event Time vs Processing Time, Watermark heuristics, Tumbling/Sliding/Session Windows, and Side Outputs. Please challenge me on how to handle watermark skew across multiple Kafka partitions, how to choose between tumbling and session windows for user behavior, and how to prevent memory leaks from long allowed-lateness windows."
        />

        <LessonNavButtons currentLessonId="0021" />
      </div>
    </div>
  );
};
