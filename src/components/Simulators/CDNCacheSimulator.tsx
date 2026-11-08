import React, { useState } from 'react';

type ClientRegion = 'Tokyo (NRT)' | 'London (LHR)' | 'Frankfurt (FRA)' | 'New York (JFK)' | 'Sydney (SYD)';

interface ResourceConfig {
  path: string;
  type: 'dynamic_api' | 'static_asset' | 'video_chunk' | 'private_api';
  cacheControl: string;
  surrogateKeys: string[];
  sizeKb: number;
  originLatencyMs: number;
}

const RESOURCES: Record<string, ResourceConfig> = {
  '/api/v1/products/42': {
    path: '/api/v1/products/42',
    type: 'dynamic_api',
    cacheControl: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=60, stale-if-error=300',
    surrogateKeys: ['product-42', 'category-electronics', 'catalog'],
    sizeKb: 12,
    originLatencyMs: 140,
  },
  '/static/app.bundle.js': {
    path: '/static/app.bundle.js',
    type: 'static_asset',
    cacheControl: 'public, max-age=31536000, immutable',
    surrogateKeys: ['static-assets', 'build-v2.4'],
    sizeKb: 340,
    originLatencyMs: 90,
  },
  '/videos/keynote-chunk-01.mp4': {
    path: '/videos/keynote-chunk-01.mp4',
    type: 'video_chunk',
    cacheControl: 'public, max-age=86400, s-maxage=604800',
    surrogateKeys: ['video-stream-99', 'media-chunks'],
    sizeKb: 1024,
    originLatencyMs: 220,
  },
  '/api/v1/user/cart': {
    path: '/api/v1/user/cart',
    type: 'private_api',
    cacheControl: 'private, no-cache, no-store, must-revalidate',
    surrogateKeys: [],
    sizeKb: 4,
    originLatencyMs: 110,
  },
};

interface CacheItem {
  path: string;
  cachedAt: number;
  ttlSeconds: number;
  surrogateKeys: string[];
  etag: string;
  isStale?: boolean;
}

