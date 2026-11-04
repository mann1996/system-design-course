import React, { useState } from 'react';

type PresenceMode = 'naive_broadcast' | 'viewport_pull';

interface ClientUser {
  id: string;
  name: string;
  avatar: string;
  podId: number;
  status: 'online' | 'idle' | 'offline';
  lastHeartbeatSecAgo: number;
}

interface MessageTrace {
  id: string;
  from: string;
  to: string;
  route: string;
  timestamp: string;
  fanoutCount: number;
}

export const PresenceMeshSimulator: React.FC = () => {
  const [presenceMode, setPresenceMode] = useState<PresenceMode>('viewport_pull');
  const [users, setUsers] = useState<ClientUser[]>([
    { id: 'u_alice', name: 'Alice', avatar: '👩‍💻', podId: 1, status: 'online', lastHeartbeatSecAgo: 4 },
    { id: 'u_bob', name: 'Bob', avatar: '👨‍💼', podId: 2, status: 'online', lastHeartbeatSecAgo: 12 },
    { id: 'u_charlie', name: 'Charlie', avatar: '🧑‍🚀', podId: 3, status: 'online', lastHeartbeatSecAgo: 8 },
    { id: 'u_dave', name: 'Dave', avatar: '🧙‍♂️', podId: 3, status: 'online', lastHeartbeatSecAgo: 45 }, // approaching zombie
  ]);

  const [traces, setTraces] = useState<MessageTrace[]>([
    {
      id: 'trace_init',
      from: 'SYSTEM',
      to: 'ALL_PODS',
      route: 'Redis Cluster Pub/Sub channel subscriptions initialized on 3 gateway pods',
      timestamp: '00:00:01',
      fanoutCount: 3,
    },
  ]);

  const [redisStats, setRedisStats] = useState({
    pubsubMsgsPerSec: 140,
    presenceZSetMemoryKb: 28,
    zombiesPruned: 0,
    fanoutAmplification: 1,
  });

  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  const addTrace = (from: string, to: string, route: string, fanout: number) => {
    const trace: MessageTrace = {
      id: `trace_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      from,
      to,
      route,
      timestamp: new Date().toLocaleTimeString(),
      fanoutCount: fanout,
    };
    setTraces((prev) => [trace, ...prev.slice(0, 10)]);
  };

  // Direct Message Routing (Alice on Pod 1 -> Bob on Pod 2)
  const handleDirectMessage = () => {
    setActiveHighlight('dm_flow');
    addTrace(
      'Alice (Pod 1)',
      'Bob (Pod 2)',
      'Pod 1 publishes to Redis channel "user:u_bob" -> Redis routes across cluster -> Pod 2 receives message -> pushes to Bob\'s WebSocket',
      1
    );
    setRedisStats((prev) => ({
      ...prev,
      pubsubMsgsPerSec: prev.pubsubMsgsPerSec + 1,
    }));
    setTimeout(() => setActiveHighlight(null), 1500);
  };

  // Room Broadcast (#general across 3 pods)
  const handleRoomBroadcast = () => {
    setActiveHighlight('room_flow');
    const fanout = presenceMode === 'naive_broadcast' ? 500 : 4;
    addTrace(
      'Charlie (Pod 3)',
      '#general Channel',
      `Pod 3 publishes 1 message to Redis "room:general". Redis delivers to Pod 1, 2, 3. Each Pod performs local socket fan-out (${fanout} recipients).`,
      fanout
    );
    setRedisStats((prev) => ({
      ...prev,
      pubsubMsgsPerSec: prev.pubsubMsgsPerSec + (presenceMode === 'naive_broadcast' ? 500 : 3),
      fanoutAmplification: presenceMode === 'naive_broadcast' ? 500 : 4,
    }));
    setTimeout(() => setActiveHighlight(null), 1500);
  };

  // Heartbeat PING
  const handleHeartbeat = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return { ...u, status: 'online', lastHeartbeatSecAgo: 0 };
        }
        return u;
      })
    );
    addTrace(
      userId,
      'Redis ZSet',
      `Heartbeat PING received: executed ZADD presence:online ${Date.now()} ${userId} (TTL score refreshed)`,
      1
    );
  };

  // Zombie Pruning Sweep
  const handlePruneZombies = () => {
    let prunedCount = 0;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.lastHeartbeatSecAgo >= 35) {
          prunedCount++;
          return { ...u, status: 'offline', lastHeartbeatSecAgo: 99 };
        }
        return u;
      })
    );

    addTrace(
      'Presence Worker',
      'Redis ZSet',
      `Sweeper ran: ZREMRANGEBYSCORE presence:online 0 ${Date.now() - 30000} (pruned ${prunedCount} zombie connection without TCP FIN)`,
      prunedCount
    );

    setRedisStats((prev) => ({
      ...prev,
      zombiesPruned: prev.zombiesPruned + prunedCount,
    }));
  };

  // User Connects: Compare Naive Broadcast Storm vs Viewport Fetch
  const handleUserConnect = (userName: string) => {
    if (presenceMode === 'naive_broadcast') {
      addTrace(
        userName,
        'ALL GUILD MEMBERS',
        `⚠️ PRESENCE STORM: ${userName} connected! Naive system broadcasted ONLINE event to 5,000 friends/guild members! (5,000 pub/sub messages generated)`,
        5000
      );
      setRedisStats((prev) => ({
        ...prev,
        pubsubMsgsPerSec: prev.pubsubMsgsPerSec + 5000,
      }));
    } else {
      addTrace(
        userName,
        'Redis Sorted Set',
        `✓ MODERN DISCORD PATTERN: ${userName} connected. Quietly executed ZADD presence:online. Zero presence events broadcasted. Friends fetch on-demand when user scrolls into active viewport!`,
        1
      );
      setRedisStats((prev) => ({
        ...prev,
        pubsubMsgsPerSec: prev.pubsubMsgsPerSec + 1,
      }));
    }
  };

  return (
    <div className="card card-cream" style={{ padding: '24px', margin: '32px 0', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Interactive Architecture Simulator</span>
          <h3 style={{ margin: '4px 0 8px' }}>Distributed WebSocket Mesh &amp; Real-Time Presence Engine</h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-ink-muted)' }}>
            Examine how cross-node message routing operates over Redis Pub/Sub, track ephemeral user presence using Redis Sorted Sets, and contrast naive broadcast storms with viewport-based presence.
          </p>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => {
              setUsers([
                { id: 'u_alice', name: 'Alice', avatar: '👩‍💻', podId: 1, status: 'online', lastHeartbeatSecAgo: 4 },
                { id: 'u_bob', name: 'Bob', avatar: '👨‍💼', podId: 2, status: 'online', lastHeartbeatSecAgo: 12 },
                { id: 'u_charlie', name: 'Charlie', avatar: '🧑‍🚀', podId: 3, status: 'online', lastHeartbeatSecAgo: 8 },
                { id: 'u_dave', name: 'Dave', avatar: '🧙‍♂️', podId: 3, status: 'online', lastHeartbeatSecAgo: 45 },
              ]);
              setTraces([{ id: 'init', from: 'SYSTEM', to: 'ALL', route: 'Reset simulator state.', timestamp: 'Now', fanoutCount: 1 }]);
              setRedisStats({ pubsubMsgsPerSec: 140, presenceZSetMemoryKb: 28, zombiesPruned: 0, fanoutAmplification: 1 });
            }}
          >
            ↺ Reset Cluster
          </button>
        </div>
      </div>

      {/* Mode Selector Banner */}
      <div style={{ background: '#faf9f5', border: '1px solid var(--color-hairline)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Presence Architecture Paradigm:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${presenceMode === 'viewport_pull' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', padding: '6px 14px' }}
                onClick={() => setPresenceMode('viewport_pull')}
              >
                ✓ Viewport Pull &amp; Coarse Presence (Discord Architecture)
              </button>
              <button
                type="button"
                className={`btn ${presenceMode === 'naive_broadcast' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', padding: '6px 14px' }}
                onClick={() => setPresenceMode('naive_broadcast')}
              >
                ⚠️ Naive Full-Mesh Push (Broadcast Storm Trap)
              </button>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', maxWidth: '420px' }}>
            {presenceMode === 'viewport_pull' ? (
              <span style={{ color: '#2e7d32' }}>
                <strong>Scales to 10M+ users:</strong> Status writes to Redis Sorted Set quietly. Only clients with the user visible in their viewport query presence. Egress is capped!
              </span>
            ) : (
              <span style={{ color: '#c62828' }}>
                <strong>Collapses under scale:</strong> Every login, logout, or idle transition broadcasts to all friends. O(N × M) message storm overwhelms Redis Pub/Sub.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cluster Topology Visual Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Gateway Pod 1 */}
        <div
          style={{
            background: activeHighlight === 'dm_flow' ? '#fff8e1' : '#fff',
            border: `2px solid ${activeHighlight === 'dm_flow' ? '#ffa000' : 'var(--color-hairline)'}`,
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="badge badge-teal">Gateway Pod 1</span>
            <span style={{ fontSize: '11px', color: '#666' }}>IP: 10.0.1.14</span>
          </div>
          <p style={{ fontSize: '12px', color: '#888', margin: '0 0 10px' }}>
            Subscriptions: <code>user:u_alice</code>, <code>room:general</code>
          </p>
          <div style={{ background: '#faf9f5', border: '1px solid #eee', borderRadius: '8px', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '18px', marginRight: '6px' }}>👩‍💻</span>
                <strong style={{ fontSize: '13px' }}>Alice</strong>
                <span style={{ fontSize: '10px', color: '#4caf50', marginLeft: '6px', fontWeight: 600 }}>● ONLINE</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '10px', padding: '3px 8px' }}
                onClick={() => handleHeartbeat('u_alice')}
              >
                Ping (4s ago)
              </button>
            </div>
            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '11px', padding: '6px' }}
                onClick={handleDirectMessage}
              >
                Send DM to Bob (Pod 2) ➜
              </button>
            </div>
          </div>
        </div>

        {/* Gateway Pod 2 */}
        <div
          style={{
            background: activeHighlight === 'dm_flow' ? '#fff8e1' : '#fff',
            border: `2px solid ${activeHighlight === 'dm_flow' ? '#ffa000' : 'var(--color-hairline)'}`,
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="badge badge-teal">Gateway Pod 2</span>
            <span style={{ fontSize: '11px', color: '#666' }}>IP: 10.0.1.28</span>
          </div>
          <p style={{ fontSize: '12px', color: '#888', margin: '0 0 10px' }}>
            Subscriptions: <code>user:u_bob</code>, <code>room:general</code>
          </p>
          <div style={{ background: '#faf9f5', border: '1px solid #eee', borderRadius: '8px', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '18px', marginRight: '6px' }}>👨‍💼</span>
                <strong style={{ fontSize: '13px' }}>Bob</strong>
                <span style={{ fontSize: '10px', color: '#4caf50', marginLeft: '6px', fontWeight: 600 }}>● ONLINE</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '10px', padding: '3px 8px' }}
                onClick={() => handleHeartbeat('u_bob')}
              >
                Ping (12s ago)
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '10px' }}>
              Receives messages via Redis topic <code>user:u_bob</code>
            </div>
          </div>
        </div>

        {/* Gateway Pod 3 */}
        <div
          style={{
            background: activeHighlight === 'room_flow' ? '#e8f5e9' : '#fff',
            border: `2px solid ${activeHighlight === 'room_flow' ? '#4caf50' : 'var(--color-hairline)'}`,
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="badge badge-teal">Gateway Pod 3</span>
            <span style={{ fontSize: '11px', color: '#666' }}>IP: 10.0.1.42</span>
          </div>
          <p style={{ fontSize: '12px', color: '#888', margin: '0 0 10px' }}>
            Subscriptions: <code>user:u_charlie</code>, <code>user:u_dave</code>, <code>room:general</code>
          </p>
          <div style={{ background: '#faf9f5', border: '1px solid #eee', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '18px', marginRight: '6px' }}>🧑‍🚀</span>
                <strong style={{ fontSize: '13px' }}>Charlie</strong>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '10px', padding: '4px 8px' }}
                onClick={handleRoomBroadcast}
              >
                Broadcast to #general
              </button>
            </div>
          </div>

          <div style={{ background: users.find(u => u.id === 'u_dave')?.status === 'offline' ? '#ffebee' : '#fff8e1', border: '1px solid #eee', borderRadius: '8px', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '18px', marginRight: '6px' }}>🧙‍♂️</span>
                <strong style={{ fontSize: '13px' }}>Dave</strong>
                <span style={{ fontSize: '10px', color: users.find(u => u.id === 'u_dave')?.status === 'offline' ? '#c62828' : '#e65100', marginLeft: '6px', fontWeight: 600 }}>
                  {users.find(u => u.id === 'u_dave')?.status === 'offline' ? '● OFFLINE (PRUNED)' : '● ZOMBIE? (45s no ping)'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '10px', padding: '3px 8px' }}
                onClick={handlePruneZombies}
              >
                Sweep Zombies
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Central Redis Mesh Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>REDIS PUB/SUB THROUGHPUT</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: redisStats.pubsubMsgsPerSec > 2000 ? '#ef5350' : '#4caf50', margin: '4px 0' }}>
            {redisStats.pubsubMsgsPerSec.toLocaleString()} msgs/sec
          </div>
          <div style={{ fontSize: '11px', color: '#bbb' }}>
            {presenceMode === 'naive_broadcast' ? '⚠️ High load: Presence broadcasts active' : '✓ Normal load: Quiet presence state'}
          </div>
        </div>

        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>PRESENCE STORAGE (ZSET)</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#80d8ff', margin: '4px 0' }}>
            Sorted Set (ZADD)
          </div>
          <div style={{ fontSize: '11px', color: '#bbb' }}>
            Score = Timestamp; Member = UserID (O(log N) inserts &amp; sweeps)
          </div>
        </div>

        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>ZOMBIES PRUNED</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffd54f', margin: '4px 0' }}>
            {redisStats.zombiesPruned} Connections
          </div>
          <div style={{ fontSize: '11px', color: '#bbb' }}>
            Purged via ZREMRANGEBYSCORE after 30s timeout
          </div>
        </div>

        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>SIMULATE USER LOGIN</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '11px', padding: '5px', marginTop: '6px' }}
            onClick={() => handleUserConnect('VIP_User_Emma')}
          >
            Connect VIP User Emma
          </button>
        </div>
      </div>

      {/* Real-time Message Trace Log */}
      <div style={{ background: '#181715', color: '#a5d6a7', borderRadius: '10px', padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        <div style={{ color: '#888', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span>DISTRIBUTED MESSAGE BUS &amp; PRESENCE EVENT TRACE</span>
          <span style={{ color: '#aaa' }}>LATEST 10 EVENTS</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
          {traces.map((trace) => (
            <div key={trace.id} style={{ display: 'flex', gap: '8px', lineHeight: '1.4' }}>
              <span style={{ color: '#64b5f6', minWidth: '65px' }}>[{trace.timestamp}]</span>
              <span style={{ color: '#ffd54f', minWidth: '130px' }}>{trace.from} ➜ {trace.to}:</span>
              <span style={{ color: trace.fanoutCount > 100 ? '#ff8a80' : '#e0e0e0' }}>{trace.route}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};