# Learning Record 0019: Edge Caching, CDN PoP Topology, Origin Shielding & Instant Invalidation

- **Learner Context**: Senior-track engineer mastering global content distribution, perimeter caching architectures, and edge network protocols.
- **Topic**: Physical speed-of-light propagation latency in fiber optic glass, Edge Point of Presence (PoP) vs Origin Shielding topologies, RFC 9111 HTTP Cache-Control header discipline (`s-maxage`, `stale-while-revalidate`, `stale-if-error`), atomic cache purging via Surrogate-Keys (Cache-Tags), Dynamic Site Acceleration (DSA), and HTTP Range byte-serving for media.

## Core Conceptual Breakthroughs

1. **The Physical Latency Floor of the Central Origin**:
   - Planetary network latency is bounded by the refractive index of glass ($n \approx 1.5$), which limits speed of light in fiber optic cables to $\approx 200,000 \text{ km/s}$ ($200 \text{ km/ms}$).
   - Transatlantic and transpacific routes (e.g. Sydney to Virginia, $\approx 16,500 \text{ km}$) impose a physical round-trip time (RTT) floor of $\ge 180\text{--}210 \text{ ms}$.
   - Before application data is transferred, negotiating a standard TCP 3-way handshake and TLS 1.3 key exchange requires 2 full RTTs ($>400 \text{ ms}$). Moving TLS termination and caching to distributed Edge PoPs peering directly with local Internet Exchange Points (IXPs) slashes Time to First Byte (TTFB) from $650 \text{ ms}$ to $<15 \text{ ms}$.

2. **The Multi-PoP Thundering Herd & Origin Shielding**:
   - In a naive CDN architecture with 300+ Edge PoPs worldwide, a viral product launch or breaking news release causes simultaneous cache misses across all 300 PoPs, triggering an origin database collapse (multi-PoP stampede).
   - *Origin Shielding (Mid-Tier Caching)*: Deploying a dedicated caching tier in the origin cloud region intercepts all edge misses.
   - *Request Collapsing (Single Flight)*: When 300 edge PoPs concurrently query an uncached asset, the Origin Shield coalesces them into a single origin fetch, broadcasting the response to all waiting PoPs and delivering $>99\%$ origin offload.

3. **HTTP Cache Header Discipline (RFC 9111)**:
   - `max-age` dictates browser cache duration, while `s-maxage` governs shared intermediary CDN edge caches.
   - `stale-while-revalidate`: Allows edge caches to immediately serve an expired item in $10 \text{ ms}$ while asynchronously dispatching a background worker to refresh the origin data.
   - `stale-if-error`: Protects uptime by instructing edge PoPs to serve stale cached copies during origin 5xx downtime or network brownouts.

4. **Atomic Invalidation via Surrogate-Keys (Cache-Tags)**:
   - URL-based purging fails at scale because modifying a single entity invalidates hundreds of disparate URLs (product pages, category listings, search results, home feeds).
   - With *Surrogate-Keys*, the origin tags HTTP responses with domain entity identifiers (e.g., `Surrogate-Key: product-42 category-electronics`). CDNs index responses by tag, allowing an atomic API purge (`PURGE /tags/product-42`) to evict every matching URL across 300+ global PoPs in $<150 \text{ ms}$ with $O(1)$ complexity.

5. **Dynamic Site Acceleration (DSA) & Media Streaming**:
   - Uncacheable dynamic traffic (e.g. authenticated checkout POSTs) is accelerated via edge TLS termination, persistent pre-warmed TCP connection pools from PoP to origin, and private optimized fiber backbone routing.
   - Large media files are delivered via RFC 7233 HTTP Range requests (`Range: bytes=0-1048575`), caching discrete 1MB&ndash;4MB video chunks at the edge and eliminating multi-gigabyte redundant origin transfers.
