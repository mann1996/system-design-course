import React, { useState } from 'react';

interface LogItem {
  id: number;
  time: string;
  html: string;
}

export const ShardingSimulator: React.FC = () => {
  const [inputKey, setInputKey] = useState('user_4218');
  const [storedKeys, setStoredKeys] = useState<string[]>([]);
  const [node5Active, setNode5Active] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: 1,
      time: new Date().toTimeString().split(' ')[0],
      html: 'Consistent Hashing Cluster initialized with 4 physical shards. Enter keys to route.'
    }
  ]);

  const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const getShardIndex = (key: string, numShards: number) => {
    const hashVal = simpleHash(key);
    const pct = (hashVal % 1000) / 1000;
    return Math.floor(pct * numShards);
  };

  const appendLog = (html: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [{ id: Date.now() + Math.random(), time, html }, ...prev.slice(0, 30)]);
  };

  const routeKey = (key: string) => {
    if (!key.trim()) return;
    const numShards = node5Active ? 5 : 4;
    const shardIdx = getShardIndex(key, numShards);
    const hashVal = simpleHash(key);

    setStoredKeys((prev) => [...prev, key]);
    setHighlightIdx(shardIdx);
    setTimeout(() => setHighlightIdx(null), 800);

    appendLog(
      `<span style="color:var(--color-primary); font-weight:600;">ROUTED:</span> Key "<strong>${key}</strong>" (Hash: ${hashVal}) &rarr; <span style="color:var(--color-accent-teal); font-weight:600;">Shard ${shardIdx}</span>.`
    );
  };

  const handleRouteClick = () => {
    routeKey(inputKey);
    setInputKey(`user_${Math.floor(Math.random() * 8999 + 1000)}`);
  };

  const handleBatch = () => {
    const samples = [
      'tenant_acme',
      'tenant_globex',
      'user_9921',
      'order_4412',
      'user_1204',
      'tenant_initech',
      'user_8830',
      'order_9124',
      'user_3411',
      'tenant_umbrella',
      'order_5521',
      'user_7719'
    ];
    samples.forEach((k) => routeKey(k));
  };

  const handleToggle5th = () => {
    const nextState = !node5Active;
    setNode5Active(nextState);

    if (nextState) {
      appendLog(
        '<span style="color:var(--color-warning); font-weight:600;">REBALANCING:</span> Shard 4 joined cluster! Recalculating consistent hash partitions...'
      );
      let movedCount = 0;
      storedKeys.forEach((k) => {
        const oldIdx = getShardIndex(k, 4);
        const newIdx = getShardIndex(k, 5);
        if (oldIdx !== newIdx) movedCount++;
      });
      appendLog(
        `<span style="color:var(--color-success); font-weight:600;">REBALANCE COMPLETE:</span> Only ${movedCount}/${storedKeys.length} keys migrated. Existing keys remained on their original shards!`
      );
    } else {
      appendLog('Shard 4 decommissioned. Cluster scaled back to 4 shards.');
    }
  };

  const handleReset = () => {
    setStoredKeys([]);
    setNode5Active(false);
    setHighlightIdx(null);
    appendLog('Cluster reset. All shards cleared.');
  };

  const totalShards = node5Active ? 5 : 4;
  const shardBuckets: string[][] = Array.from({ length: totalShards }, () => []);
  storedKeys.forEach((k) => {
    const idx = getShardIndex(k, totalShards);
    shardBuckets[idx].push(k);
  });

  return (
    <div className="sim-box" style={{ margin: '32px 0' }}>
      <div className="sim-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          placeholder="e.g. user_42"
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--rounded-md)',
            border: '1px solid var(--color-hairline)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px'
          }}
        />
        <button className="btn btn-primary btn-sm" onClick={handleRouteClick}>
          Route Key
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleBatch}>
          Batch Populate (12 Keys)
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleToggle5th}>
          {node5Active ? '- Remove Shard 4' : '+ Add Shard 4 (Rebalance)'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleReset} style={{ marginLeft: 'auto' }}>
          Reset
        </button>
      </div>

      <div
        className="servers-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
          gap: '12px',
          margin: '20px 0'
        }}
      >
        {shardBuckets.map((keys, idx) => {
          const isTarget = highlightIdx === idx;
          return (
            <div
              key={idx}
              className={`server-card ${isTarget ? 'active-node' : ''}`}
              style={{
                background: 'var(--color-canvas)',
                border: isTarget ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                borderRadius: 'var(--rounded-lg)',
                padding: '12px',
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Shard {idx}</span>
                <span className="badge" style={{ fontSize: '11px', padding: '2px 6px' }}>
                  {keys.length} keys
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '8px' }}>
                Ring Arc: {Math.floor((idx / totalShards) * 360)}° - {Math.floor(((idx + 1) / totalShards) * 360)}°
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  flex: 1,
                  background: 'var(--color-surface-soft)',
                  padding: '6px',
                  borderRadius: '4px',
                  maxHeight: '110px',
                  overflowY: 'auto'
                }}
              >
                {keys.map((k, kIdx) => (
                  <span
                    key={kIdx}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      background: 'var(--color-surface-card)',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      border: '1px solid var(--color-hairline)'
                    }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sim-log-card" style={{ marginTop: '20px' }}>
        <div className="sim-log-header">
          <span>Consistent Hash Ring Log</span>
          <span style={{ fontSize: '11px', color: 'var(--color-on-dark-soft)' }}>Partition Routing</span>
        </div>
        <div
          className="sim-log-content"
          style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          {logs.map((item) => (
            <div key={item.id}>
              <span style={{ color: 'var(--color-on-dark-soft)', marginRight: '8px' }}>[{item.time}]</span>
              <span dangerouslySetInnerHTML={{ __html: item.html }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
