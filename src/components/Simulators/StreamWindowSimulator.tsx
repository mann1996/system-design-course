import React, { useState, useEffect, useRef } from 'react';

type WindowType = 'tumbling' | 'sliding' | 'session';

interface StreamEvent {
  id: string;
  key: string;
  eventTime: number; // in relative seconds from stream start
  processingTime: number;
  value: number;
  status: 'on_time' | 'late_accepted' | 'side_output_dropped';
  assignedWindows: string[];
}

interface WindowBucket {
  id: string;
  start: number;
  end: number;
  events: StreamEvent[];
  sum: number;
  isTriggered: boolean;
  isClosed: boolean;
}

export const StreamWindowSimulator: React.FC = () => {
  const [windowType, setWindowType] = useState<WindowType>('tumbling');
  const [watermarkDelaySec, setWatermarkDelaySec] = useState<number>(4);
  const [allowedLatenessSec, setAllowedLatenessSec] = useState<number>(3);
  const [simTime, setSimTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [sideOutputEvents, setSideOutputEvents] = useState<StreamEvent[]>([]);
  const [activeLog, setActiveLog] = useState<string>(
    'Stream engine initialized. Watermark generator configured: BoundedOutOfOrder(delay = 4s). Waiting for event stream...'
  );

  const eventCounterRef = useRef<number>(1);
  const maxEventTimeRef = useRef<number>(0);

  // Watermark = max(observed event time) - watermarkDelaySec
  const currentWatermark = Math.max(0, maxEventTimeRef.current - watermarkDelaySec);

  // Helper to compute windows for tumbling / sliding / session
  const computeWindows = (allEvents: StreamEvent[], type: WindowType, simClock: number) => {
    if (type === 'tumbling') {
      const windowSize = 10;
      const windowMap: Record<number, WindowBucket> = {};

      allEvents.forEach((ev) => {
        if (ev.status === 'side_output_dropped') return;
        const bucketStart = Math.floor(ev.eventTime / windowSize) * windowSize;
        const bucketEnd = bucketStart + windowSize;

        if (!windowMap[bucketStart]) {
          windowMap[bucketStart] = {
            id: `[${bucketStart}s - ${bucketEnd}s)`,
            start: bucketStart,
            end: bucketEnd,
            events: [],
            sum: 0,
            isTriggered: currentWatermark >= bucketEnd,
            isClosed: currentWatermark >= bucketEnd + allowedLatenessSec,
          };
        }
        windowMap[bucketStart].events.push(ev);
        windowMap[bucketStart].sum += ev.value;
      });

      // Ensure any windows passed by watermark exist
      const maxT = Math.max(simClock, maxEventTimeRef.current);
      for (let s = 0; s <= maxT; s += windowSize) {
        if (!windowMap[s]) {
          windowMap[s] = {
            id: `[${s}s - ${s + windowSize}s)`,
            start: s,
            end: s + windowSize,
            events: [],
            sum: 0,
            isTriggered: currentWatermark >= s + windowSize,
            isClosed: currentWatermark >= s + windowSize + allowedLatenessSec,
          };
        }
      }

      return Object.values(windowMap).sort((a, b) => a.start - b.start);
    }

    if (type === 'sliding') {
      const windowSize = 10;
      const slide = 5;
      const windowMap: Record<string, WindowBucket> = {};

      allEvents.forEach((ev) => {
        if (ev.status === 'side_output_dropped') return;
        // Event belongs to all windows covering its eventTime
        const firstStart = Math.floor((ev.eventTime - windowSize + slide) / slide) * slide;
        for (let s = Math.max(0, firstStart); s <= ev.eventTime; s += slide) {
          const wEnd = s + windowSize;
          if (ev.eventTime >= s && ev.eventTime < wEnd) {
            const key = `${s}_${wEnd}`;
            if (!windowMap[key]) {
              windowMap[key] = {
                id: `[${s}s - ${wEnd}s)`,
                start: s,
                end: wEnd,
                events: [],
                sum: 0,
                isTriggered: currentWatermark >= wEnd,
                isClosed: currentWatermark >= wEnd + allowedLatenessSec,
              };
            }
            windowMap[key].events.push(ev);
            windowMap[key].sum += ev.value;
          }
        }
      });

      return Object.values(windowMap).sort((a, b) => a.start - b.start);
    }

    // Session Windows (inactivity gap = 5s)
    const gap = 5;
    const sorted = [...allEvents]
      .filter((e) => e.status !== 'side_output_dropped')
      .sort((a, b) => a.eventTime - b.eventTime);

    const sessionBuckets: WindowBucket[] = [];
    let currentSession: WindowBucket | null = null;

    for (const ev of sorted) {
      if (!currentSession) {
        currentSession = {
          id: `Session-${sessionBuckets.length + 1}`,
          start: ev.eventTime,
          end: ev.eventTime + gap,
          events: [ev],
          sum: ev.value,
          isTriggered: false,
          isClosed: false,
        };
      } else if (ev.eventTime <= currentSession.end) {
        // Extend session
        currentSession.events.push(ev);
        currentSession.sum += ev.value;
        currentSession.end = Math.max(currentSession.end, ev.eventTime + gap);
      } else {
        // Close previous session
        currentSession.isTriggered = currentWatermark >= currentSession.end;
        currentSession.isClosed = currentWatermark >= currentSession.end + allowedLatenessSec;
        sessionBuckets.push(currentSession);

        currentSession = {
          id: `Session-${sessionBuckets.length + 1}`,
          start: ev.eventTime,
          end: ev.eventTime + gap,
          events: [ev],
          sum: ev.value,
          isTriggered: false,
          isClosed: false,
        };
      }
    }

    if (currentSession) {
      currentSession.isTriggered = currentWatermark >= currentSession.end;
      currentSession.isClosed = currentWatermark >= currentSession.end + allowedLatenessSec;
      sessionBuckets.push(currentSession);
    }

    return sessionBuckets;
  };

  const windows = computeWindows(events, windowType, simTime);

  // Ingest an event with relative eventTime offset
  const ingestEvent = (offsetSec: number, customValue?: number) => {
    const pTime = simTime;
    const eTime = Math.max(0, pTime + offsetSec);
    const id = `E-${eventCounterRef.current++}`;
    const value = customValue !== undefined ? customValue : Math.floor(Math.random() * 80) + 20;

    // Update max observed event time if on-time or newer
    if (eTime > maxEventTimeRef.current) {
      maxEventTimeRef.current = eTime;
    }

    const calculatedWatermark = Math.max(0, maxEventTimeRef.current - watermarkDelaySec);

    // Determine which window this event would fall into (using tumbling 10s as canonical reference for lateness)
    const windowEnd = Math.floor(eTime / 10) * 10 + 10;

    let status: 'on_time' | 'late_accepted' | 'side_output_dropped' = 'on_time';
    const assigned: string[] = [];

    if (calculatedWatermark < windowEnd) {
      status = 'on_time';
      assigned.push(`[${windowEnd - 10}s - ${windowEnd}s)`);
    } else if (calculatedWatermark < windowEnd + allowedLatenessSec) {
      status = 'late_accepted';
      assigned.push(`[${windowEnd - 10}s - ${windowEnd}s) (Late Re-Trigger)`);
    } else {
      status = 'side_output_dropped';
      assigned.push('None (Side-Output Quarantine)');
    }

    const newEvent: StreamEvent = {
      id,
      key: 'user_txn_89',
      eventTime: eTime,
      processingTime: pTime,
      value,
      status,
      assignedWindows: assigned,
    };

    setEvents((prev) => [newEvent, ...prev]);

    if (status === 'side_output_dropped') {
      setSideOutputEvents((prev) => [newEvent, ...prev]);
      setActiveLog(
        `⚠️ [LATE DROP -> SIDE OUTPUT] ${id} with EventTime=${eTime}s arrived at ProcTime=${pTime}s. Watermark is already ${calculatedWatermark}s (past WindowEnd ${windowEnd}s + AllowedLateness ${allowedLatenessSec}s). Dropped from main window state into Dead-Letter Side Output!`
      );
    } else if (status === 'late_accepted') {
      setActiveLog(
        `🔄 [LATE EVENT ACCEPTED] ${id} with EventTime=${eTime}s arrived after initial window trigger, but within Allowed Lateness (${allowedLatenessSec}s). Triggering Window State Revision / Retraction emit!`
      );
    } else {
      setActiveLog(
        `✅ [ON-TIME EVENT] ${id} (EventTime=${eTime}s, Val=$${value}) accepted. Current Watermark=${calculatedWatermark}s.`
      );
    }
  };

  // Auto-play stream simulation ticker
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setSimTime((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Reset simulator
  const handleReset = () => {
    setSimTime(0);
    setIsPlaying(false);
    setEvents([]);
    setSideOutputEvents([]);
    eventCounterRef.current = 1;
    maxEventTimeRef.current = 0;
    setActiveLog('Stream reset. Clocks zeroed out.');
  };

  // Burst helper
  const handleBurst = () => {
    ingestEvent(0, 50); // On-time
    setTimeout(() => ingestEvent(-1, 30), 100); // 1s jitter
    setTimeout(() => ingestEvent(-6, 75), 200); // 6s delayed
    setTimeout(() => ingestEvent(1, 100), 300); // slightly ahead
    setTimeout(() => ingestEvent(-12, 120), 400); // severely delayed (side output)
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
            Interactive Stream Processing Simulator
          </span>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 600 }}>
            Event Time, Watermarks &amp; Windowing Engine
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            {isPlaying ? '⏸ Pause Clock' : '▶ Play Stream Clock'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            ↺ Reset Stream
          </button>
        </div>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Emit streaming events with variable network delays. Observe how <strong>Bounded-Out-of-Order Watermarks</strong> evaluate window completion, and see how <strong>Allowed Lateness</strong> prevents silent data loss while isolating severely lagging events into a Dead-Letter Side Output.
      </p>

      {/* Controls Bar */}
      <div
        style={{
          background: 'var(--color-surface-subtle, #f5f2eb)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--rounded-md)',
          padding: '16px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Windowing Strategy:
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['tumbling', 'sliding', 'session'] as WindowType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`btn ${windowType === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setWindowType(t)}
                style={{ fontSize: '12px', padding: '4px 10px', textTransform: 'capitalize' }}
              >
                {t}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
            {windowType === 'tumbling' && 'Fixed 10s non-overlapping buckets'}
            {windowType === 'sliding' && '10s width, 5s sliding increment'}
            {windowType === 'session' && 'Dynamic 5s inactivity gap boundary'}
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Watermark Delay Tolerance: <strong>{watermarkDelaySec}s</strong>
          </label>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={watermarkDelaySec}
            onChange={(e) => setWatermarkDelaySec(parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            W(t) = max(EventTime) &minus; {watermarkDelaySec}s
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Allowed Lateness Window: <strong>{allowedLatenessSec}s</strong>
          </label>
          <input
            type="range"
            min="0"
            max="8"
            step="1"
            value={allowedLatenessSec}
            onChange={(e) => setAllowedLatenessSec(parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Grace period for window update before purge
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Stream Injection Actions:
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => ingestEvent(0)}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              + On-Time (0s)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => ingestEvent(-5)}
              style={{ fontSize: '11px', padding: '4px 8px', color: '#b25e00' }}
            >
              + Jitter (-5s)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => ingestEvent(-12)}
              style={{ fontSize: '11px', padding: '4px 8px', color: '#c92a2a' }}
            >
              + Severe (-12s)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBurst}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              ⚡ Ingest Burst
            </button>
          </div>
        </div>
      </div>

      {/* Clocks & Metric Gauges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Processing Time (Clock)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text)' }}>
            {simTime}s
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Wall-clock server time</div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Max Event Time Observed
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
            {maxEventTimeRef.current}s
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Timestamp inside event payload</div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid #cc785c',
            borderRadius: 'var(--rounded-md)',
            padding: '14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#cc785c', fontWeight: 600, textTransform: 'uppercase' }}>
            Current Watermark W(t)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: '#cc785c' }}>
            {currentWatermark}s
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Events &le; {currentWatermark}s assumed complete</div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Side-Output Drops
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: sideOutputEvents.length > 0 ? '#e03131' : 'var(--color-text)' }}>
            {sideOutputEvents.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Quarantined late arrivals</div>
        </div>
      </div>

      {/* Real-time Status Log */}
      <div
        style={{
          background: '#181715',
          color: '#e6e4df',
          borderRadius: 'var(--rounded-md)',
          padding: '12px 16px',
          fontFamily: 'monospace',
          fontSize: '12px',
          marginBottom: '24px',
          borderLeft: '4px solid #cc785c',
        }}
      >
        <span style={{ color: '#cc785c', fontWeight: 600 }}>[STREAM_EVENT_LOG]:</span> {activeLog}
      </div>

      {/* Window State Visualization Grid */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px' }}>
          Active Window Operators (Aggregating Sum of Transaction Values)
        </h4>
        {windows.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--rounded-md)',
              color: 'var(--color-text-muted)',
              fontSize: '13px',
            }}
          >
            No active windows. Ingest events using the buttons above to open streaming windows.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '12px',
            }}
          >
            {windows.map((w) => {
              const isTriggered = w.isTriggered;
              const isClosed = w.isClosed;

              let badgeColor = '#2a9d8f';
              let statusLabel = 'OPEN (Accumulating)';
              if (isClosed) {
                badgeColor = '#6c757d';
                statusLabel = 'CLOSED (State Purged)';
              } else if (isTriggered) {
                badgeColor = '#e76f51';
                statusLabel = 'TRIGGERED (Emitted)';
              }

              return (
                <div
                  key={w.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: `1px solid ${isClosed ? '#ddd' : isTriggered ? '#e76f51' : '#2a9d8f'}`,
                    borderRadius: 'var(--rounded-md)',
                    padding: '14px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px' }}>{w.id}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: badgeColor,
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                    <strong>Sum:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>${w.sum}</span>
                    <span style={{ margin: '0 8px', color: '#bbb' }}>|</span>
                    <strong>Events:</strong> {w.events.length}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Trigger at W &ge; {w.end}s (diff: {currentWatermark - w.end}s)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Purge at W &ge; {w.end + allowedLatenessSec}s
                  </div>

                  {w.events.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {w.events.map((e) => (
                        <span
                          key={e.id}
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: e.status === 'late_accepted' ? '#ffe8cc' : '#e6fcf5',
                            color: e.status === 'late_accepted' ? '#d9480f' : '#0ca678',
                            fontFamily: 'monospace',
                          }}
                        >
                          {e.id} (${e.value})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Side Output Quarantined Queue */}
      {sideOutputEvents.length > 0 && (
        <div
          style={{
            background: '#fff5f5',
            border: '1px solid #ffc9c9',
            borderRadius: 'var(--rounded-md)',
            padding: '14px 18px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>🚨</span>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#c92a2a' }}>
              Dead-Letter Side Output (Late Events Exceeding Allowed Lateness)
            </h4>
          </div>
          <p style={{ fontSize: '12px', color: '#495057', margin: '0 0 10px' }}>
            These events arrived after their target window was already finalized and purged from operator memory. They are routed asynchronously to an anomaly queue / DLQ for retrospective ledger re-conciliation:
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {sideOutputEvents.map((se) => (
              <span
                key={se.id}
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  background: '#ffe3e3',
                  color: '#c92a2a',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #ffa8a8',
                }}
              >
                {se.id}: EventTime={se.eventTime}s, ProcTime={se.processingTime}s, Val=${se.value} (Late by {currentWatermark - se.eventTime}s)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Ingested Events Stream Table */}
      <div>
        <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 10px' }}>
          Recent Ingested Event Log (Upstream Ingestion Buffer)
        </h4>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Event Time</th>
                <th>Processing Time</th>
                <th>Delta (Delay)</th>
                <th>Value</th>
                <th>Watermark at Arrival</th>
                <th>Evaluation Status</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 7).map((ev) => {
                const delta = ev.processingTime - ev.eventTime;
                return (
                  <tr key={ev.id}>
                    <td><code>{ev.id}</code></td>
                    <td><code>{ev.eventTime}s</code></td>
                    <td><code>{ev.processingTime}s</code></td>
                    <td style={{ color: delta > 0 ? '#d9480f' : '#2b8a3e', fontWeight: 600 }}>
                      {delta === 0 ? '0s (On-time)' : `${delta}s lag`}
                    </td>
                    <td><strong>${ev.value}</strong></td>
                    <td><code>{Math.max(0, maxEventTimeRef.current - watermarkDelaySec)}s</code></td>
                    <td>
                      <span
                        className={`badge ${
                          ev.status === 'on_time'
                            ? 'badge-teal'
                            : ev.status === 'late_accepted'
                            ? 'badge-coral'
                            : ''
                        }`}
                        style={{
                          background: ev.status === 'side_output_dropped' ? '#c92a2a' : undefined,
                          color: ev.status === 'side_output_dropped' ? '#fff' : undefined,
                        }}
                      >
                        {ev.status === 'on_time' && '✓ On-Time Accepted'}
                        {ev.status === 'late_accepted' && '🔄 Late Re-Trigger'}
                        {ev.status === 'side_output_dropped' && '✕ Side-Output Dropped'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No events emitted yet. Click one of the buttons above to inject events into the stream.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
