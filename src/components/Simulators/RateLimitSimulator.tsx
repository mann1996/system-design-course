import React, { useState, useEffect, useRef } from 'react';

type RateLimitAlgorithm = 'token-bucket' | 'fixed-window' | 'sliding-window';

interface RequestLog {
  id: string;
  timestamp: string;
  status: 200 | 429;
  message: string;
  remaining: number;
  retryAfter?: number;
}

export const RateLimitSimulator: React.FC = () => {
  const [algorithm, setAlgorithm] = useState<RateLimitAlgorithm>('token-bucket');
  const maxCapacity = 10;
  const windowSeconds = 10;

  // Token Bucket State
  const [tokens, setTokens] = useState<number>(10);
  const refillRatePerSec = 2; // 2 tokens per second
  const lastRefillTimeRef = useRef<number>(Date.now());

  // Fixed Window State
  const [fixedWindowCount, setFixedWindowCount] = useState<number>(0);
  const [fixedWindowStart, setFixedWindowStart] = useState<number>(Date.now());
  const [secondsRemainingInFixedWindow, setSecondsRemainingInFixedWindow] = useState<number>(10);

  // Sliding Window Counter State
  const [prevWindowCount, setPrevWindowCount] = useState<number>(0);
  const [currWindowCount, setCurrWindowCount] = useState<number>(0);
  const [slidingWindowStart, setSlidingWindowStart] = useState<number>(Date.now());

  // Logs & Stats
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [totalAccepted, setTotalAccepted] = useState<number>(0);
  const [totalThrottled, setTotalThrottled] = useState<number>(0);

  // Refill timer for Token Bucket and tick for Windows
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();

      // 1. Token Bucket Refill
      if (algorithm === 'token-bucket') {
        const elapsedSec = (now - lastRefillTimeRef.current) / 1000;
        if (elapsedSec >= 0.5) {
          const added = Math.floor(elapsedSec * refillRatePerSec);
          if (added > 0) {
            setTokens((prev) => Math.min(maxCapacity, prev + added));
            lastRefillTimeRef.current = now;
          }
        }
      }

      // 2. Fixed Window Expiry
      if (algorithm === 'fixed-window') {
        const elapsed = (now - fixedWindowStart) / 1000;
        const remaining = Math.max(0, Math.ceil(windowSeconds - elapsed));
        setSecondsRemainingInFixedWindow(remaining);

        if (elapsed >= windowSeconds) {
          setFixedWindowStart(now);
          setFixedWindowCount(0);
          setSecondsRemainingInFixedWindow(windowSeconds);
        }
      }

      // 3. Sliding Window Counter Transition
      if (algorithm === 'sliding-window') {
        const elapsed = (now - slidingWindowStart) / 1000;
        if (elapsed >= windowSeconds) {
          setPrevWindowCount(currWindowCount);
          setCurrWindowCount(0);
          setSlidingWindowStart(now);
        }
      }
    }, 200);

    return () => clearInterval(timer);
  }, [algorithm, maxCapacity, windowSeconds, fixedWindowStart, slidingWindowStart, currWindowCount]);

  const addLog = (status: 200 | 429, message: string, remaining: number, retryAfter?: number) => {
    const timeStr = new Date().toLocaleTimeString();
    const newLog: RequestLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: timeStr,
      status,
      message,
      remaining,
      retryAfter,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 14)]);
    if (status === 200) {
      setTotalAccepted((c) => c + 1);
    } else {
      setTotalThrottled((c) => c + 1);
    }
  };

  const handleSendRequests = (count: number) => {
    for (let i = 0; i < count; i++) {
      if (algorithm === 'token-bucket') {
        setTokens((currentTokens) => {
          if (currentTokens >= 1) {
            const nextVal = currentTokens - 1;
            addLog(200, `Token consumed from bucket. [Tokens remaining: ${nextVal}/${maxCapacity}]`, nextVal);
            return nextVal;
          } else {
            const retrySeconds = Math.ceil((1 - currentTokens) / refillRatePerSec) || 1;
            addLog(429, `Bucket exhausted. 429 Too Many Requests (Refill rate: ${refillRatePerSec}/sec)`, 0, retrySeconds);
            return currentTokens;
          }
        });
      } else if (algorithm === 'fixed-window') {
        setFixedWindowCount((currentCount) => {
          if (currentCount < maxCapacity) {
            const nextCount = currentCount + 1;
            addLog(200, `Request allowed in fixed window. [Count: ${nextCount}/${maxCapacity}]`, maxCapacity - nextCount);
            return nextCount;
          } else {
            const elapsed = (Date.now() - fixedWindowStart) / 1000;
            const retry = Math.max(1, Math.ceil(windowSeconds - elapsed));
            addLog(429, `Fixed window limit breached. 429 Too Many Requests. Window resets in ${retry}s`, 0, retry);
            return currentCount;
          }
        });
      } else if (algorithm === 'sliding-window') {
        // Weighted estimate
        const elapsed = (Date.now() - slidingWindowStart) / 1000;
        const currentWindowWeight = Math.min(1, Math.max(0, elapsed / windowSeconds));
        const previousWindowWeight = 1 - currentWindowWeight;
        const estimatedCount = Math.floor(prevWindowCount * previousWindowWeight + currWindowCount);

        if (estimatedCount < maxCapacity) {
          setCurrWindowCount((c) => {
            const next = c + 1;
            addLog(
              200,
              `Request allowed. Weighted sliding window load: ~${estimatedCount + 1}/${maxCapacity}`,
              maxCapacity - (estimatedCount + 1)
            );
            return next;
          });
        } else {
          const retry = Math.max(1, Math.ceil((1 - currentWindowWeight) * windowSeconds));
          addLog(429, `Sliding window counter threshold reached (~${estimatedCount}/${maxCapacity}). 429 Throttled.`, 0, retry);
        }
      }
    }
  };

  const handleSimulateBoundaryBurst = () => {
    // Demonstrates Fixed Window boundary spike
    setAlgorithm('fixed-window');
    setFixedWindowCount(maxCapacity);
    setFixedWindowStart(Date.now() - (windowSeconds * 1000 - 600)); // 600ms before window resets
    setSecondsRemainingInFixedWindow(1);
    addLog(200, `[Fixed Window Vulnerability] Burst 1: ${maxCapacity} requests consumed in final 600ms of Window 1`, 0);

    setTimeout(() => {
      // Window rolls over!
      setFixedWindowCount(0);
      setFixedWindowStart(Date.now());
      setSecondsRemainingInFixedWindow(windowSeconds);
      // Immediately blast 10 more
      for (let i = 0; i < maxCapacity; i++) {
        setFixedWindowCount((c) => c + 1);
      }
      addLog(
        200,
        `[Fixed Window Vulnerability] Burst 2: ${maxCapacity} requests accepted in first 400ms of Window 2! Total 20 requests in 1 second! (2x limit)`,
        0
      );
    }, 1000);
  };

  const handleReset = () => {
    setTokens(maxCapacity);
    lastRefillTimeRef.current = Date.now();
    setFixedWindowCount(0);
    setFixedWindowStart(Date.now());
    setSecondsRemainingInFixedWindow(windowSeconds);
    setPrevWindowCount(0);
    setCurrWindowCount(0);
    setSlidingWindowStart(Date.now());
    setLogs([]);
    setTotalAccepted(0);
    setTotalThrottled(0);
  };

  // Compute sliding window estimate for visual meter
  const slidingElapsed = (Date.now() - slidingWindowStart) / 1000;
  const slidingWeight = Math.min(1, Math.max(0, slidingElapsed / windowSeconds));
  const slidingEstimatedCount = Math.floor(prevWindowCount * (1 - slidingWeight) + currWindowCount);

  return (
    <div className="card card-cream" style={{ padding: '24px', borderRadius: '12px', margin: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span className="badge badge-coral" style={{ marginRight: '8px' }}>Interactive Architecture Simulator</span>
          <span className="badge">Redis Rate Limiting &amp; Overload Control</span>
        </div>
        <button type="button" onClick={handleReset} className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
          ↺ Reset Counters
        </button>
      </div>

      <p style={{ fontSize: '14px', margin: '0 0 16px', color: 'var(--color-body)' }}>
        Compare how three industry-standard rate limiting algorithms handle traffic bursts, observe the Fixed Window boundary doubling vulnerability, and inspect HTTP <code>429 Too Many Requests</code> header semantics.
      </p>

      {/* Algorithm Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => { setAlgorithm('token-bucket'); }}
          className={`btn ${algorithm === 'token-bucket' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '13px', textAlign: 'left', padding: '10px 12px' }}
        >
          <strong>1. Token Bucket</strong>
          <div style={{ fontSize: '11px', opacity: 0.85 }}>Bursts allowed, steady 2/s refill</div>
        </button>

        <button
          type="button"
          onClick={() => { setAlgorithm('fixed-window'); }}
          className={`btn ${algorithm === 'fixed-window' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '13px', textAlign: 'left', padding: '10px 12px' }}
        >
          <strong>2. Fixed Window Counter</strong>
          <div style={{ fontSize: '11px', opacity: 0.85 }}>Simple reset, boundary vulnerability</div>
        </button>

        <button
          type="button"
          onClick={() => { setAlgorithm('sliding-window'); }}
          className={`btn ${algorithm === 'sliding-window' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '13px', textAlign: 'left', padding: '10px 12px' }}
        >
          <strong>3. Sliding Window Counter</strong>
          <div style={{ fontSize: '11px', opacity: 0.85 }}>Smooth weighted rolling counter</div>
        </button>
      </div>

      {/* Simulator Metrics & Gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Visual Gauge */}
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px' }}>
            ALGORITHM STATE METER
          </div>

          {algorithm === 'token-bucket' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: tokens > 0 ? 'var(--color-teal)' : 'var(--color-primary)' }}>
                  {tokens} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--color-muted)' }}>/ {maxCapacity} tokens</span>
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                  Refill: +{refillRatePerSec}/sec
                </span>
              </div>
              <div style={{ height: '10px', background: 'var(--color-hairline)', borderRadius: '5px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(tokens / maxCapacity) * 100}%`,
                    background: tokens > 2 ? 'var(--color-teal)' : 'var(--color-primary)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {algorithm === 'fixed-window' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: fixedWindowCount >= maxCapacity ? 'var(--color-primary)' : 'var(--color-ink)' }}>
                  {fixedWindowCount} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--color-muted)' }}>/ {maxCapacity} reqs</span>
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-coral)' }}>
                  Resets in: {secondsRemainingInFixedWindow}s
                </span>
              </div>
              <div style={{ height: '10px', background: 'var(--color-hairline)', borderRadius: '5px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (fixedWindowCount / maxCapacity) * 100)}%`,
                    background: fixedWindowCount >= maxCapacity ? 'var(--color-primary)' : 'var(--color-teal)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {algorithm === 'sliding-window' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: slidingEstimatedCount >= maxCapacity ? 'var(--color-primary)' : 'var(--color-ink)' }}>
                  ~{slidingEstimatedCount} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--color-muted)' }}>/ {maxCapacity} reqs</span>
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                  Prev: {prevWindowCount} | Curr: {currWindowCount}
                </span>
              </div>
              <div style={{ height: '10px', background: 'var(--color-hairline)', borderRadius: '5px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (slidingEstimatedCount / maxCapacity) * 100)}%`,
                    background: slidingEstimatedCount >= maxCapacity ? 'var(--color-primary)' : 'var(--color-teal)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Traffic Statistics */}
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px' }}>
            GATEWAY OUTCOME TOTALS
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#2b8a3e' }}>{totalAccepted}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>200 OK (Forwarded)</div>
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-primary)' }}>{totalThrottled}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>429 Too Many Requests</div>
            </div>
          </div>
        </div>

        {/* Standard HTTP Headers preview */}
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-hairline)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>
            EMITTED HTTP HEADERS
          </div>
          <div style={{ color: 'var(--color-muted)' }}>X-RateLimit-Limit: <strong style={{ color: 'var(--color-ink)' }}>{maxCapacity}</strong></div>
          <div style={{ color: 'var(--color-muted)' }}>
            X-RateLimit-Remaining: <strong style={{ color: 'var(--color-ink)' }}>
              {algorithm === 'token-bucket' ? tokens : algorithm === 'fixed-window' ? Math.max(0, maxCapacity - fixedWindowCount) : Math.max(0, maxCapacity - slidingEstimatedCount)}
            </strong>
          </div>
          <div style={{ color: 'var(--color-muted)' }}>
            Retry-After: <strong style={{ color: 'var(--color-primary)' }}>
              {algorithm === 'fixed-window' && fixedWindowCount >= maxCapacity ? `${secondsRemainingInFixedWindow}s` : algorithm === 'token-bucket' && tokens === 0 ? '1s' : '0s'}
            </strong>
          </div>
        </div>
      </div>

      {/* Request Generation Controls */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => handleSendRequests(1)}
          className="btn btn-secondary"
          style={{ fontSize: '13px' }}
        >
          Send 1 Request
        </button>
        <button
          type="button"
          onClick={() => handleSendRequests(5)}
          className="btn btn-secondary"
          style={{ fontSize: '13px' }}
        >
          Send Burst (5 Requests)
        </button>
        <button
          type="button"
          onClick={() => handleSendRequests(12)}
          className="btn btn-secondary"
          style={{ fontSize: '13px' }}
        >
          Send Heavy Burst (12 Requests)
        </button>
        {algorithm === 'fixed-window' && (
          <button
            type="button"
            onClick={handleSimulateBoundaryBurst}
            className="btn btn-primary"
            style={{ fontSize: '13px' }}
          >
            ⚡ Trigger Boundary Spike (20 reqs / 1s)
          </button>
        )}
      </div>

      {/* Terminal Audit Log */}
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
          <span>RATE LIMITER INGRESS STREAM AUDIT LOG</span>
          <span>Active: {algorithm.toUpperCase()}</span>
        </div>
        <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--color-on-dark-soft)' }}>
              Ready. Click "Send 1 Request" or "Send Burst" to test ingress throttling behavior.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={{ color: log.status === 200 ? '#51cf66' : '#ff6b6b' }}>
                [{log.timestamp}] HTTP {log.status} &mdash; {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
