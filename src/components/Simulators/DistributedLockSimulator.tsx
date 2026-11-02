import React, { useState, useEffect, useRef } from 'react';

type LockMode = 'naive' | 'fenced';

interface WorkerState {
  name: string;
  status: 'idle' | 'acquiring' | 'holding_lock' | 'gc_paused' | 'submitting_write';
  tokenHeld: number | null;
  proposedBalance: number;
}

interface StorageState {
  balance: number;
  lastWriter: string;
  fencingToken: number;
  staleWriteRejections: number;
  dataCorruptionEvents: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  actor: 'WORKER_A' | 'WORKER_B' | 'LOCK_MANAGER' | 'STORAGE';
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const DistributedLockSimulator: React.FC = () => {
  const [mode, setMode] = useState<LockMode>('fenced');
  const [lockOwner, setLockOwner] = useState<string | null>(null);
  const [lockTtlRemaining, setLockTtlRemaining] = useState<number>(0);
  const [coordinatorTokenCounter, setCoordinatorTokenCounter] = useState<number>(40);

  const [workerA, setWorkerA] = useState<WorkerState>({
    name: 'Worker A',
    status: 'idle',
    tokenHeld: null,
    proposedBalance: 1100, // Wants to add $100
  });

  const [workerB, setWorkerB] = useState<WorkerState>({
    name: 'Worker B',
    status: 'idle',
    tokenHeld: null,
    proposedBalance: 1500, // Wants to add $500
  });

  const [storage, setStorage] = useState<StorageState>({
    balance: 1000,
    lastWriter: 'Initial State',
    fencingToken: 40,
    staleWriteRejections: 0,
    dataCorruptionEvents: 0,
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Ref to track TTL countdown interval
  const ttlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = (
    actor: 'WORKER_A' | 'WORKER_B' | 'LOCK_MANAGER' | 'STORAGE',
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    const time = new Date().toTimeString().split(' ')[0] + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
    setLogs((prev) => [{ id: Math.random().toString(36).substring(2, 9), timestamp: time, actor, message, type }, ...prev.slice(0, 19)]);
  };

  // TTL Countdown ticker
  useEffect(() => {
    if (lockOwner && lockTtlRemaining > 0) {
      ttlTimerRef.current = setTimeout(() => {
        setLockTtlRemaining((prev) => {
          if (prev <= 1) {
            addLog('LOCK_MANAGER', `Lock on resource 'account:9042' EXPIRED after TTL timeout!`, 'warning');
            setLockOwner(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (ttlTimerRef.current) clearTimeout(ttlTimerRef.current);
    };
  }, [lockOwner, lockTtlRemaining]);

  const handleReset = () => {
    setLockOwner(null);
    setLockTtlRemaining(0);
    setCoordinatorTokenCounter(40);
    setWorkerA({
      name: 'Worker A',
      status: 'idle',
      tokenHeld: null,
      proposedBalance: 1100,
    });
    setWorkerB({
      name: 'Worker B',
      status: 'idle',
      tokenHeld: null,
      proposedBalance: 1500,
    });
    setStorage({
      balance: 1000,
      lastWriter: 'Initial State',
      fencingToken: 40,
      staleWriteRejections: 0,
      dataCorruptionEvents: 0,
    });
    setLogs([]);
    addLog('LOCK_MANAGER', 'Simulator reset to pristine state (Account Balance: $1,000).', 'info');
  };

  // Step 1: Worker A acquires lock
  const handleWorkerAAcquires = () => {
    if (lockOwner) {
      addLog('WORKER_A', `Failed to acquire lock: currently held by ${lockOwner}.`, 'warning');
      return;
    }
    const nextToken = coordinatorTokenCounter + 1;
    setCoordinatorTokenCounter(nextToken);
    setLockOwner('Worker A');
    setLockTtlRemaining(6); // 6-second lock lease
    setWorkerA((prev) => ({
      ...prev,
      status: 'holding_lock',
      tokenHeld: mode === 'fenced' ? nextToken : null,
    }));
    addLog(
      'LOCK_MANAGER',
      `Granted lock to Worker A with 6s TTL lease.${mode === 'fenced' ? ` Monotonic Fencing Token issued: #${nextToken}` : ' (No fencing token)'}`,
      'success'
    );
  };

  // Step 2: Inject Stop-The-World GC Pause / Event Loop lag on Worker A
  const handleWorkerAPause = () => {
    if (workerA.status !== 'holding_lock') {
      addLog('WORKER_A', 'Worker A must be holding the lock to simulate a GC pause.', 'warning');
      return;
    }
    setWorkerA((prev) => ({ ...prev, status: 'gc_paused' }));
    addLog(
      'WORKER_A',
      'ALERT: Worker A suffered a 10-second Stop-The-World GC Pause! Process frozen; unable to refresh lock heartbeat.',
      'error'
    );
  };

  // Step 3: Worker B acquires lock (after TTL expiration or forced)
  const handleWorkerBAcquires = () => {
    if (lockOwner && lockOwner !== 'Worker B') {
      addLog('WORKER_B', `Cannot acquire lock: currently held by ${lockOwner} (${lockTtlRemaining}s remaining).`, 'warning');
      return;
    }
    const nextToken = coordinatorTokenCounter + 1;
    setCoordinatorTokenCounter(nextToken);
    setLockOwner('Worker B');
    setLockTtlRemaining(8);
    setWorkerB((prev) => ({
      ...prev,
      status: 'holding_lock',
      tokenHeld: mode === 'fenced' ? nextToken : null,
    }));
    addLog(
      'LOCK_MANAGER',
      `Granted lock to Worker B with 8s TTL lease.${mode === 'fenced' ? ` Monotonic Fencing Token issued: #${nextToken}` : ' (No fencing token)'}`,
      'success'
    );
  };

  // Step 4: Worker B commits write to storage
  const handleWorkerBCommits = () => {
    if (workerB.status !== 'holding_lock') {
      addLog('WORKER_B', 'Worker B does not hold active lock.', 'warning');
      return;
    }
    // Update storage
    setStorage((prev) => ({
      ...prev,
      balance: workerB.proposedBalance,
      lastWriter: 'Worker B',
      fencingToken: workerB.tokenHeld || prev.fencingToken,
    }));
    setLockOwner(null);
    setLockTtlRemaining(0);
    setWorkerB((prev) => ({ ...prev, status: 'idle', tokenHeld: null }));
    addLog(
      'STORAGE',
      `Worker B successfully committed write! Updated Balance = $${workerB.proposedBalance.toLocaleString()}.${mode === 'fenced' ? ` Recorded Fencing Token = #${workerB.tokenHeld}` : ''}`,
      'success'
    );
  };

  // Step 5: Worker A wakes up from GC pause and attempts to commit stale write!
  const handleWorkerAWakesAndWrites = () => {
    if (workerA.status !== 'gc_paused') {
      addLog('WORKER_A', 'Worker A must be in GC pause state to demonstrate the wake-up race condition.', 'warning');
      return;
    }

    addLog('WORKER_A', 'Worker A wakes up from GC pause! Believes it still holds the lock and submits write...', 'warning');

    if (mode === 'naive') {
      // NAIVE: Storage has no validation mechanism! Overwrites valid state!
      setStorage((prev) => ({
        ...prev,
        balance: workerA.proposedBalance,
        lastWriter: 'Worker A (Zombie Overwrite!)',
        dataCorruptionEvents: prev.dataCorruptionEvents + 1,
      }));
      setWorkerA((prev) => ({ ...prev, status: 'idle', tokenHeld: null }));
      addLog(
        'STORAGE',
        `FATAL DATA CORRUPTION: Storage accepted Zombie Worker A's stale write! Overwrote Worker B's fresh balance ($1,500) with stale balance ($1,100)!`,
        'error'
      );
    } else {
      // FENCED: Storage checks token monotonicity
      const token = workerA.tokenHeld || 0;
      if (token <= storage.fencingToken) {
        setStorage((prev) => ({
          ...prev,
          staleWriteRejections: prev.staleWriteRejections + 1,
        }));
        setWorkerA((prev) => ({ ...prev, status: 'idle', tokenHeld: null }));
        addLog(
          'STORAGE',
          `DEFENSE SUCCESS: Storage rejected Zombie Worker A's write (Token #${token} <= Stored Token #${storage.fencingToken})! Data integrity preserved!`,
          'success'
        );
      }
    }
  };

  return (
    <div className="card card-cream" style={{ padding: '24px', margin: '32px 0', borderRadius: '12px', border: '1.5px solid var(--color-hairline)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <span className="badge badge-coral" style={{ marginRight: '8px' }}>Interactive Architecture Simulator</span>
          <span className="badge">The Zombie Client Dilemma &amp; Fencing Tokens</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="btn btn-secondary"
          style={{ fontSize: '12px', padding: '4px 10px' }}
        >
          ↺ Reset Simulation
        </button>
      </div>

      <p style={{ fontSize: '14px', margin: '0 0 20px', color: 'var(--color-body)' }}>
        Experience Martin Kleppmann's famous critique of TTL-based distributed locks. Walk through the &ldquo;Zombie Client&rdquo; scenario to see how process pauses cause silent data loss, and observe how monotonic fencing tokens guarantee storage-level correctness.
      </p>

      {/* Mode Selector Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => { setMode('naive'); handleReset(); }}
          className={`btn ${mode === 'naive' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ textAlign: 'left', padding: '12px 14px' }}
        >
          <div style={{ fontWeight: 700, fontSize: '13px' }}>1. Naive TTL Lock (No Fencing)</div>
          <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
            Vulnerable to GC pauses, event-loop lag &amp; silent data overwrites
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setMode('fenced'); handleReset(); }}
          className={`btn ${mode === 'fenced' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ textAlign: 'left', padding: '12px 14px' }}
        >
          <div style={{ fontWeight: 700, fontSize: '13px' }}>2. Monotonic Fencing Tokens (Kleppmann Pattern)</div>
          <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
            Storage rejects stale tokens &bull; Zero split-brain data corruption
          </div>
        </button>
      </div>

      {/* Distributed Architecture Topology Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Worker A Card */}
        <div
          style={{
            background: workerA.status === 'gc_paused' ? '#ffebee' : '#fff',
            padding: '16px',
            borderRadius: '8px',
            border: `1.5px solid ${workerA.status === 'gc_paused' ? '#c62828' : 'var(--color-hairline)'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '13px' }}>WORKER INSTANCE A</strong>
            <span
              className="badge"
              style={{
                fontSize: '10px',
                background:
                  workerA.status === 'holding_lock'
                    ? 'var(--color-teal)'
                    : workerA.status === 'gc_paused'
                    ? '#c62828'
                    : '#e0e0e0',
                color: workerA.status === 'idle' ? '#555' : '#fff',
              }}
            >
              {workerA.status.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '8px' }}>
            Target: Add $100 &rarr; <strong>${workerA.proposedBalance}</strong>
          </div>
          {mode === 'fenced' && (
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              Held Token: <strong style={{ color: 'var(--color-primary)' }}>{workerA.tokenHeld ? `#${workerA.tokenHeld}` : 'None'}</strong>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              type="button"
              disabled={lockOwner !== null || workerA.status !== 'idle'}
              onClick={handleWorkerAAcquires}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              1. Worker A: Acquire Lock
            </button>
            <button
              type="button"
              disabled={workerA.status !== 'holding_lock'}
              onClick={handleWorkerAPause}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 8px', color: '#c62828' }}
            >
              2. Inject 10s GC Pause
            </button>
            <button
              type="button"
              disabled={workerA.status !== 'gc_paused'}
              onClick={handleWorkerAWakesAndWrites}
              className="btn btn-primary"
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              5. Wake Up &amp; Submit Stale Write
            </button>
          </div>
        </div>

        {/* Distributed Lock Manager Card */}
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '6px' }}>
            DISTRIBUTED LOCK SERVICE (Redis / etcd)
          </div>
          <div style={{ fontSize: '13px', marginBottom: '6px' }}>
            Current Lock Holder:{' '}
            <strong style={{ color: lockOwner ? 'var(--color-primary)' : '#2e7d32' }}>
              {lockOwner || 'None (Unlocked)'}
            </strong>
          </div>
          <div style={{ fontSize: '13px', marginBottom: '6px' }}>
            Lease TTL Remaining:{' '}
            <strong style={{ fontFamily: 'var(--font-mono)', color: lockTtlRemaining > 0 ? '#1d70b8' : 'var(--color-muted)' }}>
              {lockTtlRemaining}s
            </strong>
          </div>
          {mode === 'fenced' && (
            <div style={{ fontSize: '13px', marginBottom: '12px' }}>
              Next Fencing Token:{' '}
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                #{coordinatorTokenCounter + 1}
              </strong>
            </div>
          )}
          <div style={{ background: 'var(--color-surface-soft)', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', color: 'var(--color-muted)' }}>
            Key: <code>resource:account:9042</code>
            <br />
            Heartbeat: {workerA.status === 'gc_paused' ? 'Paused (Missed)' : 'Active'}
          </div>
        </div>

        {/* Worker B Card */}
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '13px' }}>WORKER INSTANCE B</strong>
            <span
              className="badge"
              style={{
                fontSize: '10px',
                background: workerB.status === 'holding_lock' ? 'var(--color-teal)' : '#e0e0e0',
                color: workerB.status === 'idle' ? '#555' : '#fff',
              }}
            >
              {workerB.status.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '8px' }}>
            Target: Add $500 &rarr; <strong>${workerB.proposedBalance}</strong>
          </div>
          {mode === 'fenced' && (
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              Held Token: <strong style={{ color: 'var(--color-primary)' }}>{workerB.tokenHeld ? `#${workerB.tokenHeld}` : 'None'}</strong>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              type="button"
              disabled={lockOwner !== null || workerA.status !== 'gc_paused'}
              onClick={handleWorkerBAcquires}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              3. Worker B: Acquire (After TTL)
            </button>
            <button
              type="button"
              disabled={workerB.status !== 'holding_lock'}
              onClick={handleWorkerBCommits}
              className="btn btn-primary"
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              4. Worker B: Commit &amp; Release
            </button>
          </div>
        </div>

        {/* Target Storage Card */}
        <div
          style={{
            background: storage.dataCorruptionEvents > 0 ? '#ffebee' : '#fff',
            padding: '16px',
            borderRadius: '8px',
            border: `1.5px solid ${storage.dataCorruptionEvents > 0 ? '#c62828' : 'var(--color-hairline)'}`,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '6px' }}>
            STORAGE LAYER (PostgreSQL / DynamoDB)
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: storage.dataCorruptionEvents > 0 ? '#c62828' : 'var(--color-ink)', marginBottom: '4px' }}>
            ${storage.balance.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '4px' }}>
            Last Writer: <strong>{storage.lastWriter}</strong>
          </div>
          {mode === 'fenced' && (
            <div style={{ fontSize: '12px', marginBottom: '4px' }}>
              Stored Fencing Token: <strong>#{storage.fencingToken}</strong>
            </div>
          )}
          <div style={{ marginTop: '8px', fontSize: '11px' }}>
            {mode === 'naive' ? (
              <span style={{ color: storage.dataCorruptionEvents > 0 ? '#c62828' : '#666', fontWeight: 600 }}>
                Corruptions: {storage.dataCorruptionEvents}
              </span>
            ) : (
              <span style={{ color: '#2e7d32', fontWeight: 600 }}>
                Stale Writes Blocked: {storage.staleWriteRejections}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Guided Walkthrough Steps */}
      <div style={{ background: '#f5f4f0', padding: '16px 20px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--color-hairline)' }}>
        <h4 style={{ margin: '0 0 10px', fontSize: '14px' }}>Guided Step-by-Step Experiment:</h4>
        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: 1.6 }}>
          <li>Click <strong>&ldquo;1. Worker A: Acquire Lock&rdquo;</strong> to grant Worker A exclusive access.</li>
          <li>Click <strong>&ldquo;2. Inject 10s GC Pause&rdquo;</strong> on Worker A. Notice Worker A freezes and the lock TTL ticks down to 0.</li>
          <li>Click <strong>&ldquo;3. Worker B: Acquire&rdquo;</strong> and then <strong>&ldquo;4. Worker B: Commit &amp; Release&rdquo;</strong> to update balance to $1,500.</li>
          <li>Click <strong>&ldquo;5. Wake Up &amp; Submit Stale Write&rdquo;</strong> on Worker A.</li>
          <li>
            <strong>Observe the result:</strong> In <em>Naive Mode</em>, Worker A overwrites Worker B's balance ($1,100). In <em>Fenced Mode</em>, storage checks the monotonic token and rejects the stale write!
          </li>
        </ol>
      </div>

      {/* Live Operational Log Audit */}
      <div style={{ background: '#181715', borderRadius: '8px', padding: '16px', color: '#faf9f5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#a0a09e' }}>
            DISTRIBUTED COORDINATION AUDIT TRAIL
          </span>
          <span style={{ fontSize: '11px', color: '#a0a09e' }}>Real-time execution log</span>
        </div>

        <div style={{ maxHeight: '180px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.6 }}>
          {logs.length === 0 ? (
            <div style={{ color: '#666' }}>No actions recorded yet. Follow the 5-step guided experiment above.</div>
          ) : (
            logs.map((log) => {
              let color = '#ccc';
              if (log.type === 'success') color = '#00e676';
              if (log.type === 'warning') color = '#ffab00';
              if (log.type === 'error') color = '#ff5252';

              return (
                <div key={log.id} style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ color: '#666', flexShrink: 0 }}>[{log.timestamp}]</span>
                  <span style={{ color: '#00b0ff', flexShrink: 0, width: '110px' }}>{log.actor}:</span>
                  <span style={{ color }}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
