import React, { useState } from 'react';

interface LogEntry {
  id: number;
  time: string;
  msg: string;
  type: 'log-success' | 'log-error' | '';
}

export const ClusterSimulator: React.FC = () => {
  const [isStateless, setIsStateless] = useState(false);
  const [currentNodeIdx, setCurrentNodeIdx] = useState<number | null>(null);
  const [loggedInSessionId, setLoggedInSessionId] = useState<string | null>(null);
  const [serverMemories, setServerMemories] = useState<string[]>(['Empty', 'Empty', 'Empty']);
  const [sharedRedis, setSharedRedis] = useState<string>('No sessions');
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 0,
      time: new Date().toLocaleTimeString(),
      msg: 'Cluster initialized. Click "1. Login User" to begin simulation...',
      type: ''
    }
  ]);
  const [serverPointer, setServerPointer] = useState<number>(0);

  const addLog = (msg: string, type: 'log-success' | 'log-error' | '' = '') => {
    const entry: LogEntry = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      msg,
      type
    };
    setLogs((prev) => [entry, ...prev.slice(0, 30)]);
  };

  const handleToggleStateless = (val: boolean) => {
    setIsStateless(val);
    if (val) {
      setServerMemories(['Stateless (Clean)', 'Stateless (Clean)', 'Stateless (Clean)']);
      setSharedRedis(loggedInSessionId ? `Session ID: ${loggedInSessionId} (User: #42)` : 'No sessions');
      addLog('Switched mode to: STATELESS (Central Redis)');
    } else {
      setServerMemories(['Empty', 'Empty', 'Empty']);
      setSharedRedis('No sessions');
      addLog('Switched mode to: STATEFUL (Local RAM)');
    }
  };

  const handleLogin = () => {
    const targetNode = serverPointer;
    setServerPointer((prev) => (prev + 1) % 3);
    setCurrentNodeIdx(targetNode);

    const newSid = 'sess_' + Math.floor(Math.random() * 9000 + 1000);
    setLoggedInSessionId(newSid);

    if (isStateless) {
      setSharedRedis(`Session ID: ${newSid} (User: #42)`);
      addLog(
        `POST /login -> Load Balancer routed to Node ${targetNode + 1}. Session stored in CENTRAL REDIS.`,
        'log-success'
      );
    } else {
      setServerMemories((prev) => {
        const next = [...prev];
        next[targetNode] = `Session: ${newSid}`;
        return next;
      });
      addLog(
        `POST /login -> Load Balancer routed to Node ${targetNode + 1}. Session stored in Node ${
          targetNode + 1
        } LOCAL RAM only!`,
        'log-success'
      );
    }
  };

  const handleFetch = () => {
    if (!loggedInSessionId) {
      addLog('Error: Please click "1. Login User" first!', 'log-error');
      return;
    }

    const targetNode = serverPointer;
    setServerPointer((prev) => (prev + 1) % 3);
    setCurrentNodeIdx(targetNode);

    if (isStateless) {
      addLog(
        `GET /profile -> Routed to Node ${targetNode + 1}. Node ${
          targetNode + 1
        } queried Redis -> Found session ${loggedInSessionId}! (200 OK)`,
        'log-success'
      );
    } else {
      const hasSession = serverMemories[targetNode].includes(loggedInSessionId);
      if (hasSession) {
        addLog(
          `GET /profile -> Routed to Node ${targetNode + 1}. Lucky hit: Node ${
            targetNode + 1
          } holds session in RAM! (200 OK)`,
          'log-success'
        );
      } else {
        addLog(
          `GET /profile -> Routed to Node ${targetNode + 1}. BUG: Node ${
            targetNode + 1
          } RAM has no record of this session! (401 Unauthorized - Logged Out!)`,
          'log-error'
        );
      }
    }
  };

  return (
    <div className="sim-box" style={{ margin: '32px 0' }}>
      <div className="sim-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={handleLogin}>
          1. Login User
        </button>
        <button className="btn btn-secondary" onClick={handleFetch}>
          2. Fetch Profile
        </button>

        <label
          className="sim-mode-toggle"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginLeft: 'auto' }}
        >
          <input
            type="checkbox"
            checked={isStateless}
            onChange={(e) => handleToggleStateless(e.target.checked)}
          />
          <span>
            <strong>Enable Stateless Architecture (Central Redis)</strong>
          </span>
        </label>
      </div>

      <div className="servers-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '20px 0' }}>
        {[0, 1, 2].map((idx) => {
          const isActive = currentNodeIdx === idx;
          return (
            <div
              key={idx}
              className={`server-card ${isActive ? 'active-node' : ''}`}
              style={{
                background: isActive ? 'var(--color-surface-soft)' : 'var(--color-canvas)',
                border: isActive ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                borderRadius: 'var(--rounded-lg)',
                padding: '16px',
                transition: 'all 0.2s ease'
              }}
            >
              <div className="server-title" style={{ fontWeight: 600, fontSize: '15px' }}>
                Replica Node {idx + 1}
              </div>
              <div className="server-status" style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '4px 0 8px' }}>
                Port 300{idx + 1} &bull; Active
              </div>
              <div
                className="server-memory"
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--color-surface-card)',
                  padding: '6px 8px',
                  borderRadius: 'var(--rounded-xs)',
                  color: isStateless ? '#206d33' : 'var(--color-ink)'
                }}
              >
                Local RAM: {serverMemories[idx]}
              </div>
            </div>
          );
        })}
      </div>

      {isStateless && (
        <div
          className="central-redis-card"
          style={{
            margin: '16px 0',
            padding: '16px 20px',
            background: 'var(--color-surface-cream-strong)',
            borderRadius: 'var(--rounded-lg)',
            border: '1px solid var(--color-hairline)',
            fontSize: '14px'
          }}
        >
          <strong>Centralized Shared Store (Redis Cluster):</strong>{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>{sharedRedis}</span>
        </div>
      )}

      <div className="sim-log-card" style={{ marginTop: '20px' }}>
        <div className="sim-log-header">
          <span>Cluster Event Log</span>
          <span style={{ fontSize: '11px', color: 'var(--color-on-dark-soft)' }}>Live Stream</span>
        </div>
        <div
          className="sim-log-content"
          style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          {logs.map((item) => (
            <div key={item.id} className={item.type}>
              <span style={{ color: 'var(--color-on-dark-soft)', marginRight: '8px' }}>[{item.time}]</span>
              {item.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
