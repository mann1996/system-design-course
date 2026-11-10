import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { ProximityDispatchSimulator } from '../../components/Simulators/ProximityDispatchSimulator';

export const Lesson0024: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0024"
            lessonBadge="Lesson 0024"
            moduleBadge="Module 11: Geospatial &amp; Location Architecture"
            time="25 mins"
            tag="Dispatch &amp; Geofence Sim"
          />
          <h1>Real-Time Location Tracking &amp; Proximity Dispatch: High-QPS GPS Ingress, Ephemeral State &amp; Dynamic Geofencing</h1>
          <p className="lead-text">
            Operating a planetary ride-hailing, food delivery, or autonomous fleet platform (e.g. Uber, Lyft, DoorDash) requires processing continuous mobile telemetry from millions of moving vehicles. With 1,000,000 drivers emitting GPS pings every 4 seconds, the system must ingest 250,000 writes/sec, match pickup requests in under 50ms, and detect when vehicles enter surge-pricing geofences. Persisting raw pings to relational database tables incurs catastrophic write amplification, while naive dispatch algorithms cause double-booking race conditions. Deconstruct real-time fleet architecture: ephemeral spatial memory tiers (Redis GEO), concentric expanding ring dispatch, atomic Lua reservation locking, and two-stage dynamic geofencing.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0024" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Alex Xu &amp; Sahn Lam, <em>System Design Interview &ndash; Volume 2</em>, Chapter 2: &ldquo;Nearby Friends&rdquo; and Chapter 6: &ldquo;Ride-Hailing Service (Uber, Lyft)&rdquo;; Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 1: &ldquo;Reliability, Scalability, Maintainability &ndash; Describing Load &amp; Performance&rdquo;; Uber Engineering Blog: <em>&ldquo;Designing DISCO: Uber&apos;s Real-Time Dispatch and Location Engine&rdquo;</em>; and Tile38 Spatial Database Architecture Documentation.
            </p>
          }
        />

        <h2>1. The Ingestion Storm: Ephemeral vs. Persistent State Separation</h2>
        <p>
          Consider a ride-hailing platform with 1,200,000 active drivers worldwide. Each driver app streams its current coordinates every 4 seconds:
        </p>
        <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', color: '#cc785c', margin: '16px 0' }}>
          {'$$\\text{Telemetry Ingress} = \\frac{1,200,000 \\text{ active drivers}}{4 \\text{ seconds}} = 300,000 \\text{ GPS pings/sec}$$'}
        </p>
        <p>
          During inclement weather or flash commute peaks, surges can easily reach <strong>600,000 pings/sec</strong>.
        </p>

        <AIPitfallCallout title="The Relational Database Meltdown (The 400x Write Amplification Trap)">
          <p>
            A fatal architectural mistake often produced by AI models is writing every raw GPS coordinate directly to a relational table:
          </p>
          <pre style={{ margin: '8px 0', padding: '10px', background: '#181715', color: '#faf9f5', borderRadius: '6px', fontSize: '12px' }}>
            <code>{`-- NAIVE AI DESIGN: CATASTROPHIC DISK SATURATION!
INSERT INTO driver_locations (driver_id, lat, lng, recorded_at) 
VALUES ('d123', 37.7749, -122.4194, NOW());`}</code>
          </pre>
          <p>
            <strong>Why this instantly melts database primaries:</strong> A single 50-byte GPS ping requires updating the table heap, the primary key B-tree, any spatial index, and the Write-Ahead Log (WAL). At 300,000 writes/sec, this triggers over <strong>100 MB/sec of sequential WAL writes and saturates random disk IOPS to 100%</strong> within seconds.
          </p>
          <p>
            <strong>The Architectural Law: Driver location is 99.9% EPHEMERAL state.</strong> When Driver #101 moves from Coordinate A to Coordinate B, Coordinate A has zero operational value for dispatch. Only the <em>current</em> location matters. High-frequency coordinates must be ingested into an <strong>in-memory ephemeral spatial store</strong> (Redis GEO). Only durable business milestones (rider pickup, trip completed, payment receipt) are committed to relational storage.
          </p>
        </AIPitfallCallout>

        <h2>2. Redis GEO Internals: 52-bit Integer Geohashes in Sorted Sets</h2>
        <p>
          Instead of building custom spatial indexes from scratch, modern high-throughput architectures leverage <strong>Redis GEO</strong> commands (backed by Redis Sorted Sets):
        </p>
        <ul>
          <li>
            <strong>Bitwise Encoding:</strong> When you execute <code>GEOADD fleet:san_francisco -122.4194 37.7749 "driver_101"</code>, Redis takes the 64-bit floating point coordinates and compresses them into a <strong>52-bit integer Geohash</strong>.
          </li>
          <li>
            <strong>Sorted Set Storage (ZSET):</strong> The 52-bit integer is stored as the <code>score</code> in a standard Redis Sorted Set (skip list + hash table), while the driver ID is stored as the member.
          </li>
          <li>
            <strong>Sub-Millisecond Range Search:</strong> When querying nearby drivers via <code>GEOSEARCH fleet:san_francisco FROMLONLAT -122.4194 37.7749 BYRADIUS 2 km WITHDIST</code>, Redis converts the query radius into a set of 1D score intervals (the center cell + 8 neighboring cells) and executes <code>ZRANGEBYSCORE</code> queries in sub-millisecond time.
          </li>
          <li>
            <strong>Memory Efficiency:</strong> Storing 1,200,000 active driver locations in Redis GEO requires only &asymp; 150 MB of RAM across an entire cluster, easily fitting into memory with immense headroom.
          </li>
        </ul>

        <h2>3. Proximity Dispatch Architecture: Concentric Expanding Rings (KNN)</h2>
        <p>
          When a rider opens the app and requests a ride, the dispatch system must find the optimal driver using <strong>K-Nearest Neighbors (KNN)</strong>.
        </p>
        <p>
          A naive global search sorting all 1,200,000 drivers by distance is an $O(N \log N)$ computational disaster. Instead, production dispatch engines utilize <strong>Concentric Expanding Rings</strong>:
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Search Ring</th>
                <th>Search Radius</th>
                <th>Candidate Pool Size</th>
                <th>Evaluation Criteria &amp; Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Ring 1 (Immediate Proximity)</strong></td>
                <td>0 to 1.0 km</td>
                <td>5 to 20 drivers</td>
                <td>Query Redis GEO. If available drivers are found, rank by Estimated Time of Arrival (ETA) via road routing matrix and dispatch top candidate.</td>
              </tr>
              <tr>
                <td><strong>Ring 2 (Neighborhood Expansion)</strong></td>
                <td>1.0 to 2.5 km</td>
                <td>20 to 60 drivers</td>
                <td>Triggered if Ring 1 has zero available drivers. Expands spatial radius; evaluates highway accessibility.</td>
              </tr>
              <tr>
                <td><strong>Ring 3 (District Ceiling)</strong></td>
                <td>2.5 to 5.0 km</td>
                <td>50 to 150 drivers</td>
                <td>Maximum acceptable dispatch distance before pickup latency exceeds SLA (&gt;8 mins). If Ring 3 is empty, return &ldquo;No drivers available / Surge pricing active&rdquo;.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>4. The Concurrency Disaster: Double-Booking &amp; Atomic Lua Reservation</h2>
        <p>
          In a dense metropolitan area (e.g. Times Square or Shibuya Crossing), hundreds of riders request rides at the exact same second. If multiple riders are close to the same lone available driver, a naive two-step check-then-set logic causes a critical race condition:
        </p>
        <ol>
          <li>Rider A&apos;s request checks Redis: <em>Driver #101 is available.</em></li>
          <li>Rider B&apos;s request checks Redis: <em>Driver #101 is available.</em></li>
          <li>Rider A writes: <em>Matched to Driver #101!</em></li>
          <li>Rider B writes: <em>Matched to Driver #101!</em> &mdash; <strong>Double Booking Disaster! Both riders expect the same car.</strong></li>
        </ol>

        <p>
          To eliminate double booking with zero distributed locking overhead, dispatch engines use an <strong>Atomic Redis Lua Script with Monotonic Lease TTL</strong>:
        </p>
        <ul>
          <li>Redis processes Lua scripts <strong>atomically in a single thread</strong>. No other command can interleave during script execution.</li>
          <li>The script verifies that <code>driver:status:&lt;id&gt; == 'available'</code>, immediately transitions the driver state to <code>'reserved'</code>, sets a <code>driver:lock:&lt;id&gt;</code> key with a 15-second expiration TTL, and associates the lock with the requesting rider.</li>
          <li>If the driver accepts the trip within 15 seconds, the state transitions to <code>'on_trip'</code>. If the driver rejects or the timer expires, the lease automatically dissolves, returning the driver to <code>'available'</code> without zombie locks.</li>
        </ul>

        <h2>5. Dynamic Geofencing at Scale: Ray-Casting &amp; Two-Stage Spatial Pruning</h2>
        <p>
          Real-world platforms must evaluate when moving vehicles enter or leave virtual geographic boundaries (<strong>Geofences</strong>):
        </p>
        <ul>
          <li><strong>Airport Queues:</strong> Automatically queuing drivers who enter airport holding lots.</li>
          <li><strong>Surge Pricing Polygons:</strong> Applying a 2.5x multiplier to rides originating inside high-demand zones.</li>
          <li><strong>Congestion &amp; Toll Zones:</strong> Charging congestion tolls when entering downtown perimeter polygons.</li>
        </ul>

        <p>
          Determining whether a point $(x, y)$ is inside an arbitrary polygon is solved via the <strong>Ray-Casting Algorithm</strong> (Jordan Curve Theorem): emit a horizontal ray from the point to infinity; if the ray intersects an odd number of polygon boundary edges, the point is inside; if even, it is outside.
        </p>
        <p>
          However, testing 1,000,000 moving drivers against 500 geofence polygons every 4 seconds requires:
        </p>
        <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#cc785c' }}>
          {'$$1,000,000 \\text{ drivers} \\times 500 \\text{ polygons} \\times 20 \\text{ edges} = 10,000,000,000 \\text{ edge calculations/sec!}$$'}
        </p>
        <p>
          This brute-force approach would exhaust hundreds of CPU cores. We resolve this using <strong>Two-Stage Spatial Pruning</strong>:
        </p>
        <ol>
          <li>
            <strong>Stage 1 (Coarse Bounding Box / S2 Cell Pre-Filter - $O(1)$):</strong>
            <br />
            Every geofence polygon is wrapped in a Minimum Bounding Box $([\min X, \max X], [\min Y, \max Y])$ and indexed by Google S2 cells. If a driver&apos;s coordinates fall outside the bounding box, the driver is discarded <strong>instantly in nanoseconds</strong> without computing ray intersections. This prunes <strong>&gt;98% of drivers</strong>.
          </li>
          <li>
            <strong>Stage 2 (Fine-Grained Ray-Casting - $O(E)$):</strong>
            <br />
            Only the tiny fraction of candidate drivers located inside the bounding box undergo full Ray-Casting edge intersection math.
          </li>
        </ol>

        <h2>6. Production Implementation: Redis GEO Ingestion &amp; Atomic Lua Lock</h2>
        <p>
          The TypeScript implementation below demonstrates real-time GPS ingestion into Redis GEO and atomic driver reservation using an atomic Lua script:
        </p>

        <CodeWindowCard
          title="redis-dispatch-engine.ts"
          code={`import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface GpsPing {
  driverId: string;
  lat: number;
  lng: number;
  timestamp: number;
}

/**
 * High-Throughput Ephemeral Ingestion:
 * Ingests driver coordinates into Redis GEO (52-bit integer geohash sorted set).
 * Sub-millisecond write; avoids relational database WAL write amplification.
 */
export async function ingestDriverGpsPing(cityZone: string, ping: GpsPing): Promise<void> {
  const geoKey = \`geo:fleet:\${cityZone}\`;
  const driverKey = \`driver:meta:\${ping.driverId}\`;

  const pipeline = redis.pipeline();
  // 1. Update coordinate in geospatial sorted set
  pipeline.geoadd(geoKey, ping.lng, ping.lat, ping.driverId);
  // 2. Refresh last-seen heartbeat with 30s TTL to automatically prune dead sockets
  pipeline.hset(driverKey, {
    lat: ping.lat.toString(),
    lng: ping.lng.toString(),
    updatedAt: ping.timestamp.toString(),
  });
  pipeline.expire(driverKey, 30);

  await pipeline.exec();
}

/**
 * Atomic Driver Reservation Lua Script:
 * Evaluates driver availability and sets an atomic reservation lock with a 15s TTL.
 * Eliminates double-booking race conditions when 10 riders compete for 1 driver.
 */
const ATOMIC_RESERVE_DRIVER_LUA = \`
  local driverId = KEYS[1]
  local riderId = ARGV[1]
  local ttlSeconds = tonumber(ARGV[2])

  local statusKey = "driver:status:" .. driverId
  local lockKey = "driver:lock:" .. driverId

  local currentStatus = redis.call("GET", statusKey)

  -- If status is not 'available' or lock key already exists, reject match
  if currentStatus ~= "available" or redis.call("EXISTS", lockKey) == 1 then
    return 0 -- Failed to lock: already reserved or on trip
  end

  -- Atomically reserve driver
  redis.call("SET", statusKey, "reserved", "EX", ttlSeconds)
  redis.call("SET", lockKey, riderId, "EX", ttlSeconds)

  return 1 -- Success: driver locked for this rider!
\`;

export async function attemptDriverReservation(
  driverId: string,
  riderId: string,
  leaseTtlSeconds = 15
): Promise<boolean> {
  const result = await redis.eval(
    ATOMIC_RESERVE_DRIVER_LUA,
    1,
    driverId,
    riderId,
    leaseTtlSeconds.toString()
  );

  return result === 1;
}

/**
 * Concentric KNN Proximity Dispatch:
 * Expands search rings from 1km -> 3km -> 5km until an available driver is locked.
 */
export async function dispatchNearestDriver(
  cityZone: string,
  riderId: string,
  pickupLat: number,
  pickupLng: number
): Promise<{ driverId: string; distanceMeters: number } | null> {
  const geoKey = \`geo:fleet:\${cityZone}\`;
  const rings = [1000, 2500, 5000]; // 1km, 2.5km, 5km

  for (const radiusMeters of rings) {
    // 1. Search candidates within current ring
    const candidates = await redis.geosearch(
      geoKey,
      'FROMLONLAT',
      pickupLng,
      pickupLat,
      'BYRADIUS',
      radiusMeters,
      'm',
      'WITHDIST',
      'ASC',
      'COUNT',
      10
    ) as [string, string][]; // [driverId, distString][]

    // 2. Attempt atomic reservation on closest candidates
    for (const [candidateId, distStr] of candidates) {
      const locked = await attemptDriverReservation(candidateId, riderId, 15);
      if (locked) {
        return {
          driverId: candidateId,
          distanceMeters: parseFloat(distStr),
        };
      }
    }
  }

  return null; // No drivers available in maximum radius
}`}
        />

        <h2>7. Interactive Simulation: Real-Time Fleet Dispatch &amp; Geofencing</h2>
        <p>
          Simulate the live fleet communications engine below. Observe moving drivers updating coordinates. Place pickup requests on the city grid, witness <strong>Concentric Expanding Ring dispatch</strong>, trigger a <strong>Concurrent Storm</strong> to see how atomic Lua locking eliminates double booking, and watch drivers trigger <strong>Dynamic Surge Geofences</strong> via Ray-Casting!
        </p>

        <ProximityDispatchSimulator />

        <h2>8. Active Retrieval Quizzes</h2>
        <p>
          Test your mastery of high-QPS telemetry ingestion, ephemeral spatial memory, race condition mitigation, and dynamic geofencing.
        </p>

        <Quiz
          id="quiz_0024_1"
          question="1. Why must high-frequency GPS telemetry (300,000 pings/sec) be routed to an in-memory ephemeral store (e.g. Redis GEO) rather than a relational database?"
          options={[
            {
              text: 'Writing every 4-second transient ping to relational disk tables triggers massive Write-Ahead Log write amplification and saturates disk IOPS.',
              isCorrect: true,
              explanation: 'Driver coordinates are ephemeral; old locations are obsolete in 4 seconds. Writing them to SQL tables causes continuous WAL appending and index page splits that melt database storage.'
            },
            {
              text: 'Because PostgreSQL cannot parse floating-point coordinate numbers without an external C++ compiler extension.',
              isCorrect: false,
              explanation: 'PostgreSQL natively handles floating-point coordinates and provides rich spatial extensions like PostGIS.'
            },
            {
              text: 'Because mobile GPS satellites only emit data packets formatted in Redis serialization protocol strings.',
              isCorrect: false,
              explanation: 'GPS satellites broadcast NMEA radio signals; client mobile devices parse them and transmit standard JSON/Protobuf over HTTPS/WebSockets.'
            },
            {
              text: 'Because TCP keep-alive sockets cannot maintain open connections to database primaries across cellular cell towers.',
              isCorrect: false,
              explanation: 'Clients connect to ingress API gateways; database connections are pooled internally behind the compute layer.'
            }
          ]}
        />

        <Quiz
          id="quiz_0024_2"
          question="2. How does an Atomic Redis Lua script eliminate the double-booking disaster during high-concurrency ride dispatch?"
          options={[
            {
              text: 'By executing coordinate calculations in parallel on all available GPU compute shaders in the cluster.',
              isCorrect: false,
              explanation: 'Redis Lua scripts run single-threaded on the Redis CPU core, not on GPU hardware.'
            },
            {
              text: 'It sends an SMS verification code to both riders to confirm which passenger submitted their request first.',
              isCorrect: false,
              explanation: 'SMS verification is an authentication pattern and cannot resolve millisecond-level distributed race conditions.'
            },
            {
              text: 'It checks driver availability and acquires a temporary reservation lease key in a single uninterrupted atomic operation.',
              isCorrect: true,
              explanation: 'Redis executes Lua scripts atomically without thread interleaving. If Driver #101 is available, the script locks the driver with a TTL and assigns the rider in one atomic step, preventing concurrent matches.'
            },
            {
              text: 'It locks the entire Redis cluster read-only for sixty seconds whenever a passenger opens the mobile app.',
              isCorrect: false,
              explanation: 'Locking the entire cluster read-only would cause a catastrophic platform outage for all users.'
            }
          ]}
        />

        <Quiz
          id="quiz_0024_3"
          question="3. In dynamic geofencing, what is the primary purpose of Two-Stage Spatial Pruning before running the Ray-Casting algorithm?"
          options={[
            {
              text: 'To convert all polygon coordinates into base64 audio clips for accessibility screen readers.',
              isCorrect: false,
              explanation: 'Dynamic geofencing is a geometric computational problem, unrelated to audio accessibility.'
            },
            {
              text: 'To eliminate over 95% of distant drivers using fast O(1) bounding-box checks, avoiding expensive edge calculations on all drivers.',
              isCorrect: true,
              explanation: 'Testing 1,000,000 drivers against 500 multi-sided polygons every 4 seconds requires billions of edge calculations. A simple bounding box check discards distant drivers in nanoseconds, running Ray-Casting only on true candidates.'
            },
            {
              text: 'To force all moving vehicles to come to a complete stop whenever they cross an airport polygon boundary line.',
              isCorrect: false,
              explanation: 'Geofences detect spatial entry/exit; they do not control physical vehicle locomotion.'
            },
            {
              text: 'To encrypt vehicle telemetry packets using RSA 4096-bit asymmetric keys before transmitting over cellular 5G.',
              isCorrect: false,
              explanation: 'Two-stage pruning is an algorithmic spatial optimization, not a cryptographic transport mechanism.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0024 Review"
          promptText="I have completed Lesson 0024 on Real-Time Location Tracking, Ephemeral Ingress vs Relational Write Amplification, Redis GEO 52-bit integer sorted sets, Concentric KNN Expanding Ring dispatch, Atomic Lua Reservation Locking, and Two-Stage Geofencing with Ray-Casting. Please challenge me on how to size Redis GEO clusters for 1M concurrent drivers, how to handle driver lock expiration edge cases, and how to scale geofence evaluation across distributed compute worker pools."
        />

        <LessonNavButtons currentLessonId="0024" />
      </div>
    </div>
  );
};
