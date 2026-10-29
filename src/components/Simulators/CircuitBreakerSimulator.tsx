import React, { useState, useEffect, useRef } from 'react';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
type DownstreamHealth = 'healthy' | 'intermittent' | 'down';
type JitterMode = 'no-jitter' | 'full-jitter';

interface CallRecord {
  id: string;
  time: string;
  status: 'SUCCESS' | 'FAILURE' | 'CIRCUIT_OPEN_FAST_FAIL' | 'FALLBACK';
  latencyMs: number;
  circuitState: CircuitState;
  detail: string;
}

export const CircuitBreakerSimulator: React.FC = () => {
  const [circuitState, setCircuitState] = useState<CircuitState>('CLOSED');
  const [downstreamHealth, setDownstreamHealth] = useState<DownstreamHealth>('intermittent');
  const [jitterMode, setJitterMode] = useState<JitterMode>('full-jitter');

  // Circuit breaker state counters
  const [recentCalls, setRecentCalls] = useState<('SUCCESS' | 'FAILURE')[]>([]);
  const [halfOpenSuccessCount, setHalfOpenSuccessCount] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const [logs, setLogs] = useState<CallRecord[]>([]);
  const [isSimulatingBatch, setIsSimulatingBatch] = useState<boolean>(false);

  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Constants
  const FAILURE_THRESHOLD_PCT = 50; // Trip if >= 50% failures
  const MIN_SAMPLES = 4; // Need at least 4 requests to evaluate threshold
  const COOLDOWN_SECONDS = 5; // 5 seconds wait in OPEN before testing HALF_OPEN
  const REQUIRED_HALF_OPEN_SUCCESSES = 2; // Need 2 successful trials to re-close

  // Countdown timer for OPEN state
  useEffect(() => {
    if (circuitState === 'OPEN') {
      setCooldownRemaining(COOLDOWN_SECONDS);
      const interval = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCircuitState('HALF_OPEN');
            setHalfOpenSuccessCount(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      cooldownTimerRef.current = interval;
      return () => clearInterval(interval);
    } else {
      setCooldownRemaining(0);
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    }
  }, [circuitState]);

  const addLog = (
    status: CallRecord['status'],
    latencyMs: number,
    state: CircuitState,
    detail: string
  ) => {
    const record: CallRecord = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      status,
      latencyMs,
      circuitState: state,
      detail,
    };
    setLogs((prev) => [record, ...prev.slice(0, 14)]);
  };

  const executeCall = async (callerId = 'Client') => {
    const currentState = circuitState;

    // 1. If circuit is OPEN -> Fail fast immediately!
    if (currentState === 'OPEN') {
      addLog(
        'CIRCUIT_OPEN_FAST_FAIL',
        1,
        'OPEN',
        `${callerId} rejected immediately. Fast-fail fallback returned in 1ms (No network call)`
      );
      return;
    }

    // 2. Perform mock downstream network call
    let willSucceed = true;
    let simulatedLatency = 20;

    if (downstreamHealth === 'healthy') {
      willSucceed = true;
      simulatedLatency = Math.floor(15 + Math.random() * 20);
    } else if (downstreamHealth === 'intermittent') {
      willSucceed = Math.random() > 0.6; // 60% failure
      simulatedLatency = willSucceed ? 45 : 350;
    } else if (downstreamHealth === 'down') {
      willSucceed = false;
      simulatedLatency = 800;
    }

    await new Promise((r) => setTimeout(r, Math.min(simulatedLatency, 150)));

    if (currentState === 'HALF_OPEN') {
      // Evaluating probe in HALF_OPEN
      if (willSucceed) {
        const nextSuccessCount = halfOpenSuccessCount + 1;
        setHalfOpenSuccessCount(nextSuccessCount);
        addLog(
          'SUCCESS',
          simulatedLatency,
          'HALF_OPEN',
          `Trial probe #${nextSuccessCount} succeeded (${simulatedLatency}ms).`
        );
        if (nextSuccessCount >= REQUIRED_HALF_OPEN_SUCCESSES) {
          setCircuitState('CLOSED');
          setRecentCalls([]);
          addLog(
            'SUCCESS',
            simulatedLatency,
            'CLOSED',
            `Downstream verified healthy! Circuit transitioned: HALF_OPEN → CLOSED.`
          );
        }
      } else {
        // Probe failed -> trip immediately back to OPEN!
        setCircuitState('OPEN');
        setHalfOpenSuccessCount(0);
        addLog(
          'FAILURE',
          simulatedLatency,
          'OPEN',
          `Trial probe failed! Downstream still unviable. Circuit tripped back: HALF_OPEN → OPEN.`
        );
      }
      return;
    }

    // Normal CLOSED state execution
    if (willSucceed) {
      setRecentCalls((prev) => {
        const updated = [...prev.slice(-9), 'SUCCESS' as const];
        return updated;
      });
      addLog(
        'SUCCESS',
        simulatedLatency,
        'CLOSED',
        `${callerId} request completed successfully in ${simulatedLatency}ms.`
      );
    } else {
      setRecentCalls((prev) => {
        const updated = [...prev.slice(-9), 'FAILURE' as const];
        // Evaluate failure threshold
        if (updated.length >= MIN_SAMPLES) {
          const failCount = updated.filter((s) => s === 'FAILURE').length;
          const failRate = (failCount / updated.length) * 100;
          if (failRate >= FAILURE_THRESHOLD_PCT) {
            setCircuitState('OPEN');
            addLog(
              'FAILURE',
              simulatedLatency,
              'OPEN',
              `Failure rate reached ${failRate.toFixed(0)}% (threshold ${FAILURE_THRESHOLD_PCT}%). Tripping circuit: CLOSED → OPEN!`
            );
          }
        }
        return updated;
      });
      addLog(
        'FAILURE',
        simulatedLatency,
        'CLOSED',
        `${callerId} downstream call failed or timed out after ${simulatedLatency}ms.`
      );
    }
  };

  const handleSendWaveWithRetries = async () => {
    if (isSimulatingBatch) return;
    setIsSimulatingBatch(true);

    const clientCount = 6;
    const baseWait = 800;

    addLog(
      'FAILURE',
      0,
      circuitState,
      `[Burst Test] Dispatching ${clientCount} simultaneous requests under ${jitterMode.toUpperCase()} retry backoff...`
    );

    // Simulate 6 clients with exponential backoff and optional jitter
    const promises = Array.from({ length: clientCount }, async (_, i) => {
      // First attempt
      await executeCall(`Client #${i + 1}`);

      // If circuit is closed and failed, simulate retry
      for (let attempt = 1; attempt <= 2; attempt++) {
        let sleepMs = baseWait * Math.pow(2, attempt);
        if (jitterMode === 'full-jitter') {
          // Full jitter formula: random_between(0, base * 2^attempt)
          sleepMs = Math.floor(Math.random() * sleepMs);
        }
        await new Promise((r) => setTimeout(r, sleepMs));
        await executeCall(`Client #${i + 1} (Retry ${attempt})`);
      }
    });

    await Promise.all(promises);
    setIsSimulatingBatch(false);
  };

  const handleReset = () => {
    setCircuitState('CLOSED');
    setRecentCalls([]);
    setHalfOpenSuccessCount(0);
    setCooldownRemaining(0);
    setLogs([]);
  };

  // Metrics
  const failCount = recentCalls.filter((c) => c === 'FAILURE').length;
  const currentFailRate = recentCalls.length > 0 ? (failCount / recentCalls.length) * 100 : 0;

  return (
    <div className="card card-cream" style={{ padding: '24px', borderRadius: '12px', margin: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span className="badge badge-coral" style={{ marginRight: '8px' }}>Interactive Architecture Simulator</span>
          <span className="badge">Circuit Breaker &amp; Exponential Jitter</span>
        </div>
        <button type="button" onClick={handleReset} className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
          ↺ Reset Circuit
        </button>
      </div>

      <p style={{ fontSize: '14px', margin: '0 0 16px', color: 'var(--color-body)' }}>
        Observe how the Circuit Breaker trips to prevent cascading thread pool starvation, protects degrading backends by failing fast, conducts trial probes in <code>HALF-OPEN</code>, and prevents retry stampedes with <strong>Full Jitter</strong>.
      </p>

      {/* Downstream Health & Jitter Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px' }}>
            DOWNSTREAM DEPENDENCY HEALTH (e.g. Bank API)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setDownstreamHealth('healthy')}
              className={`btn ${downstreamHealth === 'healthy' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', flex: 1, padding: '8px 4px' }}
            >
              Healthy (20ms)
            </button>
            <button
              type="button"
              onClick={() => setDownstreamHealth('intermittent')}
              className={`btn ${downstreamHealth === 'intermittent' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', flex: 1, padding: '8px 4px' }}
            >
              Degraded (60% Fail)
            </button>
            <button
              type="button"
              onClick={() => setDownstreamHealth('down')}
              className={`btn ${downstreamHealth === 'down' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', flex: 1, padding: '8px 4px' }}
            >
              Down (100% Fail)
            </button>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px' }}>
            RETRY BACKOFF STRATEGY
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setJitterMode('no-jitter')}
              className={`btn ${jitterMode === 'no-jitter' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', flex: 1, padding: '8px 4px' }}
            >
              No Jitter (Synchronized Waves)
            </button>
            <button
              type="button"
              onClick={() => setJitterMode('full-jitter')}
              className={`btn ${jitterMode === 'full-jitter' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', flex: 1, padding: '8px 4px' }}
            >
              Full Jitter (Randomized Spread)
            </button>
          </div>
        </div>
      </div>

      {/* State Machine Display */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Active State Card */}
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px' }}>
            CIRCUIT BREAKER STATE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              className="badge"
              style={{
                fontSize: '15px',
                padding: '6px 14px',
                background:
                  circuitState === 'CLOSED'
                    ? '#ebfbee'
                    : circuitState === 'OPEN'
                    ? '#ffe3e3'
                    : '#fff9db',
                color:
                  circuitState === 'CLOSED'
                    ? '#2b8a3e'
                    : circuitState === 'OPEN'
                    ? '#c92a2a'
                    : '#e67700',
                border: `1px solid ${
                  circuitState === 'CLOSED'
                    ? '#b2f2bb'
                    : circuitState === 'OPEN'
                    ? '#ffa8a8'
                    : '#ffec99'
                }`,
              }}
            >
              ● {circuitState}
            </span>
            {circuitState === 'OPEN' && (
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                Testing recovery in: <strong>{cooldownRemaining}s</strong>
              </span>
            )}
            {circuitState === 'HALF_OPEN' && (
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#e67700' }}>
                Trial success: <strong>{halfOpenSuccessCount}/{REQUIRED_HALF_OPEN_SUCCESSES}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Failure Rate Gauge */}
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px' }}>
            ROLLING FAILURE RATE (THRESHOLD: {FAILURE_THRESHOLD_PCT}%)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: currentFailRate >= FAILURE_THRESHOLD_PCT ? 'var(--color-primary)' : 'var(--color-ink)' }}>
              {currentFailRate.toFixed(0)}%
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
              Samples: {recentCalls.length}/{MIN_SAMPLES} min
            </span>
          </div>
          <div style={{ height: '8px', background: 'var(--color-hairline)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${currentFailRate}%`,
                background: currentFailRate >= FAILURE_THRESHOLD_PCT ? 'var(--color-primary)' : '#2b8a3e',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>

        {/* Protection Benefit */}
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px' }}>
            SYSTEM RESOURCE PROTECTION
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>
            {circuitState === 'OPEN' ? (
              <span style={{ color: '#2b8a3e', fontWeight: 600 }}>
                ✓ Thread pool protected: Requests fail fast in 1ms without exhausting connection sockets.
              </span>
            ) : circuitState === 'HALF_OPEN' ? (
              <span style={{ color: '#e67700', fontWeight: 600 }}>
                ⚡ Probe active: Allowing limited probe requests to verify downstream recovery.
              </span>
            ) : (
              <span style={{ color: 'var(--color-muted)' }}>
                Circuit normal: All requests routed to downstream service.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => executeCall('Single Caller')}
          className="btn btn-secondary"
          style={{ fontSize: '13px' }}
        >
          Send 1 Request
        </button>
        <button
          type="button"
          onClick={async () => {
            for (let i = 0; i < 4; i++) {
              await executeCall(`Batch #${i + 1}`);
            }
          }}
          className="btn btn-secondary"
          style={{ fontSize: '13px' }}
        >
          Send Batch (4 Requests)
        </button>
        <button
          type="button"
          onClick={handleSendWaveWithRetries}
          disabled={isSimulatingBatch}
          className="btn btn-primary"
          style={{ fontSize: '13px' }}
        >
          {isSimulatingBatch ? 'Executing Retries...' : '⚡ Simulate Retry Stampede (6 Clients)'}
        </button>
      </div>

      {/* Terminal Log */}
      <div
        style={{
          background: 'var(--color-surface-dark)',
          color: 'var(--color-on-dark)',
          padding: '16px',
          borderRadius: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--color-on-dark-soft)' }}>
          <span>CIRCUIT BREAKER &amp; RETRY EVENT LOG</span>
          <span>STATE: {circuitState}</span>
        </div>
        <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--color-on-dark-soft)' }}>
              Ready. Click "Send 1 Request" or "Simulate Retry Stampede" to test circuit tripping and recovery.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                style={{
                  color:
                    log.status === 'SUCCESS'
                      ? '#51cf66'
                      : log.status === 'CIRCUIT_OPEN_FAST_FAIL'
                      ? '#ffd43b'
                      : '#ff6b6b',
                }}
              >
                [{log.time}] [{log.circuitState}] [{log.latencyMs}ms] &mdash; {log.detail}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