export const CDNCacheSimulator: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<ClientRegion>('London (LHR)');
  const [selectedPath, setSelectedPath] = useState<string>('/api/v1/products/42');
  const [originShieldEnabled, setOriginShieldEnabled] = useState<boolean>(true);
  const [staleWhileRevalidateEnabled, setStaleWhileRevalidateEnabled] = useState<boolean>(true);
  const [originFailing, setOriginFailing] = useState<boolean>(false);

  // Cache stores per PoP & Shield
  const [edgePopCaches, setEdgePopCaches] = useState<Record<string, Record<string, CacheItem>>>({
    'Tokyo (NRT)': {},
    'London (LHR)': {},
    'Frankfurt (FRA)': {},
    'New York (JFK)': {},
    'Sydney (SYD)': {},
  });
  const [originShieldCache, setOriginShieldCache] = useState<Record<string, CacheItem>>({});

  // Metrics
  const [totalRequests, setTotalRequests] = useState<number>(0);
  const [edgeHits, setEdgeHits] = useState<number>(0);
  const [shieldHits, setShieldHits] = useState<number>(0);
  const [originHits, setOriginHits] = useState<number>(0);
  const [bytesSavedKb, setBytesSavedKb] = useState<number>(0);

  // Last Request Result
  const [lastTrace, setLastTrace] = useState<{
    status: number;
    hitTier: 'EDGE_HIT' | 'SHIELD_HIT' | 'ORIGIN_MISS' | 'STALE_HIT' | 'BYPASS';
    totalLatencyMs: number;
    popLatencyMs: number;
    shieldLatencyMs: number;
    originLatencyMs: number;
    headers: Record<string, string>;
  } | null>(null);

  const [activeLog, setActiveLog] = useState<string>(
    'CDN Edge Mesh Initialized. 5 Points of Presence (PoPs) connected via Anycast BGP.'
  );

  const getRegionRttToShield = (region: ClientRegion): number => {
    switch (region) {
      case 'New York (JFK)': return 12;
      case 'London (LHR)': return 68;
      case 'Frankfurt (FRA)': return 76;
      case 'Tokyo (NRT)': return 145;
      case 'Sydney (SYD)': return 190;
      default: return 80;
    }
  };

  const handleSendRequest = () => {
    const resource = RESOURCES[selectedPath];
    const now = Date.now();
    const isPrivate = resource.type === 'private_api';

    let hitTier: 'EDGE_HIT' | 'SHIELD_HIT' | 'ORIGIN_MISS' | 'STALE_HIT' | 'BYPASS' = 'ORIGIN_MISS';
    let popLatency = 8; // Edge PoP local loop latency
    let shieldLatency = 0;
    let originLatency = 0;
    let statusCode = 200;

    const currentPopCache = edgePopCaches[selectedRegion] || {};
    const popItem = currentPopCache[selectedPath];

    if (isPrivate) {
      hitTier = 'BYPASS';
      shieldLatency = originShieldEnabled ? 30 : 0;
      originLatency = resource.originLatencyMs;
      statusCode = originFailing ? 503 : 200;
      setOriginHits((prev) => prev + 1);
    } else if (popItem) {
      // Check freshness
      const ageSeconds = Math.floor((now - popItem.cachedAt) / 1000);
      const isFresh = ageSeconds < popItem.ttlSeconds;

      if (isFresh) {
        hitTier = 'EDGE_HIT';
        setEdgeHits((prev) => prev + 1);
        setBytesSavedKb((prev) => prev + resource.sizeKb);
      } else if (staleWhileRevalidateEnabled && ageSeconds < popItem.ttlSeconds + 60) {
        hitTier = 'STALE_HIT';
        setEdgeHits((prev) => prev + 1);
        setBytesSavedKb((prev) => prev + resource.sizeKb);
        // Background revalidate simulated
        setTimeout(() => {
          setEdgePopCaches((prev) => ({
            ...prev,
            [selectedRegion]: {
              ...prev[selectedRegion],
              [selectedPath]: {
                ...popItem,
                cachedAt: Date.now(),
              },
            },
          }));
        }, 100);
      } else {
        // Expired in PoP
        hitTier = 'ORIGIN_MISS';
      }
    }

    if (hitTier === 'ORIGIN_MISS') {
      const shieldRtt = getRegionRttToShield(selectedRegion);
      const shieldItem = originShieldCache[selectedPath];

      if (originShieldEnabled && shieldItem) {
        const shieldAge = Math.floor((now - shieldItem.cachedAt) / 1000);
        if (shieldAge < shieldItem.ttlSeconds) {
          hitTier = 'SHIELD_HIT';
          shieldLatency = shieldRtt;
          setShieldHits((prev) => prev + 1);
          setBytesSavedKb((prev) => prev + resource.sizeKb);

          // Populate Edge PoP from Shield
          setEdgePopCaches((prev) => ({
            ...prev,
            [selectedRegion]: {
              ...prev[selectedRegion],
              [selectedPath]: {
                path: selectedPath,
                cachedAt: now,
                ttlSeconds: 3600,
                surrogateKeys: resource.surrogateKeys,
                etag: shieldItem.etag,
              },
            },
          }));
        }
      }

      if (hitTier === 'ORIGIN_MISS') {
        shieldLatency = originShieldEnabled ? shieldRtt : 0;
        originLatency = resource.originLatencyMs;

        if (originFailing) {
          if (popItem && popItem.isStale) {
            hitTier = 'STALE_HIT';
            statusCode = 200;
          } else {
            statusCode = 503;
          }
        } else {
          setOriginHits((prev) => prev + 1);
          const newEtag = `W/"${Math.random().toString(36).substring(2, 9)}"`;
          const newCacheItem: CacheItem = {
            path: selectedPath,
            cachedAt: now,
            ttlSeconds: resource.type === 'static_asset' ? 86400 : 3600,
            surrogateKeys: resource.surrogateKeys,
            etag: newEtag,
          };

          // Store in PoP and Origin Shield
          setEdgePopCaches((prev) => ({
            ...prev,
            [selectedRegion]: {
              ...prev[selectedRegion],
              [selectedPath]: newCacheItem,
            },
          }));

          if (originShieldEnabled) {
            setOriginShieldCache((prev) => ({
              ...prev,
              [selectedPath]: newCacheItem,
            }));
          }
        }
      }
    }

    const totalLatency = popLatency + shieldLatency + originLatency;
    setTotalRequests((prev) => prev + 1);

    const headers: Record<string, string> = {
      'content-type': resource.type === 'dynamic_api' || resource.type === 'private_api' ? 'application/json' : 'application/octet-stream',
      'cache-control': resource.cacheControl,
      'x-cache': hitTier === 'EDGE_HIT' ? 'HIT (Edge PoP)' : hitTier === 'SHIELD_HIT' ? 'HIT (Origin Shield)' : hitTier === 'STALE_HIT' ? 'STALE (stale-while-revalidate)' : hitTier === 'BYPASS' ? 'BYPASS (Private)' : 'MISS (Origin Fetch)',
      'x-served-by': `pop-${selectedRegion.split(' ')[1].replace(/[()]/g, '').toLowerCase()}`,
      'age': popItem ? `${Math.floor((now - popItem.cachedAt) / 1000)}` : '0',
    };

    if (resource.surrogateKeys.length > 0) {
      headers['surrogate-key'] = resource.surrogateKeys.join(' ');
    }

    if (hitTier === 'STALE_HIT' && originFailing) {
      headers['warning'] = '110 Response is Stale (stale-if-error)';
    }

    setLastTrace({
      status: statusCode,
      hitTier,
      totalLatencyMs: totalLatency,
      popLatencyMs: popLatency,
      shieldLatencyMs: shieldLatency,
      originLatencyMs: originLatency,
      headers,
    });

    setActiveLog(
      `[GET ${selectedPath}] Client: ${selectedRegion} -> ${hitTier} in ${totalLatency}ms (Status: ${statusCode})`
    );
  };

  const handlePurgeByTag = (tag: string) => {
    let purgedCount = 0;

    // Purge across all Edge PoPs
    setEdgePopCaches((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((region) => {
        const regionCache = { ...updated[region] };
        Object.keys(regionCache).forEach((path) => {
          if (regionCache[path].surrogateKeys.includes(tag)) {
            delete regionCache[path];
            purgedCount += 1;
          }
        });
        updated[region] = regionCache;
      });
      return updated;
    });

    // Purge Origin Shield
    setOriginShieldCache((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((path) => {
        if (updated[path].surrogateKeys.includes(tag)) {
          delete updated[path];
        }
      });
      return updated;
    });

    setActiveLog(
      `⚡ [SURROGATE-KEY PURGE] Tag '${tag}' atomically purged across all 5 Edge PoPs & Origin Shield in 12ms. Evicted ${purgedCount} cached objects.`
    );
  };

  const handleSimulateThunderingHerd = () => {
    setActiveLog(
      `💥 [TRAFFIC SPIKE] 100 concurrent requests arriving simultaneously across 5 global PoPs for /api/v1/products/42...`
    );

    const resource = RESOURCES['/api/v1/products/42'];
    const now = Date.now();

    if (originShieldEnabled) {
      // Single Flight / Request Collapsing via Origin Shield
      setTotalRequests((prev) => prev + 100);
      setOriginHits((prev) => prev + 1); // Only 1 request hits origin core!
      setShieldHits((prev) => prev + 19);
      setEdgeHits((prev) => prev + 80);
      setBytesSavedKb((prev) => prev + resource.sizeKb * 99);

      const item: CacheItem = {
        path: '/api/v1/products/42',
        cachedAt: now,
        ttlSeconds: 3600,
        surrogateKeys: resource.surrogateKeys,
        etag: 'W/"thundering-shield-ok"',
      };

      setOriginShieldCache((prev) => ({ ...prev, ['/api/v1/products/42']: item }));
      setEdgePopCaches((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((r) => {
          next[r]['/api/v1/products/42'] = item;
        });
        return next;
      });

      setActiveLog(
        `🛡️ [ORIGIN SHIELD ACTIVE] 100 requests collapsed! 99 requests absorbed by Edge & Shield. Exactly 1 request hit Origin Core. Database saved!`
      );
    } else {
      // Stampede strikes origin directly!
      setTotalRequests((prev) => prev + 100);
      setOriginHits((prev) => prev + 100); // All 100 hit origin core!
      setActiveLog(
        `⚠️ [ORIGIN COLLAPSE HAZARD] Origin Shield is DISABLED! All 100 requests struck Origin Core concurrently! Origin database connection pool saturated.`
      );
    }
  };

  const offloadPercentage =
    totalRequests > 0 ? Math.round(((edgeHits + shieldHits) / totalRequests) * 100) : 0;

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--rounded-lg)',
        padding: '28px',
        margin: '32px 0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <span className="badge badge-coral" style={{ marginRight: '8px' }}>
            Interactive Perimeter Simulator
          </span>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 600 }}>
            Global Edge Caching, Origin Shielding &amp; Surrogate-Key Invalidation
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSimulateThunderingHerd}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            ⚡ Simulate 100-PoP Spike
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handlePurgeByTag('product-42')}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            🧹 Purge Tag: product-42
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handlePurgeByTag('category-electronics')}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            🧹 Purge Tag: category-electronics
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--color-body)', fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px' }}>
        Observe how modern Content Delivery Networks (Cloudflare, Fastly, AWS CloudFront) intercept global HTTP traffic. Test multi-tier Edge PoP caching, Origin Shield request collapsing, <code>stale-while-revalidate</code> background refreshes, and instant $O(1)$ surrogate-key cache tagging.
      </p>

      {/* Control Configuration Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
          background: 'var(--color-card)',
          padding: '16px',
          borderRadius: 'var(--rounded-md)',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Client Location (Anycast Routing)
          </label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value as ClientRegion)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--rounded-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              fontSize: '13px',
            }}
          >
            <option value="London (LHR)">London (LHR) - Peered LINX</option>
            <option value="Tokyo (NRT)">Tokyo (NRT) - Peered JPIX</option>
            <option value="Frankfurt (FRA)">Frankfurt (FRA) - Peered DE-CIX</option>
            <option value="New York (JFK)">New York (JFK) - Peered NYIIX</option>
            <option value="Sydney (SYD)">Sydney (SYD) - Peered Megaport</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Target URI &amp; HTTP Semantics
          </label>
          <select
            value={selectedPath}
            onChange={(e) => setSelectedPath(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--rounded-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              fontSize: '13px',
            }}
          >
            <option value="/api/v1/products/42">/api/v1/products/42 (Dynamic Catalog API)</option>
            <option value="/static/app.bundle.js">/static/app.bundle.js (Immutable Static Bundle)</option>
            <option value="/videos/keynote-chunk-01.mp4">/videos/keynote-chunk-01.mp4 (Byte-Range Chunk)</option>
            <option value="/api/v1/user/cart">/api/v1/user/cart (Private User Cart)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={originShieldEnabled}
              onChange={(e) => setOriginShieldEnabled(e.target.checked)}
            />
            <strong>Enable Origin Shielding (us-east-1)</strong>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={staleWhileRevalidateEnabled}
              onChange={(e) => setStaleWhileRevalidateEnabled(e.target.checked)}
            />
            <span>stale-while-revalidate (SWR)</span>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: originFailing ? '#e05252' : 'inherit' }}>
            <input
              type="checkbox"
              checked={originFailing}
              onChange={(e) => setOriginFailing(e.target.checked)}
            />
            <strong>Simulate Origin 503 Outage</strong>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSendRequest}
            style={{ width: '100%', fontSize: '13px', padding: '8px 16px' }}
          >
            🚀 Dispatch HTTP GET
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div style={{ background: 'var(--color-card)', padding: '12px', borderRadius: 'var(--rounded-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Requests</div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{totalRequests}</div>
        </div>
        <div style={{ background: 'var(--color-card)', padding: '12px', borderRadius: 'var(--rounded-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Edge PoP Hits</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#2a9d8f', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{edgeHits}</div>
        </div>
        <div style={{ background: 'var(--color-card)', padding: '12px', borderRadius: 'var(--rounded-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Shield Hits</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#e76f51', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{shieldHits}</div>
        </div>
        <div style={{ background: 'var(--color-card)', padding: '12px', borderRadius: 'var(--rounded-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Origin Core Hits</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: originHits > 10 ? '#e05252' : 'inherit', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{originHits}</div>
        </div>
        <div style={{ background: 'var(--color-card)', padding: '12px', borderRadius: 'var(--rounded-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CDN Offload %</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#cc785c', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{offloadPercentage}%</div>
        </div>
        <div style={{ background: 'var(--color-card)', padding: '12px', borderRadius: 'var(--rounded-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Egress Saved</div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
            {bytesSavedKb > 1024 ? `${(bytesSavedKb / 1024).toFixed(1)} MB` : `${bytesSavedKb} KB`}
          </div>
        </div>
      </div>

      {/* Network Topology Visualization */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
          Global Edge Ingress Topology
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Edge PoP Fleet */}
          <div
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--rounded-md)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Tier 1: Perimeter Edge PoPs</span>
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>Anycast Mesh</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.keys(edgePopCaches).map((popName) => {
                const isSelected = popName === selectedRegion;
                const cachedPaths = Object.keys(edgePopCaches[popName]);
                return (
                  <div
                    key={popName}
                    style={{
                      padding: '10px 12px',
                      background: isSelected ? 'rgba(204, 120, 92, 0.12)' : 'var(--color-surface)',
                      border: isSelected ? '1px solid #cc785c' : '1px solid var(--color-border)',
                      borderRadius: 'var(--rounded-md)',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{popName}</strong>
                      <span style={{ color: 'var(--color-muted)' }}>
                        {cachedPaths.length} objects cached
                      </span>
                    </div>
                    {cachedPaths.length > 0 && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {cachedPaths.map((p) => (
                          <span
                            key={p}
                            style={{
                              fontSize: '10px',
                              background: '#efe9de',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontFamily: 'JetBrains Mono, monospace',
                            }}
                          >
                            {p.split('/').pop()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Origin Shield & Origin Core */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Origin Shield */}
            <div
              style={{
                background: originShieldEnabled ? 'var(--color-card)' : 'rgba(0,0,0,0.02)',
                border: originShieldEnabled ? '1px solid #e76f51' : '1px dashed var(--color-border)',
                borderRadius: 'var(--rounded-md)',
                padding: '16px',
                opacity: originShieldEnabled ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  Tier 2: Mid-Tier Origin Shield (AWS us-east-1)
                </span>
                <span className={`badge ${originShieldEnabled ? 'badge-coral' : 'badge-neutral'}`} style={{ fontSize: '11px' }}>
                  {originShieldEnabled ? 'Active (Collapsed Ingress)' : 'Bypassed'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '0 0 10px' }}>
                Aggregates cache misses from all 300+ edge PoPs globally into a single collapsed origin stream.
              </p>
              {originShieldEnabled && (
                <div style={{ fontSize: '12px' }}>
                  <strong>Shield Cache:</strong> {Object.keys(originShieldCache).length === 0 ? 'Empty' : Object.keys(originShieldCache).join(', ')}
                </div>
              )}
            </div>

            {/* Central Origin Core */}
            <div
              style={{
                background: originFailing ? '#ffebee' : 'var(--color-card)',
                border: originFailing ? '1px solid #e05252' : '1px solid var(--color-border)',
                borderRadius: 'var(--rounded-md)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  Central Origin Core (Application &amp; Database Cluster)
                </span>
                <span
                  className="badge"
                  style={{
                    fontSize: '11px',
                    background: originFailing ? '#e05252' : '#2a9d8f',
                    color: '#fff',
                  }}
                >
                  {originFailing ? '503 Outage' : 'Healthy (200 OK)'}
                </span>
              </div>
              <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span>Direct Hits Sustained: <strong>{originHits}</strong></span>
                <span>DB Pool Load: <strong style={{ color: originHits > 20 ? '#e05252' : 'inherit' }}>{Math.min(100, originHits * 5)}%</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Latency Breakdown & Response Headers */}
      {lastTrace && (
        <div
          style={{
            background: '#181715',
            color: '#faf9f5',
            padding: '18px',
            borderRadius: 'var(--rounded-md)',
            marginBottom: '20px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: '#cc785c', fontWeight: 600 }}>
              HTTP/2 {lastTrace.status} {lastTrace.status === 200 ? 'OK' : lastTrace.status === 503 ? 'Service Unavailable' : ''}
            </span>
            <span style={{ color: '#888' }}>
              Total Round-Trip: <strong style={{ color: '#fff' }}>{lastTrace.totalLatencyMs}ms</strong>
              {lastTrace.hitTier === 'EDGE_HIT' && ' (Edge PoP Memory Hit)'}
              {lastTrace.hitTier === 'SHIELD_HIT' && ' (Origin Shield Hit)'}
              {lastTrace.hitTier === 'ORIGIN_MISS' && ' (Full Origin Transit)'}
            </span>
          </div>

          <div style={{ marginBottom: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
            <div>Edge Loop: <span style={{ color: '#2a9d8f' }}>{lastTrace.popLatencyMs}ms</span></div>
            <div>PoP-to-Shield Transit: <span style={{ color: '#e76f51' }}>{lastTrace.shieldLatencyMs}ms</span></div>
            <div>Origin Processing: <span style={{ color: '#e05252' }}>{lastTrace.originLatencyMs}ms</span></div>
          </div>

          <div>
            <div style={{ color: '#888', marginBottom: '6px' }}># Response Headers</div>
            {Object.entries(lastTrace.headers).map(([key, value]) => (
              <div key={key} style={{ margin: '3px 0' }}>
                <span style={{ color: '#82aaff' }}>{key}</span>: <span style={{ color: '#c3e88d' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log Terminal */}
      <div
        style={{
          background: '#0d0d0c',
          color: '#e6edf3',
          padding: '12px 16px',
          borderRadius: 'var(--rounded-md)',
          fontSize: '12px',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        <span style={{ color: '#cc785c', marginRight: '8px' }}>&gt;</span>
        {activeLog}
      </div>
    </div>
  );
};
