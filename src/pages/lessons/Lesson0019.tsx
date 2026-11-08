import React from 'react';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { CDNCacheSimulator } from '../../components/Simulators/CDNCacheSimulator';

export const Lesson0019: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0019"
            lessonBadge="Lesson 0019"
            moduleBadge="Module 9: Global &amp; Multi-Region"
            time="25 mins"
            tag="CDN Simulator"
          />
          <h1>Edge Caching &amp; CDNs: Point of Presence (PoP) Topology, Origin Shielding &amp; Instant Invalidation</h1>
          <p className="lead-text">
            Why does serving a 10-kilobyte JSON catalog payload from a single cloud region in North Virginia condemn users in Sydney and Tokyo to 350-millisecond delays, while edge networks deliver it in 12 milliseconds? Deconstruct Content Delivery Network (CDN) internals: Anycast BGP ingress, Edge PoP vs. Origin Shield topologies, HTTP Cache-Control header discipline, atomic surrogate-key tagging, and Dynamic Site Acceleration (DSA).
          </p>
        </header>

        <LessonHeaderStatus lessonId="0019" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Cloudflare Engineering: <em>&ldquo;How Anycast Works and Why Edge Caching Matters&rdquo;</em> and <em>&ldquo;Cache-Tags &amp; Surrogate-Keys at Scale&rdquo;</em>; Fastly Documentation: <em>&ldquo;Origin Shielding Architecture and Request Collapsing&rdquo;</em>; Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 1 &amp; 12; Alex Xu, <em>System Design Interview &ndash; An Insider&apos;s Guide: Volume 1</em>, Chapter 1 (&ldquo;Content Delivery Network&rdquo;) and Volume 2 Chapter 14 (&ldquo;Digital Content Delivery &amp; Streaming&rdquo;); and IETF RFC 9111 (<em>HTTP Caching</em>) &amp; RFC 7233 (<em>HTTP Range Requests</em>).
            </p>
          }
        />

        <h2>1. The Physical Limit of the Central Origin: Speed of Light in Glass</h2>
        <p>
          Software engineers frequently treat network latency as an operational nuisance to be fixed with more CPU or memory. In reality, planetary network latency is governed by fundamental physics: <strong>the speed of light in fiber optic glass</strong>.
        </p>
        <p>
          Light travels through vacuum at 300,000 km/s, but fiber optic cables possess a refractive index of approximately <em>n &approx; 1.5</em>. Light in glass travels at roughly 200,000 km/s (200 km per millisecond). Furthermore, transatlantic and transpacific submarine cables do not run in straight geometric lines; they follow continental shelves, trench contours, and terrestrial repeaters, increasing physical cable distance by 30%&ndash;50%.
        </p>
        <p>
          Consider a mobile user in Sydney, Australia accessing an origin application server located in AWS <code>us-east-1</code> (North Virginia):
        </p>
        <ul>
          <li><strong>Physical Cable Distance:</strong> &approx; 16,500 km across the Southern Cross Cable network.</li>
          <li><strong>Speed-of-Light Minimum RTT:</strong> (16,500 km &times; 2) / (200 km/ms) &approx; 165 ms round-trip time (RTT) for a single vacuum-free packet. With router hops and signal repeaters, physical RTT is reliably 180&ndash;210 ms.</li>
          <li><strong>TCP Handshake + TLS 1.3 Key Exchange:</strong> Before transmitting a single byte of HTTP payload, the client must negotiate a TCP 3-way handshake (1 RTT) and a TLS 1.3 cryptographic exchange (1 RTT). Total handshake latency: 2 &times; 200 ms = 400 ms.</li>
          <li><strong>HTTP Request + Origin Compute + Transfer:</strong> Another 1 RTT (200 ms) plus 50 ms database execution.</li>
          <li><strong>Total Time to First Byte (TTFB):</strong> 650 ms &mdash; purely from geographical distance!</li>
        </ul>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Geographical Path</th>
                <th>Physical Distance (Fiber)</th>
                <th>Bare Minimum 1-Way Latency</th>
                <th>Round-Trip Time (RTT)</th>
                <th>TCP + TLS 1.3 Handshake (2 RTT)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>New York &rarr; Virginia</strong></td>
                <td>&approx; 400 km</td>
                <td>2 ms</td>
                <td>4&ndash;8 ms</td>
                <td>8&ndash;16 ms</td>
              </tr>
              <tr>
                <td><strong>London &rarr; Virginia</strong></td>
                <td>&approx; 6,000 km</td>
                <td>30 ms</td>
                <td>65&ndash;75 ms</td>
                <td>130&ndash;150 ms</td>
              </tr>
              <tr>
                <td><strong>Tokyo &rarr; Virginia</strong></td>
                <td>&approx; 11,000 km</td>
                <td>55 ms</td>
                <td>135&ndash;155 ms</td>
                <td>270&ndash;310 ms</td>
              </tr>
              <tr>
                <td><strong>Sydney &rarr; Virginia</strong></td>
                <td>&approx; 16,500 km</td>
                <td>82 ms</td>
                <td>180&ndash;210 ms</td>
                <td>360&ndash;420 ms</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          A <strong>Content Delivery Network (CDN)</strong> breaks this physical barrier by moving termination and caching to the internet perimeter. A global CDN deploys hundreds of distributed <strong>Points of Presence (PoPs)</strong> situated inside local Internet Service Providers (ISPs) and Internet Exchange Points (IXPs) like DE-CIX in Frankfurt, LINX in London, and NYIIX in New York.
        </p>
        <p>
          When the Sydney user connects, their TCP and TLS handshakes terminate at the Sydney Edge PoP in just 8 ms. If the requested asset is cached in the Edge PoP&apos;s memory, the entire HTTP response completes in 12 ms instead of 650 ms.
        </p>

        <h2>2. CDN Topology: Edge PoPs vs. Origin Shielding</h2>
        <p>
          A naive CDN deployment places hundreds of edge servers around the world, all communicating directly with your central origin servers. However, at enterprise scale, this creates a catastrophic failure mode known as the <strong>Multi-PoP Thundering Herd</strong>.
        </p>

        <h3>The Multi-PoP Thundering Herd</h3>
        <p>
          Assume your CDN operates across 300 global Edge PoPs. A high-profile product is launched or a breaking news story publishes. The URL is uncached. Within the first two seconds, users in every major city click the link simultaneously:
        </p>
        <ul>
          <li>All 300 Edge PoPs experience an instantaneous <code>CACHE_MISS</code>.</li>
          <li>All 300 Edge PoPs dispatch an origin fetch request simultaneously to your central origin servers.</li>
          <li>If 50 users in London hit the London PoP before the first response returns, and request collapsing is disabled, that single PoP might forward dozens of identical requests.</li>
          <li>Your origin database and application servers are struck by a massive surge of concurrent queries, exhausting connection pools and triggering an origin crash.</li>
        </ul>

        <h3>Origin Shielding (Mid-Tier Caching &amp; Request Collapsing)</h3>
        <p>
          To prevent multi-PoP stampedes, modern CDN architectures (Fastly, AWS CloudFront, Akamai) implement <strong>Origin Shielding</strong>. An Origin Shield is a designated, highly-redundant mid-tier cache cluster strategically located in the same cloud region or availability zone as your origin infrastructure (e.g., AWS <code>us-east-1</code>).
        </p>
        <p>
          The request flow changes fundamentally:
        </p>
        <ol>
          <li><strong>Client to Edge PoP:</strong> Client in Tokyo connects to the Tokyo PoP via Anycast BGP (10 ms). Tokyo experiences a cache miss.</li>
          <li><strong>Edge PoP to Origin Shield:</strong> The Tokyo PoP does <em>not</em> hit the origin application server. Instead, it queries the <strong>Origin Shield</strong> in Virginia over the CDN&apos;s optimized private fiber backbone.</li>
          <li><strong>Request Collapsing (Single Flight):</strong> If 300 global PoPs request the same missing asset within the same 500-millisecond window, the Origin Shield intercepts all 300 incoming requests and executes <strong>request collapsing</strong>: it issues exactly <strong>1 single request</strong> to the origin application server, holds the other 299 connections in queue, and broadcasts the returned response to all waiting PoPs.</li>
          <li><strong>Result:</strong> Origin traffic drops from 300&times; down to 1&times;. Origin offload exceeds 99.5%.</li>
        </ol>

        <h2>3. HTTP Caching Semantics &amp; Header Discipline</h2>
        <p>
          A distributed cache is only as reliable as the HTTP headers that govern it. The standard specification is defined in <strong>RFC 9111</strong>. Senior architects master the precise interplay between client browser caches and shared intermediary edge caches:
        </p>

        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Cache Directive</th>
                <th>Target Layer</th>
                <th>Architectural Purpose &amp; Behavior</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>public</code></td>
                <td>Browser &amp; CDN</td>
                <td>Explicitly permits intermediary shared caches (CDN Edge, reverse proxies) to store the response, even if authenticated with headers.</td>
              </tr>
              <tr>
                <td><code>private</code></td>
                <td>Browser Only</td>
                <td>Restricts caching strictly to the end-user&apos;s browser. CDN edge servers are prohibited from caching. Mandatory for user profile and cart data.</td>
              </tr>
              <tr>
                <td><code>max-age=&lt;seconds&gt;</code></td>
                <td>Browser Cache</td>
                <td>Specifies the maximum time (in seconds) the response is considered fresh by the client browser.</td>
              </tr>
              <tr>
                <td><code>s-maxage=&lt;seconds&gt;</code></td>
                <td>Shared Edge CDN</td>
                <td>Overrides <code>max-age</code> strictly for shared intermediary caches (CDN PoPs). Allows setting a short browser TTL (e.g. 60s) with a long CDN TTL (e.g. 86400s).</td>
              </tr>
              <tr>
                <td><code>stale-while-revalidate=&lt;sec&gt;</code></td>
                <td>Shared &amp; Browser</td>
                <td>Permits the cache to serve an expired cached response instantly to the client while asynchronously fetching a fresh version in the background.</td>
              </tr>
              <tr>
                <td><code>stale-if-error=&lt;sec&gt;</code></td>
                <td>Shared &amp; Browser</td>
                <td>If the origin server returns a 500/502/503/504 error or times out, the CDN serves the stale cached response, keeping the website operational during outages.</td>
              </tr>
              <tr>
                <td><code>immutable</code></td>
                <td>Browser &amp; CDN</td>
                <td>Signals that the response body will never change during its freshness lifetime (e.g. content-hashed bundles like <code>app.4f8a1b.js</code>). Prevents validation conditional requests.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>The Golden Production Header Pattern</h3>
        <p>
          For high-throughput semi-dynamic endpoints (e.g. product catalog item, user profile public bio, news article):
        </p>
        <pre style={{ background: '#181715', color: '#faf9f5', padding: '16px', borderRadius: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
          Cache-Control: public, max-age=60, s-maxage=86400, stale-while-revalidate=300, stale-if-error=3600
        </pre>
        <p>
          Under this policy:
        </p>
        <ul>
          <li>End users cache the item locally for 60 seconds (zero network round-trips on quick back-button navigation).</li>
          <li>Edge CDN PoPs store the item for 24 hours (86,400s).</li>
          <li>When the 24-hour window expires, the next user request receives the cached copy immediately in 10 ms while the CDN quietly updates its cache in the background (<code>stale-while-revalidate=300</code>).</li>
          <li>If the backend database collapses, the CDN absorbs traffic for up to 1 hour by serving stale copies (<code>stale-if-error=3600</code>), masking backend downtime from visitors.</li>
        </ul>

        <h2>4. Instant Atomic Invalidation: Surrogate-Keys &amp; Cache-Tags</h2>
        <p>
          The classic computer science maxim states: <em>&ldquo;There are only two hard things in Computer Science: cache invalidation and naming things.&rdquo;</em>
        </p>
        <p>
          Traditional CDNs relied on <strong>URL Purging</strong>: issuing an HTTP <code>PURGE /api/products/42</code> command. In modern e-commerce and media architectures, URL purging is fundamentally broken:
        </p>
        <ul>
          <li>When the price of product #42 changes from $199 to $149, which URLs are affected?</li>
          <li>The direct product page: <code>/products/42</code>.</li>
          <li>The category listing: <code>/categories/electronics?page=1</code> and <code>page=2</code>.</li>
          <li>The brand page: <code>/brands/sony</code>.</li>
          <li>The search result cache: <code>/search?q=wireless+headphones</code>.</li>
          <li>The homepage: <code>/</code>, <code>/deals</code>, and the mobile API response: <code>/api/v2/items/42</code>.</li>
        </ul>
        <p>
          Tracking and purging thousands of individual URLs is an O(N) operational nightmare that leads to stale inventory and inconsistent checkout prices.
        </p>

        <h3>The Solution: Surrogate-Keys (Cache-Tags)</h3>
        <p>
          Modern CDNs (Fastly, Cloudflare, Akamai) implement <strong>Surrogate-Keys</strong> (also called <code>Cache-Tag</code> in Cloudflare):
        </p>
        <ol>
          <li>When your backend renders a response, it adds a <code>Surrogate-Key</code> header listing all entities embedded in that page:
            <pre style={{ background: '#181715', color: '#faf9f5', padding: '12px', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', marginTop: '8px' }}>
              {`HTTP/2 200 OK
Content-Type: text/html
Cache-Control: public, s-maxage=604800
Surrogate-Key: product-42 category-electronics brand-sony catalog-global`}
            </pre>
          </li>
          <li>The Edge CDN strips this header before sending the response to the user, but indexes the cached content under each tag in its internal memory table.</li>
          <li>When product 42 is updated in the database, the backend emits a single lightweight API call to the CDN:
            <pre style={{ background: '#181715', color: '#faf9f5', padding: '12px', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', marginTop: '8px' }}>
              POST https://api.fastly.com/service/XYZ/purge/product-42
            </pre>
          </li>
          <li>Within <strong>150 milliseconds</strong>, every single Edge PoP worldwide purges all cached pages tagged with <code>product-42</code> &mdash; whether it is the product page, the category listing, or the search view &mdash; in a single atomic O(1) operation!</li>
        </ol>

        <h2>5. Dynamic Site Acceleration (DSA) &amp; HTTP Range Streaming</h2>
        <p>
          What about uncacheable dynamic requests, such as an authenticated checkout transaction (<code>POST /api/checkout</code>) or a live user session update? Can a CDN accelerate traffic that cannot be cached?
        </p>
        <p>
          Yes, through <strong>Dynamic Site Acceleration (DSA)</strong>:
        </p>
        <ul>
          <li><strong>Edge TCP/TLS Termination:</strong> The client establishes its TCP and TLS 1.3 handshake with the nearest Edge PoP in 10ms. Packet loss retransmissions over spotty mobile networks occur over the short last-mile hop.</li>
          <li><strong>Persistent Connection Pools to Origin:</strong> The Edge PoP maintains pre-warmed, persistent TCP connections with optimized congestion windows to the Origin Shield. When an uncached dynamic POST arrives, it is forwarded immediately over existing connections without negotiating new handshakes.</li>
          <li><strong>Optimized Private WAN Routing:</strong> CDN providers lease dedicated dark fiber networks. While public internet packets suffer BGP congestion and fluctuating transit hops, the CDN routes packets across private optimized paths directly to the origin cloud datacenter.</li>
        </ul>

        <h3>Video &amp; Large File Streaming: HTTP Range Requests (RFC 7233)</h3>
        <p>
          Streaming a 2-gigabyte 4K video file from origin would exhaust edge RAM and user bandwidth. CDNs utilize <strong>HTTP Range Requests</strong> (<code>Range: bytes=0-1048575</code>).
        </p>
        <p>
          The CDN slices large files into contiguous 1MB&ndash;4MB byte chunks. Edge PoPs cache only the requested chunks. If a user watches the first 30 seconds and leaves, the CDN transfers only 5MB instead of buffering the entire 2GB file, slashing origin egress bandwidth costs by up to 90%.
        </p>

        <AIPitfallCallout title="The AI Anti-Pattern: Blanket 'Cache-Control: no-cache, no-store' on APIs">
          <p>
            When engineers ask AI assistants to resolve subtle caching discrepancies or outdated price displays, AI models routinely generate:
          </p>
          <pre style={{ background: '#181715', color: '#faf9f5', padding: '12px', borderRadius: '6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
            {`// Naive AI suggestion to avoid stale cache bugs:
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
res.setHeader('Pragma', 'no-cache');
res.setHeader('Expires', '0');`}
          </pre>
          <p>
            <strong>Why this is catastrophic at scale:</strong> This blanket instruction completely bypasses the CDN perimeter. Every single user click, bot crawl, and refresh bypasses the global edge fleet and hits the origin database directly. During a product launch or promotional event, this triggers an immediate database connection pool exhaustion, multiplies egress bandwidth bills by 100&times;, and strips away the CDN&apos;s ability to absorb Distributed Denial of Service (DDoS) traffic.
          </p>
          <p>
            <strong>The Architect&apos;s Remedy:</strong> Differentiate public read entities from private user sessions. Apply <code>public, s-maxage=3600, stale-while-revalidate=60</code> with <code>Surrogate-Keys</code> for catalog data, and reserve <code>private, no-store</code> strictly for authenticated account mutations and financial checkouts.
          </p>
        </AIPitfallCallout>

        <h2>6. Production Implementation: Fastify / Express Edge Cache &amp; Invalidation Engine</h2>
        <p>
          Below is a production-grade TypeScript implementation of an edge caching middleware featuring ETag generation, surrogate-key aggregation, and an event-driven CDN purge client:
        </p>

        <CodeWindowCard
          title="src/infrastructure/cdn/EdgeCacheMiddleware.ts"
          code={`import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface CacheOptions {
  browserTtlSec: number;
  cdnTtlSec: number;
  staleWhileRevalidateSec?: number;
  staleIfErrorSec?: number;
  tags?: string[];
}

/**
 * Enterprise CDN Cache Middleware
 * Generates RFC 9111 compliant Cache-Control, ETag, and Surrogate-Key headers.
 */
export function setCdnCacheHeaders(options: CacheOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache safe idempotent GET/HEAD queries
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      return next();
    }

    const swr = options.staleWhileRevalidateSec ? \`, stale-while-revalidate=\${options.staleWhileRevalidateSec}\` : '';
    const sie = options.staleIfErrorSec ? \`, stale-if-error=\${options.staleIfErrorSec}\` : '';

    // Set dual-tier Cache-Control
    res.setHeader(
      'Cache-Control',
      \`public, max-age=\${options.browserTtlSec}, s-maxage=\${options.cdnTtlSec}\${swr}\${sie}\`
    );

    // Attach Surrogate-Keys for instant atomic purging across Edge PoPs
    if (options.tags && options.tags.length > 0) {
      // Fastly uses Surrogate-Key; Cloudflare uses Cache-Tag
      res.setHeader('Surrogate-Key', options.tags.join(' '));
      res.setHeader('Cache-Tag', options.tags.join(','));
    }

    // Intercept response write to calculate ETag for 304 Not Modified support
    const originalSend = res.send;
    res.send = function (body: any): Response {
      if (body) {
        const hash = crypto
          .createHash('md5')
          .update(typeof body === 'string' ? body : JSON.stringify(body))
          .digest('base64');
        const etag = \`W/"\${hash.substring(0, 16)}"\`;
        res.setHeader('ETag', etag);

        // Check If-None-Match conditional header from client/edge
        const clientEtag = req.headers['if-none-match'];
        if (clientEtag && clientEtag === etag) {
          res.status(304).end();
          return res;
        }
      }
      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Event-Driven CDN Purge Client
 * Executes sub-150ms atomic invalidation across 300+ global PoPs.
 */
export class CdnPurgeClient {
  private serviceId: string;
  private apiToken: string;

  constructor(serviceId: string, apiToken: string) {
    this.serviceId = serviceId;
    this.apiToken = apiToken;
  }

  /**
   * Atomically invalidates all cached URLs sharing the specified Surrogate-Key.
   */
  async purgeBySurrogateKey(key: string): Promise<{ success: boolean; latencyMs: number }> {
    const startTime = Date.now();
    try {
      const response = await fetch(
        \`https://api.fastly.com/service/\${this.serviceId}/purge/\${encodeURIComponent(key)}\`,
        {
          method: 'POST',
          headers: {
            'Fastly-Key': this.apiToken,
            Accept: 'application/json',
          },
        }
      );

      const elapsed = Date.now() - startTime;
      if (!response.ok) {
        throw new Error(\`CDN purge failed with status \${response.status}\`);
      }

      return { success: true, latencyMs: elapsed };
    } catch (error) {
      console.error(\`Failed to purge CDN surrogate key '\${key}':\`, error);
      throw error;
    }
  }
}`}
        />

        <h2>7. Interactive Architecture Simulator: Edge PoPs &amp; Origin Shielding</h2>
        <p>
          Simulate a planetary CDN ingress mesh. Switch client regions from Tokyo to London and New York. Test how <strong>Origin Shielding</strong> collapses concurrent traffic spikes, observe <code>stale-while-revalidate</code> background refreshing, and execute atomic O(1) surrogate-key tag purges.
        </p>

        <CDNCacheSimulator />

        <h2>8. Active Retrieval Quizzes</h2>

        <Quiz
          id="quiz_0019_1"
          question="1. What is the fundamental physical reason that a single cloud origin in North Virginia cannot achieve sub-50ms latency for users in Sydney, Australia?"
          options={[
            {
              text: 'Because transpacific submarine fiber cables impose an immutable speed-of-light minimum round-trip time of ~180-210ms regardless of CPU power.',
              isCorrect: true,
              explanation: 'Light in fiber glass travels at ~200 km/ms. A 16,500 km route requires >165ms round-trip purely for physical photon transit.'
            },
            {
              text: 'Because Australian internet regulations enforce mandatory 300-millisecond cryptographic packet inspection at all border firewalls.',
              isCorrect: false,
              explanation: 'There is no regulatory 300ms delay; network delay is governed by geographic distance and fiber speed-of-light propagation.'
            },
            {
              text: 'Because relational database B-Tree index lookups automatically pause execution when requests originate from southern hemisphere IP addresses.',
              isCorrect: false,
              explanation: 'Relational database execution times are completely agnostic to client geographical hemisphere.'
            },
            {
              text: 'Because Linux operating system kernels require 256-bit AES encryption to perform sequential disk scans on transcontinental TCP sockets.',
              isCorrect: false,
              explanation: 'TCP socket transfers do not perform sequential disk scans or impose geographical kernel penalties.'
            }
          ]}
        />

        <Quiz
          id="quiz_0019_2"
          question="2. How does an 'Origin Shield' protect backend databases from the multi-PoP thundering herd when a breaking news article is published?"
          options={[
            {
              text: 'It converts the incoming HTTP GET requests into UDP broadcast packets that are randomly dropped across intermediate autonomous system routers.',
              isCorrect: false,
              explanation: 'Origin shielding does not drop packets or convert HTTP to UDP broadcasts.'
            },
            {
              text: 'It aggregates misses from 300+ edge PoPs and uses request collapsing to issue exactly one origin fetch, broadcasting the result to all PoPs.',
              isCorrect: true,
              explanation: 'Origin shielding acts as a centralized mid-tier cache. Concurrent misses are collapsed into a single origin request.'
            },
            {
              text: 'It compresses relational database WAL logs using Reed-Solomon erasure coding and replicates them to local browser localStorage instances.',
              isCorrect: false,
              explanation: 'Origin shielding is an HTTP edge cache tier, not a database WAL erasure coding mechanism.'
            },
            {
              text: 'It automatically restarts the origin application server with 8 times more memory whenever edge PoP cache hit ratios drop below 50%.',
              isCorrect: false,
              explanation: 'Origin shields buffer and collapse network traffic; they do not restart origin hardware instances.'
            }
          ]}
        />

        <Quiz
          id="quiz_0019_3"
          question="3. Why is invalidation via 'Surrogate-Keys' (Cache-Tags) superior to traditional URL Purging in modern e-commerce systems?"
          options={[
            {
              text: 'Because URL purging requires compiling the URL path into WebAssembly bytecode before sending it to intermediate BGP routers.',
              isCorrect: false,
              explanation: 'URL purging does not compile paths into WebAssembly or interact with BGP routers.'
            },
            {
              text: 'Because Surrogate-Keys disable TLS 1.3 encryption across all edge PoPs, allowing raw TCP packets to bypass the Linux socket buffer.',
              isCorrect: false,
              explanation: 'Surrogate-Keys are HTTP cache metadata headers and do not alter transport layer encryption.'
            },
            {
              text: 'Because a single product update can be purged across thousands of category, search, and home URLs in an atomic O(1) edge operation.',
              isCorrect: true,
              explanation: 'Surrogate-Keys group all representations of an entity under one tag. A single tag purge clears the entity everywhere instantly.'
            },
            {
              text: 'Because Surrogate-Keys eliminate the need for primary and replica database instances by storing all rows inside the client CPU L1 cache.',
              isCorrect: false,
              explanation: 'Surrogate-Keys operate on the CDN HTTP layer and do not replace relational database storage.'
            }
          ]}
        />

        <AgentReminder
          title="Architect Standby: Lesson 0019 Review"
          promptText="I have completed Lesson 0019 on Edge Caching, CDN Point of Presence (PoP) Topology, Origin Shielding, and Surrogate-Keys. Please challenge me on how stale-while-revalidate masks origin latency, why request collapsing prevents multi-PoP stampedes, and how to configure Cache-Control headers for high-scale media streaming."
        />

        <LessonNavButtons currentLessonId="0019" />
      </div>
    </div>
  );
};
