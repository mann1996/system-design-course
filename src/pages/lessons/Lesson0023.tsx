import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { GeospatialIndexSimulator } from '../../components/Simulators/GeospatialIndexSimulator';

export const Lesson0023: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0023"
            lessonBadge="Lesson 0023"
            moduleBadge="Module 11: Geospatial &amp; Location Architecture"
            time="25 mins"
            tag="Geohash &amp; S2 Sim"
          />
          <h1>Geospatial Indexing &amp; Spatial Partitioning: Geohashes, QuadTrees &amp; Google S2</h1>
          <p className="lead-text">
            Standard databases index 1D scalar data (numbers, strings, timestamps) using B-Trees or LSM-Trees. But real-world entities exist in a continuous 2D spherical coordinate space defined by latitude and longitude. Searching for venues, restaurants, or nearby drivers using compound SQL indexes (<code>WHERE lat BETWEEN x1 AND x2 AND lng BETWEEN y1 AND y2</code>) results in catastrophic two-dimensional table scans that degrade database throughput. Master spatial data indexing: Space-Filling Curves (Morton Z-order vs. Hilbert curves), Geohash Base32 encoding, the fatal 8-neighbor boundary edge trap, recursive QuadTrees, and Google S2 spherical cell coverings.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0023" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Alex Xu &amp; Sahn Lam, <em>System Design Interview &ndash; Volume 2</em>, Chapter 1: &ldquo;Proximity Service (Yelp, Google Maps)&rdquo; and Chapter 2: &ldquo;Nearby Friends&rdquo;; Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 3: &ldquo;Multi-column Indexes &ndash; Geospatial indexes&rdquo;; Eric Veach et al., <em>Google S2 Geometry Library Documentation &amp; Hilbert Curve Projection</em>; and Uber Engineering Blog: <em>&ldquo;H3: Uber&apos;s Hexagonal Hierarchical Spatial Index&rdquo;</em>.
            </p>
          }
        />

        <h2>1. The 2D Spatial Indexing Dilemma: Why 1D Indexes Fail</h2>
        <p>
          In traditional databases (PostgreSQL, MySQL, Redis), indexes are one-dimensional. A standard B+Tree arranges keys in a single linear sorting order: $K_1 &lt; K_2 &lt; K_3$.
        </p>
        <p>
          A geographic point is fundamentally two-dimensional: <code>(latitude, longitude)</code>. If a user requests all coffee shops within a 2-kilometer radius of their location, a naive query might write:
        </p>
        <pre className="code-block" style={{ margin: '16px 0', padding: '14px', background: 'var(--color-surface-dark, #181715)', color: '#faf9f5', borderRadius: '8px', fontSize: '13px' }}>
          <code>
            {`SELECT venue_id, name, lat, lng 
FROM venues 
WHERE lat BETWEEN 37.76 AND 37.80 
  AND lng BETWEEN -122.44 AND -122.40;`}
          </code>
        </pre>
        <p>
          Why is this query disastrous at production scale?
        </p>
        <ul>
          <li>
            <strong>Single-Column Index Scan:</strong> If you index <code>latitude</code>, the database uses the index to filter rows in the latitude range. However, for every candidate row in that range (potentially millions of records worldwide), it must perform a full filter scan across the unindexed <code>longitude</code> column.
          </li>
          <li>
            <strong>Compound Index Degradation:</strong> If you create a composite index on <code>(lat, lng)</code>, the database only uses the B-tree for the first column (<code>lat</code>). Because <code>lat</code> is a range condition (<code>BETWEEN</code>), the B-tree cannot efficiently seek into the second column (<code>lng</code>).
          </li>
          <li>
            <strong>Cartesian Product Explosion:</strong> Searching across 50,000,000 global venues requires scanning hundreds of thousands of candidate rows across continents, exhausting database buffer pools and saturating disk IOPS.
          </li>
        </ul>

        <h2>2. Space-Filling Curves: Converting 2D Space into 1D Keys</h2>
        <p>
          To utilize high-performance 1D database indexes (B-Trees in PostgreSQL, Sorted Sets in Redis, or LSM-Trees in Cassandra), we must project 2D coordinates into a single 1D scalar key while preserving spatial locality: <strong>points that are close together in 2D space must remain close together in 1D sorted order</strong>.
        </p>
        <p>
          This is achieved using <strong>Space-Filling Curves</strong>:
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Space-Filling Curve</th>
                <th>Underlying Algorithm</th>
                <th>Pros</th>
                <th>Cons &amp; Distributed Failure Modes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Morton / Z-Order Curve (Geohash)</strong></td>
                <td>Alternates bits of longitude and latitude: bit 0 of lon, bit 0 of lat, bit 1 of lon, bit 1 of lat... Encoded into Base32.</td>
                <td>Extremely fast bitwise interleaving; human-readable string prefixes; supported natively by Redis GEO and Elasticsearch.</td>
                <td><strong>Diagonal Tearing:</strong> Exhibits discontinuous diagonal jumps across quadrant boundaries. Points 2 meters apart can share 0 common prefix characters.</td>
              </tr>
              <tr>
                <td><strong>Hilbert Curve (Google S2)</strong></td>
                <td>Recursive continuous fractal curve that visits every cell in a 2D grid without diagonal leaps. Encoded into 64-bit integers.</td>
                <td><strong>Superior Locality Preservation:</strong> Minimizes distance distortions; zero discontinuous jumps; compact 8-byte integer storage.</td>
                <td>Slightly more complex mathematical transformations; bitwise manipulation requires specialized geometric libraries.</td>
              </tr>
              <tr>
                <td><strong>Hexagonal Cells (Uber H3)</strong></td>
                <td>Discrete global grid using regular hexagons instead of squares. Hierarchical 1D cell IDs.</td>
                <td><strong>Equidistant Neighbors:</strong> All 6 adjacent neighbors have the exact same center distance, eliminating diagonal distance skew in ride dispatch.</td>
                <td>Hexagons cannot be recursively subdivided into smaller exact hexagons without slight aperture orientation rotation.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>3. Geohash Internals: Bit Interleaving &amp; The Fatal 8-Neighbor Trap</h2>
        <p>
          A <strong>Geohash</strong> divides the world recursively into a hierarchical grid. Longitude (&minus;180&deg; to +180&deg;) and Latitude (&minus;90&deg; to +90&deg;) are repeatedly bisected:
        </p>
        <ol>
          <li>If a point lies in the eastern hemisphere, the first longitude bit is <code>1</code>; otherwise <code>0</code>.</li>
          <li>If the point lies in the northern hemisphere, the first latitude bit is <code>1</code>; otherwise <code>0</code>.</li>
          <li>The algorithm alternates bits: <code>lon[0], lat[0], lon[1], lat[1], lon[2], lat[2]...</code></li>
          <li>Every 5 bits are grouped together and converted into a character using Base32 (<code>0-9</code>, <code>b-z</code> omitting <code>a, i, l, o</code> to avoid optical confusion).</li>
        </ol>

        <p>
          Each added character increases spatial precision exponentially:
        </p>
        <ul>
          <li><strong>Length 4:</strong> &asymp; 39.1 km &times; 19.5 km (Metropolitan area)</li>
          <li><strong>Length 5:</strong> &asymp; 4.89 km &times; 4.89 km (City district / neighborhood)</li>
          <li><strong>Length 6:</strong> &asymp; 1.22 km &times; 0.61 km (Large city block)</li>
          <li><strong>Length 7:</strong> &asymp; 153 m &times; 153 m (Street block / building cluster)</li>
          <li><strong>Length 8:</strong> &asymp; 38.2 m &times; 19.1 m (Doorstep precision)</li>
        </ul>

        <AIPitfallCallout title="The Naive Geohash Prefix Trap (The Edge Boundary False Negative)">
          <p>
            A common bug generated by AI coding assistants is searching for nearby venues using a simple SQL prefix match:
          </p>
          <pre style={{ margin: '8px 0', padding: '10px', background: '#181715', color: '#faf9f5', borderRadius: '6px', fontSize: '12px' }}>
            <code>{`-- NAIVE AI QUERY: DANGEROUSLY INCOMPLETE!
SELECT * FROM venues WHERE geohash LIKE 'dr5ru%';`}</code>
          </pre>
          <p>
            <strong>Why this fails catastrophically:</strong> Geohash cells have sharp physical boundaries. If a user is standing 2 meters inside the western border of cell <code>dr5ru</code>, and a high-end restaurant is located 10 meters to their west across the boundary line in cell <code>dr5rq</code>, the restaurant will <strong>NEVER</strong> match <code>LIKE &apos;dr5ru%&apos;</code>!
          </p>
          <p>
            To prevent severe false negatives, any proximity query <strong>MUST expand to the 8 neighboring cells</strong> (North, South, East, West, NW, NE, SW, SE) plus the center cell, querying all 9 geohash prefixes in parallel (<code>WHERE geohash LIKE ANY ('dr5ru%', 'dr5rq%', ...)</code>), followed by exact spherical distance filtering.
          </p>
        </AIPitfallCallout>

        <h2>4. QuadTrees: Recursive 2D Spatial Trees in Memory</h2>
        <p>
          While Geohashes rely on fixed mathematical grids, <strong>QuadTrees</strong> are dynamic hierarchical tree data structures where every internal node has exactly four children: <code>Northwest (NW)</code>, <code>Northeast (NE)</code>, <code>Southwest (SW)</code>, and <code>Southeast (SE)</code>.
        </p>
        <p>
          <strong>The Adaptive Density Advantage:</strong> In dense urban centers (e.g. Manhattan), a single square kilometer may contain 20,000 venues, requiring deep tree subdivision. In rural desert regions, hundreds of square kilometers contain zero venues. QuadTrees adapt organically: a node only splits when the number of points within its bounding box exceeds a designated capacity threshold (e.g. <code>maxPoints = 50</code>).
        </p>
        <p>
          <strong>Range Query Traversal:</strong> When executing a proximity radius search, the search algorithm performs a bounding-box circle intersection check at each tree node. If a quadrant&apos;s bounding box does not intersect the search circle, the entire subtree is <strong>pruned instantly</strong> without examining any of its underlying points ($O(\log N)$ retrieval).
        </p>

        <h2>5. Google S2: Planetary Spherical Geometry</h2>
        <p>
          Planar projections (like standard Mercator or flat grid maps) suffer from severe geometric distortion near the Earth&apos;s poles. <strong>Google S2</strong> models the Earth not as a flat map, but as a true sphere:
        </p>
        <ol>
          <li><strong>Cube Projection:</strong> The sphere is projected onto the six faces of an enclosing cube (Faces 0 through 5).</li>
          <li><strong>Recursive Quad-Subdivision:</strong> Each face is hierarchically subdivided into 30 levels of quad-cells.</li>
          <li><strong>Hilbert Curve Traversal:</strong> Across each face, cells are enumerated along a one-dimensional <strong>Hilbert Curve</strong>.</li>
          <li><strong>Compact 64-bit Integer IDs:</strong> Every S2 cell on the planet is identified by a single 64-bit unsigned integer (<code>uint64</code>). The lowest bits encode the cell level, allowing instant bit-shift operations to find parent cells, child cells, and neighboring cells without database lookups.</li>
        </ol>

        <p>
          Google S2 provides the <code>S2RegionCoverer</code>, which approximates any arbitrary polygon or search circle with a bounded collection of discrete S2 cells (e.g., maximum 8 cells of varying levels). Proximity lookups then reduce to simple 1D range queries on 64-bit integers:
        </p>
        <pre className="code-block" style={{ margin: '16px 0', padding: '14px', background: 'var(--color-surface-dark, #181715)', color: '#faf9f5', borderRadius: '8px', fontSize: '13px' }}>
          <code>
            {`// S2 Cell Range Scan in 1D Sorted Storage (PostgreSQL B-Tree / RocksDB)
SELECT * FROM venues 
WHERE (s2_cell_id BETWEEN range1_min AND range1_max)
   OR (s2_cell_id BETWEEN range2_min AND range2_max);`}
          </code>
        </pre>

        <h2>6. Production Implementation: Geohash Encoder &amp; 8-Neighbor Expansion</h2>
        <p>
          Below is a production-grade TypeScript implementation of a Geohash encoder, 8-neighbor bounding box calculator, and Haversine distance filter:
        </p>

        <CodeWindowCard
          title="geospatial-index.ts"
          code={`const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const BITS = [16, 8, 4, 2, 1];

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Encodes latitude and longitude coordinates into a Base32 Geohash string.
 * Alternates longitude and latitude binary bisecting.
 */
export function encodeGeohash(point: GeoPoint, precision = 6): string {
  let latMin = -90.0, latMax = 90.0;
  let lngMin = -180.0, lngMax = 180.0;
  let geohash = '';
  let bits = 0;
  let charIndex = 0;
  let isEven = true; // Longitude comes first (even bits)

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (point.lng >= mid) {
        charIndex |= BITS[bits];
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (point.lat >= mid) {
        charIndex |= BITS[bits];
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    bits++;

    if (bits === 5) {
      geohash += BASE32[charIndex];
      bits = 0;
      charIndex = 0;
    }
  }

  return geohash;
}

/**
 * Calculates Great-Circle distance using the Haversine formula in meters.
 * Essential: Never use Euclidean distance (x2-x1)^2 + (y2-y1)^2 on lat/long degrees!
 */
export function haversineDistanceMeters(p1: GeoPoint, p2: GeoPoint): number {
  const EARTH_RADIUS_METERS = 6371000;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes the 8 neighboring Geohash cells plus the center cell.
 * Prevents the boundary edge trap where points 10m away are missed.
 */
export function getGeohashSearchCells(center: GeoPoint, precision = 6): string[] {
  // Approximate cell dimensions in degrees for given precision
  // Precision 6: ~1.2km lon x ~0.6km lat
  const latDelta = 180 / Math.pow(2, (precision * 5) / 2);
  const lngDelta = 360 / Math.pow(2, (precision * 5) / 2);

  const cells = new Set<string>();

  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) {
      const neighborPoint: GeoPoint = {
        lat: Math.max(-90, Math.min(90, center.lat + dLat * latDelta)),
        lng: Math.max(-180, Math.min(180, center.lng + dLng * lngDelta)),
      };
      cells.add(encodeGeohash(neighborPoint, precision));
    }
  }

  return Array.from(cells);
}`}
        />

        <h2>7. Interactive Simulation: Geospatial Indexing &amp; Edge Trap Exploration</h2>
        <p>
          Interact with the spatial partition lab below. Switch between <strong>Geohash</strong>, <strong>QuadTree</strong>, and <strong>Google S2 Hilbert Curves</strong>. Click anywhere on the map to relocate the search center. Notice how disabling <em>&ldquo;8-Neighbor Cell Expansion&rdquo;</em> creates severe false negatives near cell boundaries!
        </p>

        <GeospatialIndexSimulator />

        <h2>8. Active Retrieval Quizzes</h2>
        <p>
          Verify your retention of 2D spatial indexing, space-filling curves, and boundary edge defenses.
        </p>

        <Quiz
          id="quiz_0023_1"
          question="1. Why does a standard composite B+Tree index on (latitude, longitude) perform poorly on proximity bounding-box queries?"
          options={[
            {
              text: 'Because B-Trees only sort along one dimension; after evaluating a range on latitude, the engine must perform a linear filter scan across longitude.',
              isCorrect: true,
              explanation: 'A composite index on (lat, lng) can only seek on the first column when a range (BETWEEN) is specified. The second column cannot be efficiently traversed as a sorted key.'
            },
            {
              text: 'Because standard relational databases cannot store floating-point numbers with more than two decimal points of precision.',
              isCorrect: false,
              explanation: 'Relational databases store IEEE 754 64-bit floating point numbers or exact numeric types without issues.'
            },
            {
              text: 'Because TLS 1.3 socket encryption corrupts geographical coordinate payloads when transferred across multi-region VPC backbones.',
              isCorrect: false,
              explanation: 'TLS encryption operates at the transport layer and has nothing to do with database indexing algorithms.'
            },
            {
              text: 'Because Redis sorted sets automatically discard any coordinate record that does not conform to the WGS84 ellipsoid format.',
              isCorrect: false,
              explanation: 'Redis sorted sets store 52-bit integer geohashes and do not reject arbitrary coordinate values.'
            }
          ]}
        />

        <Quiz
          id="quiz_0023_2"
          question="2. What is the fundamental cause of the 'Boundary Edge Trap' when querying Geohashes using naive string prefix matching?"
          options={[
            {
              text: 'Because cellular GPS modems experience packet loss when moving across international time zone boundaries.',
              isCorrect: false,
              explanation: 'The edge trap is purely an indexing artifact caused by grid bisection, not hardware or cellular packet loss.'
            },
            {
              text: 'Two geographically adjacent points that sit on opposite sides of a partition boundary will share zero common prefix characters.',
              isCorrect: true,
              explanation: 'Because Geohashes bisect coordinates into distinct rectangular boxes, points separated by only 2 meters across a boundary line have completely different prefixes. Proximity search must query all 8 adjacent neighbor cells.'
            },
            {
              text: 'Because the Earth is an oblate spheroid, which causes Base32 characters to overflow into negative binary numbers.',
              isCorrect: false,
              explanation: 'Geohash Base32 characters represent 5-bit integers (0 to 31) and never overflow into negative numbers.'
            },
            {
              text: 'Because QuadTrees cannot rebalance their leaf nodes without triggering an immediate Stop-The-World garbage collection.',
              isCorrect: false,
              explanation: 'QuadTree rebalancing is unrelated to Geohash prefix boundary edge effects.'
            }
          ]}
        />

        <Quiz
          id="quiz_0023_3"
          question="3. How does the continuous Hilbert Curve utilized by Google S2 improve upon the Z-Order Morton Curve used in standard Geohashes?"
          options={[
            {
              text: 'It eliminates the need for database storage by recalculating all coordinate positions in real time using client GPU shaders.',
              isCorrect: false,
              explanation: 'Google S2 indexes coordinates into 64-bit integers stored in standard databases.'
            },
            {
              text: 'It replaces all 64-bit integer keys with human-readable hexadecimal strings to improve developer debugging speeds.',
              isCorrect: false,
              explanation: 'S2 specifically uses 64-bit unsigned integers for maximum bitwise computational performance.'
            },
            {
              text: 'The Hilbert Curve visits adjacent cells continuously without diagonal leaps, preserving spatial locality much better than Z-order.',
              isCorrect: true,
              explanation: 'Z-order curves make discontinuous diagonal jumps across quadrant borders. The Hilbert curve is mathematically continuous, guaranteeing that 1D key proximity closely mirrors 2D physical proximity.'
            },
            {
              text: 'It compresses GPS coordinates using Huffman trees so that each location record requires only four bits of network bandwidth.',
              isCorrect: false,
              explanation: 'Hilbert curves are space-filling curves for spatial indexing, not Huffman entropy coding.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0023 Review"
          promptText="I have completed Lesson 0023 on Geospatial Indexing, Space-Filling Curves (Z-Order vs Hilbert Curve), Geohash Base32 encoding, the 8-neighbor boundary edge trap, QuadTrees, and Google S2 cell coverings. Please challenge me on how to choose between Geohash and QuadTrees for dynamic vs static datasets, how to handle boundary edge false negatives, and how S2 64-bit cell integers map into B-tree index scans."
        />

        <LessonNavButtons currentLessonId="0023" />
      </div>
    </div>
  );
};
