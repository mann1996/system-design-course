import React, { useState } from 'react';

type RoutingStrategy = 'latency_anycast' | 'active_passive' | 'user_home_affinity' | 'multi_primary_crdt';
type RegionId = 'us-east' | 'eu-west' | 'ap-east';

interface RegionState {
  id: RegionId;
  name: string;
  location: string;
  status: 'healthy' | 'impaired' | 'evacuated';
  qpsCapacity: number;
  currentQps: number;
  replicationLagMs: number;
  localInventoryCount: number;
  pnCounter: { [nodeId: string]: { positive: number; negative: number } };
}

export const MultiRegionSimulator: React.FC = () => {
  const [strategy, setStrategy] = useState<RoutingStrategy>('user_home_affinity');
  const [simulatedClockSkewMs, setSimulatedClockSkewMs] = useState<number>(85); // 85ms clock drift
  const [activeLog, setActiveLog] = useState<string>(
    'Global Multi-Region Mesh online. 3 Regions active (US-East, EU-West, AP-East) connected via private AWS/Cloud backbones.'
  );

  const [regions, setRegions] = useState<Record<RegionId, RegionState>>({
    'us-east': {
      id: 'us-east',
      name: 'US-East (N. Virginia)',
      location: 'North America',
      status: 'healthy',
      qpsCapacity: 100000,
      currentQps: 45000,
      replicationLagMs: 0,
      localInventoryCount: 500,
      pnCounter: { 'us-east': { positive: 500, negative: 0 } },
    },
    'eu-west': {
      id: 'eu-west',
      name: 'EU-West (Frankfurt)',
      location: 'Europe',
      status: 'healthy',
      qpsCapacity: 100000,
      currentQps: 40000,
      replicationLagMs: 65,
      localInventoryCount: 500,
      pnCounter: { 'eu-west': { positive: 0, negative: 0 } },
    },
    'ap-east': {
      id: 'ap-east',
      name: 'AP-East (Tokyo)',
      location: 'Asia-Pacific',
      status: 'healthy',
      qpsCapacity: 100000,
      currentQps: 35000,
      replicationLagMs: 140,
      localInventoryCount: 500,
      pnCounter: { 'ap-east': { positive: 0, negative: 0 } },
    },
  });

  // Conflict state demonstration
  const [lwwConflictState, setLwwConflictState] = useState<{
    usWrite: { val: number; wallClock: number; skew: number };
    euWrite: { val: number; wallClock: number; skew: number };
    resolvedValue: number;
    anomalyDetected: boolean;
  } | null>(null);

  // Cross-region speed of light round-trip latency
  const getCrossRegionTransitLatency = (source: RegionId, target: RegionId): number => {
    if (source === target) return 5; // Local AZ loop
    if ((source === 'us-east' && target === 'eu-west') || (source === 'eu-west' && target === 'us-east')) return 72;
    if ((source === 'us-east' && target === 'ap-east') || (source === 'ap-east' && target === 'us-east')) return 145;
    if ((source === 'eu-west' && target === 'ap-east') || (source === 'ap-east' && target === 'eu-west')) return 195;
    return 80;
  };

  // Dispatch write from a specific client origin
  const handleClientWrite = (originRegion: RegionId, amount: number) => {
    const isUsPrimary = strategy === 'active_passive';

    if (isUsPrimary) {
      // In Active-Passive, all writes must travel to us-east!
      const transitLatency = getCrossRegionTransitLatency(originRegion, 'us-east');
      const totalLatency = transitLatency + 15; // Transit + DB write

      if (regions['us-east'].status !== 'healthy') {
        setActiveLog(
          `❌ [WRITE FAILED] Region us-east is down! In Active-Passive, writes are unavailable until manual failover triggers.`
        );
        return;
      }

      setRegions((prev) => {
        const nextVal = prev['us-east'].localInventoryCount + amount;
        return {
          ...prev,
          'us-east': { ...prev['us-east'], localInventoryCount: nextVal },
        };
      });

      setActiveLog(
        `[ACTIVE-PASSIVE WRITE] Client in ${originRegion.toUpperCase()} -> Routed cross-continental to US-East Primary in ${totalLatency}ms (Inventory: ${regions['us-east'].localInventoryCount + amount})`
      );
    } else if (strategy === 'user_home_affinity') {
      // In User Home Affinity, writes commit synchronously in local home region in 5ms!
      const targetRegion = regions[originRegion].status === 'healthy' ? originRegion : 'eu-west';

      setRegions((prev) => {
        const nextVal = prev[targetRegion].localInventoryCount + amount;
        return {
          ...prev,
          [targetRegion]: { ...prev[targetRegion], localInventoryCount: nextVal },
        };
      });

      setActiveLog(
        `⚡ [HOME REGION WRITE] User affinity write committed locally in ${targetRegion.toUpperCase()} in 6ms! Asynchronous replication queued.`
      );
    } else {
      // Multi-primary with CRDT PN-Counter
      setRegions((prev) => {
        const currentRegion = prev[originRegion];
        const currentCounter = currentRegion.pnCounter[originRegion] || { positive: 0, negative: 0 };
        const updatedCounter = {
          ...currentCounter,
          positive: amount > 0 ? currentCounter.positive + amount : currentCounter.positive,
          negative: amount < 0 ? currentCounter.negative + Math.abs(amount) : currentCounter.negative,
        };

        return {
          ...prev,
          [originRegion]: {
            ...currentRegion,
            pnCounter: {
              ...currentRegion.pnCounter,
              [originRegion]: updatedCounter,
            },
          },
        };
      });

      setActiveLog(
        `🟢 [CRDT PN-COUNTER WRITE] Region ${originRegion.toUpperCase()} atomically mutated local PN-Vector in 4ms. Mathematically commutative across regions.`
      );
    }
  };

  // Trigger concurrent conflicting writes to demonstrate LWW vs CRDT
  const handleSimulateConcurrentConflict = () => {
    const baseTime = Date.now();
    // US server clock has positive skew (ahead by simulatedClockSkewMs)
    const usWallClock = baseTime + simulatedClockSkewMs;
    // EU server clock has 0 skew
    const euWallClock = baseTime + 20; // 20ms later in real physical time!

    // In real physical time:
    // Event 1 happens in US at baseTime: updates price/inventory to 420
    // Event 2 happens in EU at baseTime + 20ms: updates price/inventory to 450 (the newer intended real-world value!)

    // Last Write Wins uses server timestamp:
    // usWallClock = baseTime + 85ms
    // euWallClock = baseTime + 20ms
    // Because usWallClock > euWallClock, LWW picks US write (420), throwing away EU's newer write (450)!

    const lwwWinner = usWallClock > euWallClock ? 420 : 450;
    const anomaly = lwwWinner === 420; // True physical order was overwritten by clock drift!

    setLwwConflictState({
      usWrite: { val: 420, wallClock: usWallClock, skew: simulatedClockSkewMs },
      euWrite: { val: 450, wallClock: euWallClock, skew: 0 },
      resolvedValue: lwwWinner,
      anomalyDetected: anomaly,
    });

    // Also update CRDT state to show the contrast
    setRegions((prev) => ({
      ...prev,
      'us-east': {
        ...prev['us-east'],
        pnCounter: {
          ...prev['us-east'].pnCounter,
          'us-east': { positive: 420, negative: 0 },
        },
      },
      'eu-west': {
        ...prev['eu-west'],
        pnCounter: {
          ...prev['eu-west'].pnCounter,
          'eu-west': { positive: 30, negative: 0 }, // additive delta
        },
      },
    }));

    setActiveLog(
      anomaly
        ? `⚠️ [LWW ANOMALY DETECTED] Wall-clock skew (+${simulatedClockSkewMs}ms) caused Last-Write-Wins to overwrite EU's newer write! Data corrupted by NTP drift.`
        : `[CONCURRENT RESOLUTION] Both writes captured. CRDT vectors converged without data loss.`
    );
  };

  // Fail region (e.g. US-East datacenter sever)
  const handleToggleRegionStatus = (id: RegionId) => {
    setRegions((prev) => {
      const isCurrentlyHealthy = prev[id].status === 'healthy';
      const newStatus = isCurrentlyHealthy ? 'impaired' : 'healthy';

      return {
        ...prev,
        [id]: { ...prev[id], status: newStatus },
      };
    });

    setActiveLog(
      regions[id].status === 'healthy'
        ? `🚨 [REGIONAL OUTAGE TRIGGERED] Region ${id.toUpperCase()} severed! Health-check probes failing.`
        : `✅ [REGIONAL RESTORATION] Region ${id.toUpperCase()} restored to healthy state. Catching up replication stream.`
    );
  };

  // Evacuate impaired region (traffic shift via Anycast / Route 53)
  const handleRegionalEvacuation = (fromRegion: RegionId) => {
    setRegions((prev) => {
      const evacuatedQps = prev[fromRegion].currentQps;
      const targetRegions: RegionId[] = (['us-east', 'eu-west', 'ap-east'] as RegionId[]).filter(
        (r) => r !== fromRegion && prev[r].status === 'healthy'
      );

      if (targetRegions.length === 0) return prev;

      const qpsPerTarget = Math.round(evacuatedQps / targetRegions.length);
      const next = { ...prev };
      next[fromRegion] = { ...next[fromRegion], status: 'evacuated', currentQps: 0 };

      targetRegions.forEach((r) => {
        next[r] = { ...next[r], currentQps: next[r].currentQps + qpsPerTarget };
      });

      return next;
    });

    setActiveLog(
      `🛡️ [REGIONAL EVACUATION COMPLETE] BGP Anycast routes withdrawn. 45,000 QPS gracefully drained to surviving regions. Zero client dropped connections.`
    );
  };

  // Calculate CRDT converged total
  const computeCrdtGlobalValue = (): number => {
    let total = 0;
    Object.values(regions).forEach((r) => {
      Object.values(r.pnCounter).forEach((entry) => {
        total += entry.positive - entry.negative;
      });
    });
    return total;
  };

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
            Interactive Multi-Region Simulator
          </span>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 600 }}>
            Multi-Region Routing, Replication Lag &amp; Active-Active Conflicts
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSimulateConcurrentConflict}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            ⚔️ Simulate Concurrent Write Conflict
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleToggleRegionStatus('us-east')}
            style={{ fontSize: '13px', padding: '6px 14px', color: regions['us-east'].status === 'healthy' ? '#e05252' : '#2a9d8f' }}
          >
            {regions['us-east'].status === 'healthy' ? '🚨 Sever US-East' : '✅ Restore US-East'}
          </button>
          {regions['us-east'].status === 'impaired' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleRegionalEvacuation('us-east')}
              style={{ fontSize: '13px', padding: '6px 14px' }}
            >
              🔄 Evacuate US-East Traffic
            </button>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--color-body)', fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px' }}>
        Explore planetary-scale distributed architecture. Compare <strong>Active-Passive</strong> (single master) with <strong>User Home Affinity</strong> and <strong>Active-Active Multi-Primary</strong>. Witness how physical speed-of-light limits dictate latency and how clock drift corrupts Last-Write-Wins (LWW) versus CRDTs.
      </p>

      {/* Architecture Selection Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
          background: 'var(--color-card)',
          padding: '16px',
          borderRadius: 'var(--rounded-md)',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Multi-Region Replication Architecture
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as RoutingStrategy)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--rounded-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              fontSize: '13px',
            }}
          >
            <option value="user_home_affinity">Active-Active: User Home Region Affinity (Recommended)</option>
            <option value="multi_primary_crdt">Active-Active: Multi-Primary with CRDT PN-Counters</option>
            <option value="active_passive">Active-Passive: Single US-East Master (Warm Standby)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Simulate Server NTP Clock Drift: {simulatedClockSkewMs}ms
          </label>
          <input
            type="range"
            min="0"
            max="250"
            step="5"
            value={simulatedClockSkewMs}
            onChange={(e) => setSimulatedClockSkewMs(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-muted)' }}>
            <span>0ms (Atomic GPS)</span>
            <span>85ms (Typical NTP Drift)</span>
            <span>250ms (Severed Drift)</span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Test Client Mutation
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleClientWrite('us-east', 10)}
              style={{ fontSize: '12px', padding: '6px 10px', flex: 1 }}
            >
              Write from US (+10)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleClientWrite('eu-west', 10)}
              style={{ fontSize: '12px', padding: '6px 10px', flex: 1 }}
            >
              Write from EU (+10)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleClientWrite('ap-east', 10)}
              style={{ fontSize: '12px', padding: '6px 10px', flex: 1 }}
            >
              Write from AP (+10)
            </button>
          </div>
        </div>
      </div>

      {/* Regional Topology Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {(Object.keys(regions) as RegionId[]).map((regionKey) => {
          const region = regions[regionKey];
          const isPrimary = strategy === 'active_passive' && regionKey === 'us-east';
          const isStandby = strategy === 'active_passive' && regionKey !== 'us-east';
          const utilizationPct = Math.round((region.currentQps / region.qpsCapacity) * 100);
          const isOverloaded = utilizationPct > 80;

          return (
            <div
              key={region.id}
              style={{
                background: region.status === 'impaired' ? '#ffebee' : 'var(--color-card)',
                border:
                  region.status === 'impaired'
                    ? '1px solid #e05252'
                    : isOverloaded
                    ? '1px solid #e76f51'
                    : '1px solid var(--color-border)',
                borderRadius: 'var(--rounded-md)',
                padding: '18px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{region.name}</span>
                <span
                  className="badge"
                  style={{
                    fontSize: '11px',
                    background:
                      region.status === 'healthy'
                        ? '#2a9d8f'
                        : region.status === 'evacuated'
                        ? '#888'
                        : '#e05252',
                    color: '#fff',
                  }}
                >
                  {region.status.toUpperCase()}
                </span>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '12px' }}>
                {region.location} &bull; {isPrimary ? '👑 Global Write Master' : isStandby ? 'ReadOnly Replica' : 'Active-Active Peer'}
              </div>

              {/* Capacity Bar */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span>QPS Load: {region.currentQps.toLocaleString()} / {region.qpsCapacity.toLocaleString()}</span>
                  <strong>{utilizationPct}%</strong>
                </div>
                <div style={{ height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${utilizationPct}%`,
                      background: isOverloaded ? '#e05252' : utilizationPct > 60 ? '#e76f51' : '#2a9d8f',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Replication & Storage Info */}
              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cross-Region Lag:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {regionKey === 'us-east' ? '0ms (Master)' : `~${region.replicationLagMs}ms`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Local Inventory View:</span>
                  <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {strategy === 'multi_primary_crdt'
                      ? computeCrdtGlobalValue()
                      : region.localInventoryCount}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Concurrent Conflict Diagnostic Box */}
      {lwwConflictState && (
        <div
          style={{
            background: '#181715',
            color: '#faf9f5',
            padding: '20px',
            borderRadius: 'var(--rounded-md)',
            marginBottom: '20px',
            fontSize: '12px',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: lwwConflictState.anomalyDetected ? '#e05252' : '#2a9d8f', fontWeight: 600 }}>
              {lwwConflictState.anomalyDetected ? '⚠️ LAST-WRITE-WINS CORRUPTION DETECTED' : '✅ CONVERGED CLEANLY'}
            </span>
            <span style={{ color: '#888' }}>
              US Drift: +{lwwConflictState.usWrite.skew}ms | EU Drift: +{lwwConflictState.euWrite.skew}ms
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '14px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
            <div>
              <div style={{ color: '#82aaff', marginBottom: '4px' }}>US-East Concurrent Write:</div>
              <div>Value: <strong>{lwwConflictState.usWrite.val}</strong></div>
              <div>Reported Timestamp: {lwwConflictState.usWrite.wallClock}</div>
              <div style={{ color: '#888', fontSize: '11px' }}>Physical order: Happened FIRST</div>
            </div>
            <div>
              <div style={{ color: '#c3e88d', marginBottom: '4px' }}>EU-West Concurrent Write:</div>
              <div>Value: <strong>{lwwConflictState.euWrite.val}</strong></div>
              <div>Reported Timestamp: {lwwConflictState.euWrite.wallClock}</div>
              <div style={{ color: '#888', fontSize: '11px' }}>Physical order: Happened LATER (+20ms)</div>
            </div>
            <div>
              <div style={{ color: '#cc785c', marginBottom: '4px' }}>Arbitration Outcome:</div>
              <div>LWW Winner: <strong style={{ color: lwwConflictState.anomalyDetected ? '#e05252' : '#2a9d8f' }}>{lwwConflictState.resolvedValue}</strong></div>
              <div style={{ fontSize: '11px', color: '#bbb', marginTop: '4px' }}>
                {lwwConflictState.anomalyDetected
                  ? 'CRITICAL: The earlier US write won because its clock was skewed ahead! The true newer EU write was silently lost.'
                  : 'Timestamps aligned with true causality.'}
              </div>
            </div>
          </div>

          <div style={{ color: '#82aaff', fontSize: '11px' }}>
            💡 <strong>Why CRDTs Fix This:</strong> Instead of choosing between 420 and 450 using flawed wall clocks, a CRDT PN-Counter tracks vector additions (+420 in US, +30 in EU), allowing all regions to converge mathematically to 450 regardless of arrival order or clock skew.
          </div>
        </div>
      )}

      {/* Terminal Activity Log */}
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
