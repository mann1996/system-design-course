import React, { useState } from 'react';

export const CacheSimulator: React.FC = () => {
  const [strategy, setStrategy] = useState<'aside' | 'through'>('aside');
  const [cacheValue, setCacheValue] = useState<string | null>(null);
  const [dbValue, setDbValue] = useState<string>('v1 ("Alice")');
  const [versionCounter, setVersionCounter] = useState(1);
  const [activeNode, setActiveNode] = useState<'app' | 'cache' | 'db' | null>(null);
  const [appStatus, setAppStatus] = useState('Idle');
  const [cacheStatus, setCacheStatus] = useState('Key user:42 = Empty');
  const [dbStatus, setDbStatus] = useState('Record 42 = v1 ("Alice")');
  const [logHtml, setLogHtml] = useState<string>(
    'State ready. Cache is cold (empty). DB holds initial v1 record.'
  );

  const handleSetStrategy = (strat: 'aside' | 'through') => {
    setStrategy(strat);
    setLogHtml(
      `Switched strategy to <strong>${
        strat === 'aside' ? 'Cache-Aside (Lazy Loading)' : 'Write-Through'
      }</strong>.`
    );
  };

  const handleReset = () => {
    setCacheValue(null);
    setDbValue('v1 ("Alice")');
    setVersionCounter(1);
    setActiveNode(null);
    setAppStatus('Idle');
    setCacheStatus('Key user:42 = Empty');
    setDbStatus('Record 42 = v1 ("Alice")');
    setLogHtml('State reset. Cache is cold (empty). DB holds initial v1 record.');
  };

  const handleRead = () => {
    if (cacheValue !== null) {
      // Hit
      setActiveNode('cache');
      setAppStatus('Serving from Redis');
      setCacheStatus(`Key user:42 = ${cacheValue}`);
      setDbStatus(`Record 42 = ${dbValue}`);
      setLogHtml(
        `[READ] Request: GET /user/42<br>&rarr; Checking Redis... <span class="hit" style="color: var(--color-success); font-weight:600;">CACHE HIT! (0.4ms)</span><br>&rarr; Returned "${cacheValue}" directly to client. DB was never touched.`
      );
    } else {
      // Miss
      setActiveNode('db');
      setCacheValue(dbValue);
      setAppStatus('Loaded from DB & cached');
      setCacheStatus(`Key user:42 = ${dbValue}`);
      setDbStatus(`Record 42 = ${dbValue}`);
      setLogHtml(
        `[READ] Request: GET /user/42<br>&rarr; Checking Redis... <span class="miss" style="color: var(--color-error); font-weight:600;">CACHE MISS (Key user:42 empty)</span><br>&rarr; Querying PostgreSQL DB (15ms)... found "${dbValue}".<br>&rarr; Writing "${dbValue}" into Redis with TTL.<br>&rarr; Returned data to client.`
      );
    }
  };

  const handleWrite = () => {
    const nextVer = versionCounter + 1;
    setVersionCounter(nextVer);
    const newName = `v${nextVer} ("Alice updated ${nextVer}")`;
    setDbValue(newName);

    if (strategy === 'aside') {
      // Cache aside: write to DB, evict cache key
      setCacheValue(null);
      setActiveNode('db');
      setAppStatus('Updated DB & Evicted Cache');
      setCacheStatus('Key user:42 = EVICTED (Empty)');
      setDbStatus(`Record 42 = ${newName}`);
      setLogHtml(
        `[WRITE - Cache-Aside] Request: PUT /user/42<br>&rarr; <span style="color: var(--color-primary); font-weight:600;">Updated DB Record 42 to "${newName}"</span>.<br>&rarr; <span style="color: var(--color-error); font-weight:600;">EVICTED (Deleted) key user:42 from Redis</span>.<br>&rarr; Next read will safely pull latest data from DB without race hazards.`
      );
    } else {
      // Write through: write to cache and synchronously to DB
      setCacheValue(newName);
      setActiveNode('cache');
      setAppStatus('Updated Cache & DB synchronously');
      setCacheStatus(`Key user:42 = ${newName}`);
      setDbStatus(`Record 42 = ${newName}`);
      setLogHtml(
        `[WRITE - Write-Through] Request: PUT /user/42<br>&rarr; App writes to Redis.<br>&rarr; Redis synchronously persists to DB: "${newName}".<br>&rarr; Both Cache and DB are updated before request returns.`
      );
    }
  };

  return (
    <div className="sim-box" style={{ margin: '32px 0' }}>
      <div className="sim-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn btn-sm ${strategy === 'aside' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSetStrategy('aside')}
          >
            Strategy: Cache-Aside
          </button>
          <button
            className={`btn btn-sm ${strategy === 'through' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSetStrategy('through')}
          >
            Strategy: Write-Through
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <button className="btn btn-primary btn-sm" onClick={handleRead}>
            Read (GET /user/42)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleWrite}>
            Write (PUT /user/42)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      <div
        className="servers-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          margin: '20px 0'
        }}
      >
        <div
          className={`server-card ${activeNode === 'app' ? 'active-node' : ''}`}
          style={{
            background: 'var(--color-canvas)',
            border: activeNode === 'app' ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '16px'
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px' }}>App Server (Node.js)</div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '4px 0 8px' }}>
            Port 3000 &bull; Express API
          </div>
          <div
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--color-surface-card)',
              padding: '6px 8px',
              borderRadius: 'var(--rounded-xs)'
            }}
          >
            {appStatus}
          </div>
        </div>

        <div
          className={`server-card ${activeNode === 'cache' ? 'active-node' : ''}`}
          style={{
            background: 'var(--color-canvas)',
            border: activeNode === 'cache' ? '2px solid var(--color-accent-teal)' : '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '16px'
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Redis Cache</span>
            <span style={{ fontSize: '12px', color: 'var(--color-accent-teal)', fontFamily: 'var(--font-mono)' }}>0.4ms</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '4px 0 8px' }}>
            Port 6379 &bull; In-Memory
          </div>
          <div
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--color-surface-card)',
              padding: '6px 8px',
              borderRadius: 'var(--rounded-xs)',
              color: cacheValue ? 'var(--color-accent-teal)' : 'var(--color-muted)'
            }}
          >
            {cacheStatus}
          </div>
        </div>

        <div
          className={`server-card ${activeNode === 'db' ? 'active-node' : ''}`}
          style={{
            background: 'var(--color-canvas)',
            border: activeNode === 'db' ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '16px'
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', justifyContent: 'space-between' }}>
            <span>PostgreSQL DB</span>
            <span style={{ fontSize: '12px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>15ms</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '4px 0 8px' }}>
            Port 5432 &bull; Persistent Disk
          </div>
          <div
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--color-surface-card)',
              padding: '6px 8px',
              borderRadius: 'var(--rounded-xs)'
            }}
          >
            {dbStatus}
          </div>
        </div>
      </div>

      <div className="sim-log-card" style={{ marginTop: '20px' }}>
        <div className="sim-log-header">
          <span>Cache Flow &amp; State Transition</span>
          <span style={{ fontSize: '11px', color: 'var(--color-on-dark-soft)' }}>Architecture Trace</span>
        </div>
        <div
          className="sim-log-content"
          style={{ padding: '16px', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: logHtml }}
        />
      </div>
    </div>
  );
};
