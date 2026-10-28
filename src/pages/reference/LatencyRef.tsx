import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { AgentReminder } from '../../components/UI/AgentReminder';

export const LatencyRef: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonBadge="Reference Sheet"
            moduleBadge="Hardware Limits"
            time="Capacity Estimation"
          />
          <h1>Latency Hierarchy &amp; Capacity Sizing Reference</h1>
          <p className="lead-text">
            Permanent reference sheet for hardware bounds, network thresholds, and quick back-of-the-envelope sizing calculations.
          </p>
        </header>

        <h2>1. The Latency Hierarchy (Normalized to Human Scale)</h2>
        <p>
          Computer latencies are incomprehensible in raw nanoseconds. Scaling <strong>1 CPU cycle (0.3 ns) to 1 human second</strong> makes the trade-offs viscerally obvious:
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Real Latency</th>
                <th>Scaled (1 CPU cycle = 1 sec)</th>
                <th>Architectural Takeaway</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>L1 cache reference</strong></td>
                <td>0.5 &ndash; 1 ns</td>
                <td>1.5 &ndash; 3 seconds</td>
                <td>Near instantaneous. CPU registers and on-chip fast cache.</td>
              </tr>
              <tr>
                <td><strong>Branch mispredict</strong></td>
                <td>3 &ndash; 5 ns</td>
                <td>10 &ndash; 15 seconds</td>
                <td>Instruction pipeline flush penalty.</td>
              </tr>
              <tr>
                <td><strong>L2 cache reference</strong></td>
                <td>3 &ndash; 7 ns</td>
                <td>10 &ndash; 20 seconds</td>
                <td>On-die fast secondary cache.</td>
              </tr>
              <tr>
                <td><strong>Main Memory (RAM) access</strong></td>
                <td>50 &ndash; 100 ns</td>
                <td>3 &ndash; 5 minutes</td>
                <td>100x slower than L1. Redis / Memcached in-memory lookup foundation.</td>
              </tr>
              <tr>
                <td><strong>Read 1 MB sequentially from RAM</strong></td>
                <td>3,000 ns (3 &mu;s)</td>
                <td>2.5 hours</td>
                <td>RAM bandwidth is massive (~20&ndash;40 GB/s throughput).</td>
              </tr>
              <tr>
                <td><strong>NVMe SSD random read</strong></td>
                <td>10 &ndash; 50 &mu;s</td>
                <td>~1 to 2 days</td>
                <td>Fast solid-state, but still 100x&ndash;500x slower than RAM.</td>
              </tr>
              <tr>
                <td><strong>Read 1 MB sequentially from NVMe</strong></td>
                <td>250 &ndash; 500 &mu;s</td>
                <td>~1 week</td>
                <td>Sequential disk I/O on NVMe is remarkably efficient (~2&ndash;4 GB/s).</td>
              </tr>
              <tr>
                <td><strong>Same-Datacenter Network Round Trip</strong></td>
                <td>500 &mu;s (0.5 ms)</td>
                <td>~2 weeks</td>
                <td>An internal microservice call or Redis TCP network round trip.</td>
              </tr>
              <tr>
                <td><strong>HDD random seek (Spinning disk)</strong></td>
                <td>4,000 &ndash; 10,000 &mu;s (10 ms)</td>
                <td>~6 to 12 months</td>
                <td>Mechanical actuator movement. Deadly for unindexed queries.</td>
              </tr>
              <tr>
                <td><strong>Cross-Region WAN Round Trip (US to EU)</strong></td>
                <td>100,000 &mu;s (100 ms)</td>
                <td><strong>~8 to 10 years</strong></td>
                <td>Speed of light in fiber optics. Synchronous multi-region queries kill UX.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="callout callout-coral">
          <h3>Architectural Law #1</h3>
          <p style={{ margin: 0 }}>
            <strong>Network is the supreme bottleneck.</strong> Calling an in-datacenter service or database over TCP (0.5 ms) takes thousands of times longer than reading from memory (100 ns). Crossing oceans (100 ms) is comparable to waiting a decade in human scale. Never execute chatty N+1 network calls.
          </p>
        </div>

        <h2>2. Back-of-the-Envelope Mental Math Rules</h2>
        <h3>Time Conversions for Daily Traffic</h3>
        <ul>
          <li><code>1 day = 24 &times; 3,600 = 86,400 seconds</code> &rarr; round to <strong>100,000 seconds</strong> for rapid mental math.</li>
          <li><code>1 million requests/day</code> &asymp; <code>1,000,000 / 86,400</code> &asymp; <strong>12 QPS</strong> (average).</li>
          <li><strong>Peak QPS Rule:</strong> Peak traffic is typically <strong>2x to 5x</strong> average traffic. 1M req/day &rarr; ~25&ndash;60 peak QPS.</li>
          <li><code>100 million requests/day</code> &asymp; <strong>1,200 QPS</strong> average &rarr; ~2,500&ndash;6,000 peak QPS.</li>
          <li><code>1 billion requests/day</code> &asymp; <strong>12,000 QPS</strong> average &rarr; ~25,000&ndash;50,000 peak QPS.</li>
        </ul>

        <h3>Data Volume Multipliers</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Bytes</th>
                <th>Equivalent</th>
                <th>Rule of Thumb Reference</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>1 KB</strong></td><td>10³</td><td>1,000 B</td><td>Typical small JSON payload or metadata record</td></tr>
              <tr><td><strong>1 MB</strong></td><td>10⁶</td><td>1,000 KB</td><td>1 medium image, 1 minute of compressed audio</td></tr>
              <tr><td><strong>1 GB</strong></td><td>10⁹</td><td>1,000 MB</td><td>1 hour video stream, mid-sized relational database table</td></tr>
              <tr><td><strong>1 TB</strong></td><td>10¹²</td><td>1,000 GB</td><td>Large production database, fits on a single NVMe disk</td></tr>
              <tr><td><strong>1 PB</strong></td><td>10¹⁵</td><td>1,000 TB</td><td>Big data analytics warehouse (requires distributed storage)</td></tr>
            </tbody>
          </table>
        </div>

        <h2>3. Hardware Envelope Thresholds (Modern Cloud Node)</h2>
        <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px', margin: '20px 0' }}>
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
            <li><strong>RAM per commodity server:</strong> 32 GB &ndash; 256 GB (High-memory cloud nodes reach 1 TB+).</li>
            <li><strong>PostgreSQL / MySQL single instance limit:</strong> ~5,000 &ndash; 10,000 simple write QPS; ~20,000 &ndash; 50,000 read QPS with index optimization. Max active connection pool: ~100&ndash;500 connections (use PgBouncer for more).</li>
            <li><strong>Redis single instance throughput:</strong> ~50,000 &ndash; 100,000 QPS (single-threaded event loop bound by CPU core speed).</li>
            <li><strong>Node.js API process throughput:</strong> ~2,000 &ndash; 8,000 QPS per core for simple I/O proxying.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '40px 0 20px' }}>
          <Link to="/lessons/0001" className="btn btn-secondary">
            ← Back to Lesson 0001
          </Link>
          <Link to="/reference/ref-lb" className="btn btn-primary">
            Next: Load Balancing Cheat Sheet →
          </Link>
        </div>

        <AgentReminder
          title="Need to size a client system?"
          promptText={`Bring your DAU and payload requirements to our chat: "Hey tutor, let's calculate the hardware requirements for my 500k DAU app!"`}
        />
      </div>
    </div>
  );
};
