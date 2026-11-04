import React, { useState, useMemo } from 'react';

type Protocol = 'websocket' | 'sse' | 'long_polling';
type DrainStrategy = 'gradual_jitter' | 'abrupt_disconnect';

interface GatewayNode {
  id: number;
  name: string;
  connections: number;
  cpuPercent: number;
  memoryMb: number;
  status: 'healthy' | 'draining' | 'exhausted' | 'restarting';
}

export const WebSocketGatewaySimulator: React.FC = () => {
  const [totalConnections, setTotalConnections] = useState<number>(300000);
  const [protocol, setProtocol] = useState<Protocol>('websocket');
  const [nodeCount, setNodeCount] = useState<number>(6);
  const [socketBufferKb, setSocketBufferKb] = useState<number>(16); // wmem + rmem in KB
  const [v8HeapPerSocketKb, setV8HeapPerSocketKb] = useState<number>(6); // V8 runtime object overhead
  const [nofileLimit, setNofileLimit] = useState<'default_1024' | 'tuned_1m'>('tuned_1m');
  const [drainStrategy, setDrainStrategy] = useState<DrainStrategy>('gradual_jitter');
  const [isDraining, setIsDraining] = useState<boolean>(false);
  const [drainProgress, setDrainProgress] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([
    'Gateway cluster initialized with 6 nodes (4 vCPU, 8 GB RAM each).',
    'Kernel sysctl net.ipv4.tcp_rmem and tcp_wmem configured.',
    'Listening on port 443 (TLS termination at Layer 4 NLB).'
  ]);

  // Sizing calculations per node
  const connsPerNode = Math.round(totalConnections / nodeCount);
  
  // Protocol multiplier for socket memory & file descriptors
  const protocolMultiplier = useMemo(() => {
    switch (protocol) {
      case 'websocket':
        return { kernelMemFactor: 1.0, v8Factor: 1.0, fdFactor: 1.0, headerOverhead: 'Minimal (2-14 byte frames)' };
      case 'sse':
        // SSE runs over HTTP/2 where up to 100 streams share 1 TCP socket
        return { kernelMemFactor: 0.25, v8Factor: 0.6, fdFactor: 0.25, headerOverhead: 'Low (chunked HTTP/2 streaming)' };
      case 'long_polling':
        // Long-polling re-establishes TCP/TLS frequently; high header overhead (500-1000 bytes per poll)
        return { kernelMemFactor: 1.4, v8Factor: 1.8, fdFactor: 1.2, headerOverhead: 'Severe (500-1000B HTTP headers/poll)' };
    }
  }, [protocol]);

  const kernelMemPerNodeMb = Math.round(
    (connsPerNode * socketBufferKb * protocolMultiplier.kernelMemFactor) / 1024
  );
  const v8MemPerNodeMb = Math.round(
    (connsPerNode * v8HeapPerSocketKb * protocolMultiplier.v8Factor) / 1024
  );
  const baselineMemMb = 1024; // 1 GB runtime & OS baseline
  const totalMemPerNodeMb = kernelMemPerNodeMb + v8MemPerNodeMb + baselineMemMb;
  const memoryPerNodeGb = (totalMemPerNodeMb / 1024).toFixed(2);
  const memoryLimitGb = 8.0;
  const memoryUtilizationPercent = Math.min(100, Math.round((totalMemPerNodeMb / (memoryLimitGb * 1024)) * 100));

  const fdsRequired = Math.round(connsPerNode * protocolMultiplier.fdFactor) + 250;
  const fdLimitNumber = nofileLimit === 'default_1024' ? 1024 : 1048576;
  const isFdExhausted = fdsRequired > fdLimitNumber;
  const isOOM = totalMemPerNodeMb > memoryLimitGb * 1024;

  // Build node states
  const nodes: GatewayNode[] = useMemo(() => {
    return Array.from({ length: nodeCount }, (_, i) => {
      const id = i + 1;
      let status: GatewayNode['status'] = 'healthy';
      let nodeConns = connsPerNode;
      let cpu = Math.min(95, Math.round(25 + (connsPerNode / 100000) * 35));

      if (isFdExhausted) {
        status = 'exhausted';
        cpu = 100;
      } else if (isOOM) {
        status = 'exhausted';
        cpu = 100;
      } else if (isDraining && id === 1) {
        if (drainStrategy === 'abrupt_disconnect') {
          status = 'restarting';
          nodeConns = 0;
          cpu = 100;
        } else {
          status = 'draining';
          nodeConns = Math.round(connsPerNode * (1 - drainProgress / 100));
          cpu = Math.round(45 + (drainProgress / 100) * 15);
        }
      }

      return {
        id,
        name: `gateway-pod-${id}`,
        connections: nodeConns,
        cpuPercent: cpu,
        memoryMb: totalMemPerNodeMb,
        status,
      };
    });
  }, [nodeCount, connsPerNode, totalMemPerNodeMb, isFdExhausted, isOOM, isDraining, drainStrategy, drainProgress]);

  const addLog = (msg: string) => {
    setLogs((prev) => [msg, ...prev.slice(0, 15)]);
  };

  const handleSimulateDrain = () => {
    if (isDraining) return;
    setIsDraining(true);
    setDrainProgress(0);

    if (drainStrategy === 'abrupt_disconnect') {
      addLog('🔴 CRITICAL: gateway-pod-1 killed abruptly without connection draining (SIGKILL)!');
      addLog(`⚠️ THUNDERING HERD: ${connsPerNode.toLocaleString()} client sockets severed simultaneously!`);
      addLog('⚡ 100,000+ clients immediately initiate synchronized TLS handshakes against surviving pods.');
      addLog('🔥 Surviving nodes experience 100% CPU lockup from TLS handshake cryptography!');
      setTimeout(() => {
        setIsDraining(false);
      }, 4000);
    } else {
      addLog('🟢 GRACEFUL DRAIN INITIATED on gateway-pod-1 (SIGTERM received).');
      addLog('🔒 Gateway removed from L4 NLB target group; new incoming TCP connections stopped.');
      addLog('⏱️ Rate-limited Close Frames (code 1001 Going Away) sent at 500 sockets/sec with client jitter.');
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 25;
        setDrainProgress(progress);
        if (progress === 50) {
          addLog(`📡 50% sockets drained (${Math.round(connsPerNode * 0.5).toLocaleString()} clients reconnected seamlessly with jitter).`);
        }
        if (progress >= 100) {
          clearInterval(interval);
          addLog('✅ All active connections cleanly drained. gateway-pod-1 shut down with zero dropped messages.');
          setTimeout(() => {
            setIsDraining(false);
            setDrainProgress(0);
          }, 1500);
        }
      }, 700);
    }
  };

  return (
    <div className="card card-cream" style={{ padding: '24px', margin: '32px 0', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Interactive Architecture Simulator</span>
          <h3 style={{ margin: '4px 0 8px' }}>WebSocket Gateway: Connection Scaling, Kernel Memory &amp; Draining</h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-ink-muted)' }}>
            Model kernel socket buffers (rmem/wmem), V8 heap memory per connection, Linux file descriptor limits, and simulate rolling deployment draining vs thundering reconnect storms.
          </p>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => {
              setTotalConnections(300000);
              setNodeCount(6);
              setSocketBufferKb(16);
              setV8HeapPerSocketKb(6);
              setNofileLimit('tuned_1m');
              setIsDraining(false);
              setLogs(['Simulator reset to baseline.']);
            }}
          >
            ↺ Reset Simulator
          </button>
        </div>
      </div>

      {/* Control Sliders Grid */}
      <div style={{ background: '#faf9f5', border: '1px solid var(--color-hairline)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 14px', fontSize: '15px' }}>1. Cluster Scale &amp; Protocol Parameters</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Total Active Connections</label>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {totalConnections.toLocaleString()} sockets
              </span>
            </div>
            <input
              type="range"
              min={50000}
              max={1500000}
              step={50000}
              value={totalConnections}
              onChange={(e) => setTotalConnections(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
              ({connsPerNode.toLocaleString()} sockets / node)
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Gateway Node Count</label>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {nodeCount} nodes (4 vCPU / 8GB)
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={nodeCount}
              onChange={(e) => setNodeCount(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Real-Time Protocol
            </label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as Protocol)}
              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-hairline)' }}
            >
              <option value="websocket">WebSocket (Bidirectional TCP)</option>
              <option value="sse">Server-Sent Events (SSE / HTTP/2 Push)</option>
              <option value="long_polling">HTTP Long-Polling (Polling Overheads)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Linux File Descriptor Limit (nofile)
            </label>
            <select
              value={nofileLimit}
              onChange={(e) => setNofileLimit(e.target.value as 'default_1024' | 'tuned_1m')}
              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-hairline)' }}
            >
              <option value="tuned_1m">Tuned: ulimit -n 1,048,576 (Production)</option>
              <option value="default_1024">Default Linux: ulimit -n 1,024 (Danger!)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>TCP Buffer (rmem + wmem)</label>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{socketBufferKb} KB / socket</span>
            </div>
            <input
              type="range"
              min={4}
              max={64}
              step={4}
              value={socketBufferKb}
              onChange={(e) => setSocketBufferKb(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
              Kernel memory allocated per TCP connection socket
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Node.js / V8 Heap Overhead</label>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{v8HeapPerSocketKb} KB / socket</span>
            </div>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={v8HeapPerSocketKb}
              onChange={(e) => setV8HeapPerSocketKb(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
              JavaScript object, event listeners &amp; session metadata in heap
            </div>
          </div>
        </div>
      </div>

      {/* Sizing Telemetry Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>PER-NODE RAM CONSUMPTION</span>
          <div style={{ fontSize: '22px', fontWeight: 700, color: isOOM ? '#ef5350' : '#4caf50', margin: '4px 0' }}>
            {memoryPerNodeGb} GB / 8.0 GB
          </div>
          <div style={{ fontSize: '11px', color: '#bbb' }}>
            Kernel: {kernelMemPerNodeMb} MB | V8 Heap: {v8MemPerNodeMb} MB | Base: 1 GB
          </div>
          <div style={{ width: '100%', background: '#333', height: '6px', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${memoryUtilizationPercent}%`, background: isOOM ? '#ef5350' : '#4caf50', height: '100%' }} />
          </div>
        </div>

        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>FILE DESCRIPTORS PER NODE</span>
          <div style={{ fontSize: '22px', fontWeight: 700, color: isFdExhausted ? '#ef5350' : '#80d8ff', margin: '4px 0' }}>
            {fdsRequired.toLocaleString()} / {fdLimitNumber.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: isFdExhausted ? '#ff8a80' : '#bbb' }}>
            {isFdExhausted ? '💥 CRASH: EMFILE Too many open files' : '✓ Within operating system file limit'}
          </div>
        </div>

        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>PROTOCOL FRAMING OVERHEAD</span>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffd54f', margin: '4px 0' }}>
            {protocol === 'websocket' ? '2-14 Bytes' : protocol === 'sse' ? '~30 Bytes' : '500-1,000 Bytes'}
          </div>
          <div style={{ fontSize: '11px', color: '#bbb' }}>
            {protocolMultiplier.headerOverhead}
          </div>
        </div>

        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>CLUSTER OUTBOUND EPHEMERAL PORTS</span>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#b388ff', margin: '4px 0' }}>
            65,535
          </div>
          <div style={{ fontSize: '11px', color: '#bbb' }}>
            Max outgoing sockets per destination IP tuple (src:dst)
          </div>
        </div>
      </div>

      {/* Cluster Node Status Grid */}
      <div style={{ background: '#faf9f5', border: '1px solid var(--color-hairline)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px' }}>2. Node Fleet Status &amp; Rolling Deployment Draining</h4>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Draining Strategy:</label>
            <select
              value={drainStrategy}
              onChange={(e) => setDrainStrategy(e.target.value as DrainStrategy)}
              style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--color-hairline)' }}
            >
              <option value="gradual_jitter">Gradual Drain (Rate-limited Close + Jitter)</option>
              <option value="abrupt_disconnect">Abrupt Termination (Kill Process / Thundering Herd)</option>
            </select>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={handleSimulateDrain}
              disabled={isDraining || isOOM || isFdExhausted}
            >
              {isDraining ? 'Draining...' : '⚡ Drain Pod 1'}
            </button>
          </div>
        </div>

        {/* Nodes Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          {nodes.map((node) => {
            const isDead = node.status === 'exhausted' || node.status === 'restarting';
            return (
              <div
                key={node.id}
                style={{
                  background: isDead ? '#ffebee' : node.status === 'draining' ? '#fff8e1' : '#fff',
                  border: `2px solid ${isDead ? '#ef5350' : node.status === 'draining' ? '#ffa000' : '#81c784'}`,
                  borderRadius: '8px',
                  padding: '10px',
                  textAlign: 'center',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                  <span>P{node.id}</span>
                  <span style={{ fontWeight: 700, color: isDead ? '#c62828' : node.status === 'draining' ? '#e65100' : '#2e7d32' }}>
                    {node.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#181715' }}>{node.name}</div>
                <div style={{ fontSize: '16px', fontWeight: 700, margin: '4px 0', color: isDead ? '#c62828' : 'var(--color-primary)' }}>
                  {node.connections.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: '#666' }}>Active Sockets</div>
                <div style={{ fontSize: '10px', marginTop: '6px', color: node.cpuPercent > 90 ? '#c62828' : '#555' }}>
                  CPU: {node.cpuPercent}% | RAM: {(node.memoryMb / 1024).toFixed(1)}GB
                </div>
              </div>
            );
          })}
        </div>

        {/* Console Log Terminal */}
        <div style={{ background: '#181715', color: '#a5d6a7', borderRadius: '8px', padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px', maxHeight: '120px', overflowY: 'auto' }}>
          <div style={{ color: '#888', marginBottom: '4px', borderBottom: '1px solid #333', paddingBottom: '2px' }}>
            GATEWAY DAEMON LOGS (TLS TERMINATION &amp; DRAIN EVENTS)
          </div>
          {logs.map((log, idx) => (
            <div key={idx} style={{ lineHeight: '1.5' }}>
              &gt; {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};