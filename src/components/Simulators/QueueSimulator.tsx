import React, { useState, useEffect, useRef } from 'react';

interface QueueItem {
  id: number;
  type: string;
  retries: number;
}

interface WorkerState {
  id: number;
  busy: boolean;
  currentTask: QueueItem | null;
}

export const QueueSimulator: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [totalEnqueued, setTotalEnqueued] = useState(0);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [dlqCount, setDlqCount] = useState(0);
  const [processDuration, setProcessDuration] = useState(600);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [workers, setWorkers] = useState<WorkerState[]>([
    { id: 1, busy: false, currentTask: null },
    { id: 2, busy: false, currentTask: null },
    { id: 3, busy: false, currentTask: null }
  ]);

  const msgIdCounter = useRef(1);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const workersRef = useRef<WorkerState[]>(workers);
  const durationRef = useRef(processDuration);

  queueRef.current = queue;
  workersRef.current = workers;
  durationRef.current = processDuration;

  const MAX_QUEUE_BUFFER = 18;

  const dispatchNext = () => {
    const currentQ = [...queueRef.current];
    const currentWorkers = [...workersRef.current];

    currentWorkers.forEach((w, wIdx) => {
      if (!w.busy && currentQ.length > 0) {
        const task = currentQ.shift()!;
        w.busy = true;
        w.currentTask = task;

        const dur = durationRef.current;
        setTimeout(() => {
          setTotalProcessed((p) => p + 1);
          setWorkers((prev) => {
            const updated = [...prev];
            if (updated[wIdx]) {
              updated[wIdx].busy = false;
              updated[wIdx].currentTask = null;
            }
            return updated;
          });
          // recheck dispatch
          setTimeout(dispatchNext, 10);
        }, dur);
      }
    });

    setQueue(currentQ);
    setWorkers(currentWorkers);
  };

  const enqueue = (type = 'ORDER_CREATED') => {
    setTotalEnqueued((e) => e + 1);
    if (queueRef.current.length >= MAX_QUEUE_BUFFER) {
      setDlqCount((d) => d + 1);
      return;
    }
    const item: QueueItem = {
      id: msgIdCounter.current++,
      type,
      retries: 0
    };
    setQueue((prev) => [...prev, item]);
    setTimeout(dispatchNext, 10);
  };

  const handleBurst = () => {
    for (let i = 0; i < 10; i++) {
      setTimeout(() => enqueue(), i * 50);
    }
  };

  const toggleAuto = () => {
    if (isAutoRunning) {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
      setIsAutoRunning(false);
    } else {
      setIsAutoRunning(true);
      autoIntervalRef.current = setInterval(() => {
        enqueue();
      }, 250);
    }
  };

  const handleReset = () => {
    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }
    setIsAutoRunning(false);
    setQueue([]);
    setTotalEnqueued(0);
    setTotalProcessed(0);
    setDlqCount(0);
    msgIdCounter.current = 1;
    setWorkers([
      { id: 1, busy: false, currentTask: null },
      { id: 2, busy: false, currentTask: null },
      { id: 3, busy: false, currentTask: null }
    ]);
  };

  useEffect(() => {
    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, []);

  return (
    <div className="sim-box" style={{ margin: '32px 0' }}>
      <div className="sim-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <button className="btn btn-primary btn-sm" onClick={() => enqueue()}>
          Enqueue 1 Message
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleBurst}>
          Burst Traffic (10 Msgs)
        </button>
        <button
          className={`btn btn-sm ${isAutoRunning ? 'btn-primary' : 'btn-secondary'}`}
          onClick={toggleAuto}
        >
          {isAutoRunning ? 'Stop Continuous Traffic' : 'Start Continuous Traffic (4/s)'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleReset} style={{ marginLeft: 'auto' }}>
          Reset
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0', fontSize: '13px' }}>
        <label>Worker Processing Duration:</label>
        <input
          type="range"
          min="100"
          max="2000"
          step="100"
          value={processDuration}
          onChange={(e) => setProcessDuration(parseInt(e.target.value, 10))}
        />
        <span style={{ fontFamily: 'var(--font-mono)' }}>{processDuration}ms</span>
      </div>

      {/* Metrics Row */}
      <div className="queue-metrics-grid">
        <div style={{ background: 'var(--color-surface-soft)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>QUEUE DEPTH</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: queue.length > 12 ? 'var(--color-error)' : 'inherit' }}>
            {queue.length} msgs
          </div>
        </div>
        <div style={{ background: 'var(--color-surface-soft)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>TOTAL INGESTED</div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>{totalEnqueued}</div>
        </div>
        <div style={{ background: 'var(--color-surface-soft)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>PROCESSED OK</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-success)' }}>{totalProcessed}</div>
        </div>
        <div style={{ background: 'var(--color-surface-soft)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>DLQ DROPPED</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: dlqCount > 0 ? 'var(--color-error)' : 'var(--color-muted)' }}>
            {dlqCount}
          </div>
        </div>
      </div>

      {/* Visual Queue Track */}
      <div
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: '8px',
          padding: '12px',
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          marginBottom: '20px'
        }}
      >
        {queue.length === 0 ? (
          <div style={{ color: 'var(--color-muted)', fontSize: '13px', margin: 'auto' }}>
            Queue Empty &mdash; Buffer Ready
          </div>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'var(--color-surface-dark)',
                color: 'var(--color-on-dark)',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              <span>#{item.id} [{item.type}]</span>
              <span style={{ fontSize: '9px', opacity: 0.7 }}>0 retries</span>
            </div>
          ))
        )}
      </div>

      {/* Workers Grid */}
      <div className="queue-workers-grid">
        {workers.map((w) => (
          <div
            key={w.id}
            style={{
              background: 'var(--color-canvas)',
              border: w.busy ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
              borderRadius: '8px',
              padding: '14px',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Worker Pool #{w.id}</span>
              <span
                className={`badge ${w.busy ? 'badge-coral' : 'badge-teal'}`}
                style={{ fontSize: '11px', padding: '2px 6px' }}
              >
                {w.busy ? 'BUSY' : 'IDLE'}
              </span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
              {w.busy && w.currentTask ? `Task #${w.currentTask.id} (${processDuration}ms)` : 'Waiting for messages...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
