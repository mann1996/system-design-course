import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { MultiRegionSimulator } from '../../components/Simulators/MultiRegionSimulator';

export const Lesson0020: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0020"
            lessonBadge="Lesson 0020"
            moduleBadge="Module 9: Global &amp; Multi-Region"
            time="25 mins"
            tag="Multi-Region Sim"
          />
          <h1>Multi-Region Architecture: GeoDNS, Anycast, Active-Active Replication &amp; Split-Brain Prevention</h1>
          <p className="lead-text">
            What happens when an entire cloud region suffers a power blackout, a transatlantic fiber cable is severed, or millions of concurrent users write to databases on three continents simultaneously? Deconstruct planetary-scale distributed architecture: Anycast BGP vs. GeoDNS routing, Active-Passive vs. Active-Active multi-primary models, user home-region partitioning, Last-Write-Wins (LWW) clock drift corruption, Conflict-free Replicated Data Types (CRDTs), and split-brain prevention during regional evacuations.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0020" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 5: &ldquo;Replication &ndash; Multi-Leader Replication and Leaderless Systems&rdquo;; Alex Xu and Sahn Lam, <em>System Design Interview &ndash; An Insider&apos;s Guide: Volume 2</em>, Chapter 1: &ldquo;Network Protocols &amp; Multi-Region Architectures&rdquo;; AWS Builders&apos; Library: <em>&ldquo;Multi-Region Application Architecture&rdquo;</em> and <em>&ldquo;Static Stability Using Availability Zones and Regions&rdquo;</em>; and Netflix Technology Blog: <em>&ldquo;Active-Active Multi-Regional Architecture at Netflix&rdquo;</em>.
            </p>
          }
        />

        <h2>1. The Multi-Region Mandate: Disaster Recovery vs. Global Latency</h2>
        <p>
          Until now, our architectures have focused on horizontal compute scaling, caching, and database partitioning within a single cloud region across multiple Availability Zones (AZs). However, relying on a single geographic region introduces two existential enterprise risks:
        </p>
        <ol>
          <li>
            <strong>Catastrophic Regional Failure (Disaster Recovery):</strong> Natural disasters (hurricanes, earthquakes), power grid blackouts, cooling plant failures, or control-plane software bugs can take an entire cloud region offline. In 2021, an AWS <code>us-east-1</code> outage disabled thousands of top internet platforms for over seven hours.
          </li>
          <li>
            <strong>Speed-of-Light Latency Floor:</strong> As established in Lesson 0019, speed of light in fiber optic glass limits trans-continental packet travel. A user in Frankfurt writing to an Amazon RDS primary in Northern Virginia suffers a mandatory 75 ms fiber transit penalty each way (150 ms round trip). If the page requires three sequential database network hops, the user waits nearly half a second before the response arrives.
          </li>
        </ol>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Disaster Metric</th>
                <th>Definition</th>
                <th>Active-Passive Standby</th>
                <th>Active-Active Multi-Region</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>RPO (Recovery Point Objective)</strong></td>
                <td>Maximum acceptable data loss window measured in time (how much data was lost when the region crashed).</td>
                <td>RPO &gt; 0 (typically seconds to minutes of asynchronous replication lag data).</td>
                <td>RPO &approx; 0 (data is already active in multiple live operational regions).</td>
              </tr>
              <tr>
                <td><strong>RTO (Recovery Time Objective)</strong></td>
                <td>Maximum acceptable downtime before service is restored to customers.</td>
                <td>RTO = 5&ndash;30 minutes (DNS TTL propagation, database promotion, health check validation).</td>
                <td>RTO &lt; 30 seconds (automated Anycast BGP or DNS traffic shift to surviving regions).</td>
              </tr>
              <tr>
                <td><strong>Operational Cost</strong></td>
                <td>Infrastructure expenditure multiplier relative to single-region deployment.</td>
                <td>1.4&times;&ndash;1.6&times; (warm or cold standby compute, continuous data storage).</td>
                <td>2.2&times;&ndash;3.0&times; (full live compute fleets with continuous cross-region replication bandwidth).</td>
              </tr>
              <tr>
                <td><strong>Write Consistency Complexity</strong></td>
                <td>Risk of data divergence, lost updates, and split-brain states.</td>
                <td>Low (single leader accepts all writes; zero concurrent multi-region conflicts).</td>
                <td>High (requires CRDTs, user home partitioning, or consensus quorums).</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. Global Ingress: Anycast BGP vs. Latency-Based GeoDNS</h2>
        <p>
          Before a request touches an application server, the global network must decide: <em>which region should receive this client&apos;s connection?</em> There are two primary routing mechanisms in production:
        </p>

        <h3>Mechanism A: GeoDNS &amp; Latency-Based DNS (Route 53, Cloudflare)</h3>
        <p>
          In a DNS-based routing model, the client queries an authoritative name server (e.g. <code>api.example.com</code>). The DNS server inspects the client&apos;s recursive resolver IP address (or EDNS-Client-Subnet) and resolves the hostname to the IP address of the closest regional gateway (e.g. <code>us-east-1</code> for North America, <code>eu-west-1</code> for Europe).
        </p>
        <ul>
          <li><strong>Advantage:</strong> Granular control. Engineers can configure weighted traffic dials (e.g. 90% to US-East, 10% canary to US-West) and health-check failover rules.</li>
          <li><strong>The Fatal Weakness (DNS Caching / TTL):</strong> Client operating systems, mobile cellular carriers, and corporate ISP recursive resolvers frequently ignore low DNS TTLs (e.g. <code>TTL=10s</code>) and cache DNS records for hours. When a region crashes, shifting DNS traffic can take 15&ndash;45 minutes to propagate globally, stranding users on dead IP addresses.</li>
        </ul>

        <h3>Mechanism B: Anycast BGP (Border Gateway Protocol)</h3>
        <p>
          In Anycast, multiple geographically distinct server clusters across the world announce the <strong>exact same IP address</strong> via Border Gateway Protocol (BGP) to Tier-1 internet backbone transit providers (Level 3, Telia, Cogent).
        </p>
        <ul>
          <li><strong>How it Works:</strong> Internet routers automatically route packets to the topological nearest router hop via standard BGP shortest path determination.</li>
          <li><strong>Instant Failover:</strong> If the European gateway fails, its BGP route is withdrawn. Global internet routers automatically converge within seconds and redirect packets to the next closest healthy region &mdash; <em>with zero reliance on client DNS caching</em>.</li>
          <li><strong>The Caveat:</strong> BGP route flapping can occasionally cause mid-stream TCP packet rerouting to a different region if upstream transit paths shift during a long-lived connection.</li>
        </ul>

        <h2>3. Multi-Region Data Topologies: The Consistency Spectrum</h2>
        <p>
          Compute is stateless and easy to duplicate across continents. <strong>State is the hard problem.</strong> There are three architectural topologies for multi-region persistence:
        </p>

        <h3>Pattern 1: Active-Passive with Asynchronous Replication (Warm Standby)</h3>
        <p>
          A single region (e.g., US-East) is designated as the <strong>Global Primary (Leader)</strong>. All database writes worldwide are transmitted over WAN connections to this primary. Secondary regions (EU-West, AP-East) host read-only replicas populated via continuous asynchronous database replication (PostgreSQL streaming replication or AWS Aurora Global Database).
        </p>
        <ul>
          <li><strong>Pros:</strong> Zero write conflicts. Standard relational ACID transactions and unique constraints operate normally without distributed consensus overhead.</li>
          <li><strong>Cons:</strong> High write latency for international users (150&ndash;250 ms round trips). During a primary region outage, failover is not instantaneous; promoting a replica risks losing in-flight replication data (RPO &gt; 0).</li>
        </ul>

        <h3>Pattern 2: Active-Active with User Home Region Affinity (Recommended)</h3>
        <p>
          Used by platforms like Slack, Shopify, and enterprise SaaS: users are partitioned by a deterministic &ldquo;Home Region&rdquo; based on geography or account registration (e.g. European users belong to <code>eu-west-1</code>; American users belong to <code>us-east-1</code>).
        </p>
        <ul>
          <li><strong>Local Writes:</strong> When an EU user updates their profile or places an order, the request routes to <code>eu-west-1</code>. The write commits synchronously to the local regional database in 5 ms.</li>
          <li><strong>Global Read Replication:</strong> The record is replicated asynchronously to other regions for global cross-region reads.</li>
          <li><strong>Traveling User Proxy:</strong> If a European user travels to New York, the Anycast edge receives their request in New York, identifies their Home Region via a lightweight routing token, and proxies the write back to <code>eu-west-1</code>.</li>
          <li><strong>Architectural Benefit:</strong> 99% of writes remain strictly local with zero cross-continental write latency and zero concurrent multi-region write conflicts!</li>
        </ul>

        <h3>Pattern 3: Active-Active Multi-Primary (Global Mesh)</h3>
        <p>
          Every region contains a live writable primary database (e.g. Cassandra, DynamoDB Global Tables, CockroachDB). Any user can write to any region at any millisecond. While this delivers ultra-low write latency globally, it introduces the hardest problem in distributed systems: <strong>concurrent write conflicts</strong>.
        </p>

        <h2>4. Conflict Resolution: Last-Write-Wins (LWW) vs. CRDTs</h2>
        <p>
          Suppose an e-commerce inventory count starts at <code>100</code>. User Alice in Tokyo purchases 1 item in <code>ap-east-1</code> (decrementing count to <code>99</code>). At the exact same millisecond, User Bob in London purchases 1 item in <code>eu-west-1</code> (decrementing count to <code>99</code>). Both transactions commit locally in 5ms.
        </p>
        <p>
          One second later, the cross-region replication streams arrive in the other region. What should the final inventory count be? The correct real-world answer is 100 &minus; 1 &minus; 1 = 98.
        </p>

        <h3>The Fatal Flaw of Last-Write-Wins (LWW) with Wall-Clock Timestamps</h3>
        <p>
          Many naive systems attempt to resolve conflicts using <strong>Last-Write-Wins (LWW)</strong>: comparing server wall-clock timestamps (<em>t<sub>1</sub></em> vs <em>t<sub>2</sub></em>) and letting the highest timestamp overwrite the other.
        </p>
        <p>
          <strong>Why LWW causes silent data loss:</strong>
        </p>
        <ul>
          <li><strong>NTP Clock Drift:</strong> Server quartz clocks are synchronized via NTP, but network jitter, VM hypervisor pauses, and temperature fluctuations routinely cause server clocks to drift by 50&ndash;250 ms (unless operating expensive atomic GPS clocks like Google TrueTime).</li>
          <li>If Server A in Tokyo has a clock that is +85 ms fast, its timestamp will appear &ldquo;newer&rdquo; than a write that physically occurred later on Server B in London!</li>
          <li>The database blindly accepts Tokyo&apos;s update (<code>99</code>) and discards London&apos;s update. One item was sold, payment was charged, but the inventory was silently lost!</li>
        </ul>

        <h3>The Architectural Solution: CRDTs (Conflict-free Replicated Data Types)</h3>
        <p>
          A <strong>CRDT</strong> is a mathematically provable distributed data structure designed by Marc Shapiro et al. CRDT operations obey three fundamental mathematical laws:
        </p>
        <ol>
          <li><strong>Commutativity:</strong> <em>A &star; B = B &star; A</em> (operations can be applied in any order).</li>
          <li><strong>Associativity:</strong> <em>(A &star; B) &star; C = A &star; (B &star; C)</em> (grouping does not change the result).</li>
          <li><strong>Idempotency:</strong> <em>A &star; A = A</em> (duplicate messages do not corrupt state).</li>
        </ol>
        <p>
          For inventory counts or social media likes, systems utilize a <strong>PN-Counter (Positive-Negative Counter)</strong>:
        </p>
        <ul>
          <li>Instead of storing a single integer <code>inventory: 99</code>, each region maintains a vector tracking its own increments (<em>P</em>) and decrements (<em>N</em>):
            <pre style={{ background: '#181715', color: '#faf9f5', padding: '12px', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', marginTop: '6px' }}>
              {`Region US-East:  { positive: 100, negative: 0 }
Region EU-West:  { positive: 0,   negative: 1 }  // Bob purchased 1
Region AP-East:  { positive: 0,   negative: 1 }  // Alice purchased 1`}
            </pre>
          </li>
          <li>When regions replicate, they broadcast their state vectors. To compute the global value:
            <div style={{ margin: '8px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
              Total = &sum; P<sub>i</sub> &minus; &sum; N<sub>i</sub> = 100 &minus; (1 + 1) = 98
            </div>
          </li>
          <li>Regardless of network delays, packet reordering, or clock drift, <strong>all regions converge to the exact same mathematically correct value of 98</strong>!</li>
        </ul>

        <h2>5. Disaster Recovery: Regional Evacuation &amp; Split-Brain Prevention</h2>
        <p>
          When a cloud region suffers a catastrophic event (e.g., transatlantic fiber severed, massive AZ cascading power outage), architects must execute a <strong>Regional Evacuation</strong>.
        </p>

        <h3>The Split-Brain Catastrophe</h3>
        <p>
          If the transatlantic network connection between North America and Europe is severed, US-East and EU-West can no longer communicate. If both regions conclude the other region is dead and both promote themselves to global single-leader, a <strong>Split-Brain</strong> occurs: both regions accept conflicting non-convergent writes, corrupting the database irrecoverably.
        </p>
        <p>
          <strong>Split-Brain Prevention: Quorum Consensus</strong><br />
          Production architectures mandate an <strong>odd number of voting regions</strong> (e.g. 3 regions: US-East, US-West, EU-West) or a lightweight independent <strong>Witness Node</strong> in a third independent cloud provider. A region can only promote itself to primary if it secures a majority quorum (<em>(N / 2) + 1</em>). In a 2-region partition, the isolated region voluntarily steps down into read-only mode.
        </p>

        <h3>The Evacuation Capacity Rule: Headroom Sizing</h3>
        <p>
          Suppose an organization runs two active-active regions (US-East and EU-West), each handling 50,000 QPS. If both regions run at 80% CPU utilization to minimize cloud costs, what happens when US-East fails and 50,000 QPS is shifted to EU-West?
        </p>
        <p>
          EU-West suddenly receives 50,000 + 50,000 = 100,000 QPS. Its utilization spikes to 160%. The surviving region immediately suffers CPU starvation, health checks fail, connection pools exhaust, and the entire global platform collapses in a <strong>cascading global outage</strong>!
        </p>
        <div style={{ background: 'var(--color-card)', borderLeft: '4px solid #cc785c', padding: '16px', borderRadius: '4px', margin: '20px 0' }}>
          <strong>The N+1 Sizing Law for Active-Active Multi-Region:</strong><br />
          In an <em>N</em>-region active-active cluster, every individual region must operate at a maximum steady-state utilization of:
          <div style={{ margin: '8px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
            Target Max Utilization &le; ((N &minus; 1) / N) &times; 100%
          </div>
          <ul>
            <li>In a <strong>2-region active-active cluster</strong>, each region must run at &le; 50% capacity.</li>
            <li>In a <strong>3-region active-active cluster</strong>, each region must run at &le; 66% capacity.</li>
          </ul>
        </div>

        <AIPitfallCallout title="The AI Anti-Pattern: Multi-Region Synchronous 2-Phase Commit (2PC)">
          <p>
            When asked to design a globally consistent multi-region database with &ldquo;zero data loss (RPO=0)&rdquo;, AI assistants frequently suggest wrapping database operations in a cross-region <strong>Synchronous Two-Phase Commit (2PC)</strong> or distributed XA transaction.
          </p>
          <p>
            <strong>Why this is catastrophic at scale:</strong> Synchronous 2PC across transatlantic or transpacific fiber requires multiple round-trip coordination phases (Prepare &rarr; Vote &rarr; Commit). Every single database row lock must be held for 150&ndash;300 ms while awaiting transatlantic acknowledgments. Under 1,000 concurrent checkout requests, database connection pools are instantly exhausted, write throughput plummets from 20,000 QPS down to 40 QPS, and any transient transatlantic packet drop triggers global transaction deadlocks.
          </p>
          <p>
            <strong>The Architect&apos;s Remedy:</strong> Avoid distributed synchronous 2PC across continents. Enforce <strong>User Home Region Affinity</strong> for synchronous local writes, and decouple cross-region synchronization using asynchronous replication logs paired with CRDTs or idempotent compensating workflows.
          </p>
        </AIPitfallCallout>

        <h2>6. Production Implementation: Multi-Region Router &amp; CRDT PN-Counter</h2>
        <p>
          Below is a production TypeScript implementation demonstrating User Home Region affinity routing and a mathematically provable state-based PN-Counter CRDT:
        </p>

        <CodeWindowCard
          title="src/infrastructure/multiregion/GlobalCrdtRouter.ts"
          code={`export type CloudRegion = 'us-east-1' | 'eu-west-1' | 'ap-northeast-1';

export interface UserSession {
  userId: string;
  homeRegion: CloudRegion;
}

/**
 * State-based Positive-Negative Counter CRDT (PN-Counter)
 * Commutative, Associative, and Idempotent across cross-region networks.
 */
export class RegionPNCounter {
  private nodeId: CloudRegion;
  // State vector mapping nodeId -> { positive: P, negative: N }
  private state: Record<string, { p: number; n: number }> = {};

  constructor(nodeId: CloudRegion) {
    this.nodeId = nodeId;
    this.state[nodeId] = { p: 0, n: 0 };
  }

  /**
   * Local increment operation (e.g. stock replenishment or like)
   */
  increment(amount: number = 1): void {
    if (amount < 0) throw new Error('Increment amount must be non-negative');
    const current = this.state[this.nodeId] || { p: 0, n: 0 };
    this.state[this.nodeId] = { p: current.p + amount, n: current.n };
  }

  /**
   * Local decrement operation (e.g. inventory reservation)
   */
  decrement(amount: number = 1): void {
    if (amount < 0) throw new Error('Decrement amount must be non-negative');
    const current = this.state[this.nodeId] || { p: 0, n: 0 };
    this.state[this.nodeId] = { p: current.p, n: current.n + amount };
  }

  /**
   * Merge incoming state vector from a remote region (Commutative Join)
   */
  merge(remoteState: Record<string, { p: number; n: number }>): void {
    for (const [node, counter] of Object.entries(remoteState)) {
      const local = this.state[node] || { p: 0, n: 0 };
      // State-based CRDT takes the mathematical supremum (maximum) of each vector
      this.state[node] = {
        p: Math.max(local.p, counter.p),
        n: Math.max(local.n, counter.n),
      };
    }
  }

  /**
   * Read converged global value
   */
  value(): number {
    let totalP = 0;
    let totalN = 0;
    for (const counter of Object.values(this.state)) {
      totalP += counter.p;
      totalN += counter.n;
    }
    return totalP - totalN;
  }

  getState(): Record<string, { p: number; n: number }> {
    return JSON.parse(JSON.stringify(this.state));
  }
}

/**
 * Multi-Region Traffic Ingress Router
 * Enforces User Home Region Affinity vs Edge Forwarding.
 */
export class MultiRegionIngressRouter {
  private localRegion: CloudRegion;

  constructor(localRegion: CloudRegion) {
    this.localRegion = localRegion;
  }

  /**
   * Evaluates request routing: executes locally if in Home Region;
   * otherwise proxies write to Home Region to eliminate cross-region conflicts.
   */
  evaluateRouting(session: UserSession, isWriteOperation: boolean): {
    action: 'EXECUTE_LOCAL' | 'PROXY_TO_HOME_REGION';
    targetRegion: CloudRegion;
  } {
    if (!isWriteOperation) {
      // All reads are served locally from local read replicas (5ms latency)
      return { action: 'EXECUTE_LOCAL', targetRegion: this.localRegion };
    }

    if (session.homeRegion === this.localRegion) {
      // User is in their designated Home Region: execute synchronous local write
      return { action: 'EXECUTE_LOCAL', targetRegion: this.localRegion };
    }

    // Traveling user: proxy write to Home Region over private backbone
    return { action: 'PROXY_TO_HOME_REGION', targetRegion: session.homeRegion };
  }
}`}
        />

        <h2>7. Interactive Architecture Simulator: Multi-Region Topology &amp; Evacuation</h2>
        <p>
          Simulate a three-region global infrastructure across North America, Europe, and Asia. Test <strong>Active-Passive</strong> versus <strong>User Home Affinity</strong> and <strong>CRDT Multi-Primary</strong>. Witness how NTP clock drift corrupts Last-Write-Wins timestamps, and execute a zero-downtime regional traffic evacuation.
        </p>

        <MultiRegionSimulator />

        <h2>8. Active Retrieval Quizzes</h2>

        <Quiz
          id="quiz_0020_1"
          question="1. Why does Last-Write-Wins (LWW) with server wall-clock timestamps cause silent data corruption in active-active multi-region systems?"
          options={[
            {
              text: 'Because Linux operating systems disable hardware clock synchronization whenever server CPU load exceeds 50 percent.',
              isCorrect: false,
              explanation: 'Linux operating systems do not disable clock synchronization based on CPU load.'
            },
            {
              text: 'Because NTP clock drift across physical servers allows an earlier write on a fast clock to overwrite a true newer write on a slower clock.',
              isCorrect: true,
              explanation: 'Physical server clocks drift by 50-250ms under standard NTP. Comparing timestamps across regions breaks true causal ordering.'
            },
            {
              text: 'Because transpacific submarine fiber cables reverse the mathematical sign of all 64-bit UNIX epoch integers during transmission.',
              isCorrect: false,
              explanation: 'Submarine fiber cables transmit optical bits verbatim; they do not alter integer mathematical signs.'
            },
            {
              text: 'Because relational database B-Trees require all write timestamps to be derived from a single GPS atomic satellite clock in orbit.',
              isCorrect: false,
              explanation: 'Standard databases use local system clocks and do not require orbital GPS atomic clocks.'
            }
          ]}
        />

        <Quiz
          id="quiz_0020_2"
          question="2. In a 2-region active-active deployment (US-East and EU-West), why must each region maintain at least 50% idle compute and database headroom during steady-state?"
          options={[
            {
              text: 'Because if one region fails, the surviving region must absorb 100% of global traffic without exceeding its operational capacity ceiling.',
              isCorrect: true,
              explanation: 'In a 2-region active-active pair, an outage in one region doubles the traffic on the other. Running above 50% causes immediate cascading failure.'
            },
            {
              text: 'Because cloud providers automatically shut down virtual machines if memory utilization drops below 30 percent for more than 5 minutes.',
              isCorrect: false,
              explanation: 'Cloud providers do not shut down instances for running below memory thresholds.'
            },
            {
              text: 'Because Border Gateway Protocol (BGP) Anycast routing requires 50% spare bandwidth to calculate shortest Autonomous System hops.',
              isCorrect: false,
              explanation: 'BGP path calculation is a control plane protocol and has nothing to do with application compute capacity headroom.'
            },
            {
              text: 'Because Reed-Solomon erasure coding requires half of all CPU cores to be reserved for parity reconstruction algorithms.',
              isCorrect: false,
              explanation: 'Erasure coding is a storage engine technique and does not dictate 50% application compute headroom.'
            }
          ]}
        />

        <Quiz
          id="quiz_0020_3"
          question="3. What is the primary operational advantage of 'User Home Region Affinity' over a fully unconstrained Multi-Primary active-active model?"
          options={[
            {
              text: 'It eliminates the need for TLS certificates by routing all client network traffic through local unencrypted intranet tunnels.',
              isCorrect: false,
              explanation: 'TLS encryption is mandatory across all internet traffic regardless of regional affinity.'
            },
            {
              text: 'It allows 99% of user writes to commit synchronously to a local database in 5ms without concurrent cross-region write conflicts.',
              isCorrect: true,
              explanation: 'By pinning each user to a home region, all writes for that user occur on one primary, eliminating concurrent cross-region conflicts.'
            },
            {
              text: 'It enables databases to store all user records directly inside the client browser cache using local Service Workers.',
              isCorrect: false,
              explanation: 'Home region affinity is a server-side partitioning strategy; it does not store master records in browser service workers.'
            },
            {
              text: 'Because quantum entanglement instantly transmits optical bits across oceanic cables without any physical delay.',
              isCorrect: false,
              explanation: 'No software architecture can violate the physical speed of light in fiber optic glass.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0020 Review"
          promptText="I have completed Lesson 0020 on Multi-Region Architecture, Anycast BGP vs GeoDNS, Active-Active Replication, CRDT PN-Counters, and Regional Evacuation. Please challenge me on how to prevent split-brain during a transatlantic network partition, how to size regional evacuation headroom, and when to choose User Home Affinity over Multi-Primary CRDTs."
        />

        <LessonNavButtons currentLessonId="0020" />
      </div>
    </div>
  );
};
