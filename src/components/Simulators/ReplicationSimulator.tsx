import React, { useState, useRef } from 'react';

interface LogItem {
  id: number;
  time: string;
  html: string;
}

export const ReplicationSimulator: React.FC = () => {
  const [lagMs, setLagMs] = useState<number>(800);
  const [version, setVersion] = useState<number>(100);
  const [userName, setUserName] = useState<string>('Jane Doe');
  const [primaryAlive, setPrimaryAlive] = useState<boolean>(true);
  const [replicaVersion, setReplicaVersion] = useState<number>(100);
  const [replicaUserName, setReplicaUserName] = useState<string>('Jane Doe');
  const [isPromoted, setIsPromoted] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: 1,
      time: new Date().toTimeString().split(' ')[0],
      html: 'Primary & Replicas online. Replication stream established (asynchronous WAL streaming).'
    }
  ]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appendLog = (html: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [{ id: Date.now() + Math.random(), time, html }, ...prev.slice(0, 40)]);
  };

  const handleWriteUser = () => {
    if (!primaryAlive) {
      appendLog(
        '<span style="color:var(--color-error); font-weight:600;">ERROR 500:</span> Cannot write! Primary node is DEAD. Writes blocked.'
      );
      return;
    }

    const nextVer = version + 1;
    const nextName = userName === 'Jane Doe' ? 'Jane Smith' : 'Jane Doe';
    setVersion(nextVer);
    setUserName(nextName);

    appendLog(
      `<span style="color:var(--color-primary); font-weight:600;">WRITE [PRIMARY :5432]:</span> UPDATE users SET name = '${nextName}' (Committed LSN v${nextVer}).`
    );
    appendLog(
      `Replication stream queued. WAL replicating to Replicas (simulated delay: ${lagMs}ms)...`
    );

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setReplicaVersion(nextVer);
      setReplicaUserName(nextName);
      appendLog(
        `<span style="color:var(--color-success); font-weight:600;">REPLICATION SYNC:</span> Replicas 1 & 2 caught up to LSN v${nextVer}.`
      );
    }, lagMs);
  };

  const handleReadReplica = () => {
    const replicaNum = Math.random() > 0.5 ? 1 : 2;
    appendLog(`READ [REPLICA ${replicaNum}]: SELECT name FROM users WHERE id = 42;`);

    if (replicaVersion < version) {
      appendLog(
        `<span style="color:var(--color-error); font-weight:600;">ANOMALY DETECTED (Replication Lag):</span> Read returned name='${replicaUserName}' (v${replicaVersion}). Primary has '${userName}' (v${version})! Client saw stale data.`
      );
    } else {
      appendLog(
        `<span style="color:var(--color-success); font-weight:600;">CONSISTENT READ:</span> Read returned current name='${replicaUserName}' (v${replicaVersion}).`
      );
    }
  };

  const handleKillPrimary = () => {
    if (!primaryAlive) return;
    setPrimaryAlive(false);
    appendLog(
      '<span style="color:var(--color-warning); font-weight:600;">HEARTBEAT TIMEOUT!</span> Primary node :5432 has crashed or severed connection.'
    );
    appendLog(
      '<span style="color:var(--color-warning); font-weight:600;">FAILOVER INITIATED:</span> Electing Replica 1 as new Primary...'
    );

    setTimeout(() => {
      setIsPromoted(true);
      appendLog(
        `<span style="color:var(--color-success); font-weight:600;">FAILOVER COMPLETE:</span> Replica 1 promoted to Primary on :5433 (LSN v${replicaVersion}). Notice: Unreplicated WAL from dead primary was LOST!`
      );
    }, 1200);
  };

  const handleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVersion(100);
    setUserName('Jane Doe');
    setPrimaryAlive(true);
    setReplicaVersion(100);
    setReplicaUserName('Jane Doe');
    setIsPromoted(false);
    appendLog('Simulation reset to initial clean state.');
  };

  return (
    <div className="sim-box" style={{ margin: '32px 0' }}>
      <div className="sim-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={handleWriteUser}>
          1. Write User Update
        </button>
        <button className="btn btn-secondary" onClick={handleReadReplica}>
          2. Read from Replica
        </button>
        <button className="btn btn-secondary" onClick={handleKillPrimary} disabled={!primaryAlive}>
          3. Crash Primary
        </button>
        <button className="btn btn-secondary" onClick={handleReset}>
          Reset
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>Replication Lag:</label>
          <input
            type="range"
            min="0"
            max="3000"
            step="100"
            value={lagMs}
            onChange={(e) => setLagMs(parseInt(e.target.value, 10))}
          />
          <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', minWidth: '60px' }}>{lagMs}ms</span>
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
        {/* Primary DB */}
        <div
          className={`server-card ${!primaryAlive ? 'dead' : ''}`}
          style={{
            background: 'var(--color-canvas)',
            border: primaryAlive ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '16px',
            opacity: primaryAlive ? 1 : 0.6
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600 }}>Primary Node</span>
            <span className={`badge ${primaryAlive ? 'badge-coral' : ''}`} style={!primaryAlive ? { background: 'var(--color-error)', color: '#fff' } : {}}>
              {primaryAlive ? 'ONLINE (RW)' : 'CRASHED'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '8px' }}>
            Port 5432 &bull; WAL Master
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', background: 'var(--color-surface-card)', padding: '6px 8px', borderRadius: '4px' }}>
            <div>Name: "{userName}"</div>
            <div>LSN: v{version}</div>
          </div>
        </div>

        {/* Replica 1 */}
        <div
          className="server-card"
          style={{
            background: 'var(--color-canvas)',
            border: isPromoted ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600 }}>Replica 1</span>
            <span className={`badge ${isPromoted ? 'badge-coral' : 'badge-teal'}`}>
              {isPromoted ? 'PROMOTED PRIMARY (RW)' : 'HEALTHY (RO)'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '8px' }}>
            Port 5433 &bull; Read Replica
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', background: 'var(--color-surface-card)', padding: '6px 8px', borderRadius: '4px' }}>
            <div>Name: "{replicaUserName}"</div>
            <div>LSN: v{replicaVersion}</div>
          </div>
        </div>

        {/* Replica 2 */}
        <div
          className="server-card"
          style={{
            background: 'var(--color-canvas)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600 }}>Replica 2</span>
            <span className="badge badge-teal">HEALTHY (RO)</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '8px' }}>
            Port 5434 &bull; Read Replica
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', background: 'var(--color-surface-card)', padding: '6px 8px', borderRadius: '4px' }}>
            <div>Name: "{replicaUserName}"</div>
            <div>LSN: v{replicaVersion}</div>
          </div>
        </div>
      </div>

      <div className="sim-log-card" style={{ marginTop: '20px' }}>
        <div className="sim-log-header">
          <span>Replication &amp; Replication Lag Event Log</span>
          <span style={{ fontSize: '11px', color: 'var(--color-on-dark-soft)' }}>Live LSN Log</span>
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
