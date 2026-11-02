import React, { useState, useRef, useEffect } from 'react';

interface SnowflakeRecord {
  id: string; // BigInt as string
  binary: string;
  timestampMs: number;
  relativeTimeMs: number;
  workerId: number;
  datacenterId: number;
  sequence: number;
  isDriftHandled?: boolean;
  timeFormatted: string;
}

// Custom Epoch: 2024-01-01 00:00:00 UTC (1704067200000 ms)
const CUSTOM_EPOCH = 1704067200000n;

// Bit allocations
const WORKER_ID_BITS = 5n;
const DATACENTER_ID_BITS = 5n;
const SEQUENCE_BITS = 12n;

const MAX_WORKER_ID = (1n << WORKER_ID_BITS) - 1n; // 31
const MAX_DATACENTER_ID = (1n << DATACENTER_ID_BITS) - 1n; // 31
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095

const WORKER_SHIFT = SEQUENCE_BITS;
const DATACENTER_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS + DATACENTER_ID_BITS;

export const SnowflakeSimulator: React.FC = () => {
  const [datacenterId, setDatacenterId] = useState<number>(1);
  const [workerId, setWorkerId] = useState<number>(7);
  const [records, setRecords] = useState<SnowflakeRecord[]>([]);
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [driftWarning, setDriftWarning] = useState<string | null>(null);
  const [lastSequenceUsed, setLastSequenceUsed] = useState<number>(0);
  const [totalGenerated, setTotalGenerated] = useState<number>(0);

  // Generator internal state
  const lastTimestampRef = useRef<bigint>(-1n);
  const sequenceRef = useRef<bigint>(0n);

  // Helper to format binary representation with leading zeros
  const toBinaryString = (val: bigint, bits: number): string => {
    let s = val.toString(2);
    while (s.length < bits) {
      s = '0' + s;
    }
    return s;
  };

  const getSimulatedNow = (): bigint => {
    const realNow = BigInt(Date.now());
    return realNow + BigInt(clockOffsetMs);
  };

  const generateSingleId = (forceDriftCheck = false): SnowflakeRecord | null => {
    let now = getSimulatedNow();
    let driftHandled = false;

    // Check for clock backward drift (NTP skew)
    if (now < lastTimestampRef.current) {
      const skew = Number(lastTimestampRef.current - now);
      if (skew <= 5) {
        // Small skew: spin-wait until clock catches up
        now = lastTimestampRef.current;
        driftHandled = true;
        setDriftWarning(`Detected minor clock skew (${skew}ms). Auto-aligned sequence to lastTimestamp.`);
      } else {
        // Severe skew: in real systems, throw error or alert
        setDriftWarning(`CRITICAL NTP DRIFT: System clock moved backward by ${skew}ms! Generation halted to prevent ID collision.`);
        return null;
      }
    } else {
      if (driftWarning && !forceDriftCheck) {
        setDriftWarning(null);
      }
    }

    if (now === lastTimestampRef.current) {
      // Same millisecond: increment sequence counter
      sequenceRef.current = (sequenceRef.current + 1n) & MAX_SEQUENCE;
      if (sequenceRef.current === 0n) {
        // Sequence exhausted (4096 in 1 ms) - spin wait for next millisecond
        while (now <= lastTimestampRef.current) {
          now = getSimulatedNow();
        }
      }
    } else {
      // New millisecond: reset sequence counter
      sequenceRef.current = 0n;
    }

    lastTimestampRef.current = now;
    setLastSequenceUsed(Number(sequenceRef.current));

    const timeDiff = now - CUSTOM_EPOCH;
    const dcIdBig = BigInt(datacenterId) & MAX_DATACENTER_ID;
    const wIdBig = BigInt(workerId) & MAX_WORKER_ID;

    // Bitwise assembly of the 64-bit integer
    const id =
      (timeDiff << TIMESTAMP_SHIFT) |
      (dcIdBig << DATACENTER_SHIFT) |
      (wIdBig << WORKER_SHIFT) |
      sequenceRef.current;

    const timestampBin = toBinaryString(timeDiff, 41);
    const dcBin = toBinaryString(dcIdBig, 5);
    const workerBin = toBinaryString(wIdBig, 5);
    const seqBin = toBinaryString(sequenceRef.current, 12);
    const fullBinary = `0${timestampBin}${dcBin}${workerBin}${seqBin}`;

    const dateObj = new Date(Number(now));
    const timeFormatted = `${dateObj.toTimeString().split(' ')[0]}.${String(dateObj.getMilliseconds()).padStart(3, '0')}`;

    const newRecord: SnowflakeRecord = {
      id: id.toString(),
      binary: fullBinary,
      timestampMs: Number(now),
      relativeTimeMs: Number(timeDiff),
      datacenterId,
      workerId,
      sequence: Number(sequenceRef.current),
      isDriftHandled: driftHandled,
      timeFormatted,
    };

    return newRecord;
  };

  const handleGenerateOne = () => {
    const record = generateSingleId();
    if (record) {
      setRecords((prev) => [record, ...prev.slice(0, 19)]);
      setTotalGenerated((c) => c + 1);
    }
  };

  const handleBurst = (count: number) => {
    const newItems: SnowflakeRecord[] = [];
    for (let i = 0; i < count; i++) {
      const rec = generateSingleId();
      if (rec) newItems.push(rec);
    }
    setRecords((prev) => [...newItems.reverse(), ...prev].slice(0, 25));
    setTotalGenerated((c) => c + newItems.length);
  };

  const handleExhaustSequence = () => {
    // Generate 4,100 IDs rapidly to force sequence overflow (>4095) in simulated time
    const newItems: SnowflakeRecord[] = [];
    for (let i = 0; i < 4100; i++) {
      const rec = generateSingleId();
      if (rec) {
        if (i < 5 || i >= 4094) {
          newItems.push(rec);
        }
      }
    }
    setRecords((prev) => [...newItems.reverse(), ...prev].slice(0, 25));
    setTotalGenerated((c) => c + 4100);
  };

  const handleSimulateClockDrift = (driftAmount: number) => {
    setClockOffsetMs((prev) => prev - driftAmount);
    setDriftWarning(`Simulated NTP backward clock step of -${driftAmount}ms!`);
  };

  const handleResetClock = () => {
    setClockOffsetMs(0);
    setDriftWarning(null);
    lastTimestampRef.current = -1n;
    sequenceRef.current = 0n;
  };

  const handleClear = () => {
    setRecords([]);
    setTotalGenerated(0);
    handleResetClock();
  };

  // Generate an initial record on mount
  useEffect(() => {
    const initial = generateSingleId();
    if (initial) {
      setRecords([initial]);
      setTotalGenerated(1);
    }
  }, []);

  const latest = records[0];

  return (
    <div className="card card-cream" style={{ padding: '24px', margin: '32px 0', borderRadius: '12px', border: '1.5px solid var(--color-hairline)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <span className="badge badge-coral" style={{ marginRight: '8px' }}>Interactive Architecture Simulator</span>
          <span className="badge">Twitter Snowflake 64-Bit ID Deconstruction</span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="btn btn-secondary"
          style={{ fontSize: '12px', padding: '4px 10px' }}
        >
          ↺ Reset Generator
        </button>
      </div>

      <p style={{ fontSize: '14px', margin: '0 0 20px', color: 'var(--color-body)' }}>
        Inspect the binary anatomy of distributed Snowflake IDs. Experience how 64-bit integer packing guarantees global uniqueness and chronological B-tree ordering across thousands of independent nodes without central database locks.
      </p>

      {/* Warning banner for clock drift */}
      {driftWarning && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: driftWarning.includes('CRITICAL') ? '#fbe9e7' : '#fff8e1',
            border: `1.5px solid ${driftWarning.includes('CRITICAL') ? '#d32f2f' : '#ffa000'}`,
            color: driftWarning.includes('CRITICAL') ? '#c62828' : '#795548',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          ⚠️ {driftWarning}
          {clockOffsetMs !== 0 && (
            <button
              type="button"
              onClick={handleResetClock}
              className="btn btn-secondary"
              style={{ marginLeft: '12px', padding: '2px 8px', fontSize: '11px' }}
            >
              Restore Hardware Clock
            </button>
          )}
        </div>
      )}

      {/* Node Configuration Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '6px' }}>
            DATACENTER ID (5 BITS: 0–31)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              min={0}
              max={31}
              value={datacenterId}
              onChange={(e) => setDatacenterId(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--color-primary)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', width: '28px' }}>
              {datacenterId}
            </span>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '6px' }}>
            WORKER MACHINE ID (5 BITS: 0–31)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              min={0}
              max={31}
              value={workerId}
              onChange={(e) => setWorkerId(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#1d70b8' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', width: '28px' }}>
              {workerId}
            </span>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '6px' }}>
            GENERATOR METRICS
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
            <span>Seq in Current ms:</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: lastSequenceUsed > 3000 ? 'var(--color-primary)' : 'var(--color-ink)' }}>
              {lastSequenceUsed} / 4095
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginTop: '4px' }}>
            <span>Total Generated:</span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{totalGenerated.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={handleGenerateOne}
          className="btn btn-primary"
          style={{ fontSize: '13px', padding: '8px 16px' }}
        >
          ⚡ Generate 1 ID
        </button>

        <button
          type="button"
          onClick={() => handleBurst(20)}
          className="btn btn-secondary"
          style={{ fontSize: '13px', padding: '8px 14px' }}
        >
          🚀 High-Concurrency Burst (20 IDs)
        </button>

        <button
          type="button"
          onClick={handleExhaustSequence}
          className="btn btn-secondary"
          style={{ fontSize: '13px', padding: '8px 14px' }}
          title="Attempts to produce >4,096 IDs in 1ms to demonstrate sequence rollover"
        >
          🔄 Test Sequence Exhaustion (&gt;4,096/ms)
        </button>

        <button
          type="button"
          onClick={() => handleSimulateClockDrift(3)}
          className="btn btn-secondary"
          style={{ fontSize: '13px', padding: '8px 14px', color: '#c62828' }}
          title="Simulate NTP backward step of 3ms (recoverable via spin-wait)"
        >
          ⏱️ NTP Clock Drift (-3ms)
        </button>

        <button
          type="button"
          onClick={() => handleSimulateClockDrift(20)}
          className="btn btn-secondary"
          style={{ fontSize: '13px', padding: '8px 14px', color: '#b71c1c' }}
          title="Simulate severe backward step of 20ms (safety halt)"
        >
          🚨 Severe NTP Skew (-20ms)
        </button>
      </div>

      {/* Detailed Binary Deconstruction Card */}
      {latest && (
        <div style={{ background: '#181715', color: '#faf9f5', padding: '20px', borderRadius: '10px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', color: '#a0a09e' }}>
              64-BIT INTEGER DECONSTRUCTION
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#a0a09e' }}>DECIMAL:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                {latest.id}
              </span>
            </div>
          </div>

          {/* Visual Bit Segment Color Key */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px', marginBottom: '12px', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#888', borderRadius: '2px' }} />
              <span>Bit 63: Sign (1 bit, 0)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', background: 'var(--color-primary)', borderRadius: '2px' }} />
              <span>Bits 62-22: Milliseconds ({latest.relativeTimeMs}ms)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#ffab00', borderRadius: '2px' }} />
              <span>Bits 21-17: Datacenter ({latest.datacenterId})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#00b0ff', borderRadius: '2px' }} />
              <span>Bits 16-12: Worker ({latest.workerId})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#00e676', borderRadius: '2px' }} />
              <span>Bits 11-0: Sequence ({latest.sequence})</span>
            </div>
          </div>

          {/* Raw Binary Stream */}
          <div
            style={{
              background: '#0d0d0c',
              padding: '12px 14px',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              letterSpacing: '1.2px',
              lineHeight: 1.6,
              wordBreak: 'break-all',
              userSelect: 'all',
              border: '1px solid #2e2d29',
            }}
          >
            <span style={{ color: '#888', fontWeight: 700 }} title="Sign Bit (1 bit)">
              {latest.binary.substring(0, 1)}
            </span>
            <span style={{ color: 'var(--color-primary)' }} title="Timestamp (41 bits)">
              {' ' + latest.binary.substring(1, 42)}
            </span>
            <span style={{ color: '#ffab00' }} title="Datacenter ID (5 bits)">
              {' ' + latest.binary.substring(42, 47)}
            </span>
            <span style={{ color: '#00b0ff' }} title="Worker ID (5 bits)">
              {' ' + latest.binary.substring(47, 52)}
            </span>
            <span style={{ color: '#00e676', fontWeight: 700 }} title="Sequence (12 bits)">
              {' ' + latest.binary.substring(52, 64)}
            </span>
          </div>

          {/* Decoded Field Values Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '14px', fontSize: '12px' }}>
            <div style={{ background: '#21201d', padding: '8px 10px', borderRadius: '6px' }}>
              <div style={{ color: '#a0a09e', fontSize: '10px' }}>TIMESTAMP</div>
              <div style={{ fontWeight: 600 }}>{latest.timeFormatted}</div>
            </div>
            <div style={{ background: '#21201d', padding: '8px 10px', borderRadius: '6px' }}>
              <div style={{ color: '#a0a09e', fontSize: '10px' }}>SINCE EPOCH</div>
              <div style={{ fontWeight: 600 }}>{(latest.relativeTimeMs / 1000).toFixed(1)}s</div>
            </div>
            <div style={{ background: '#21201d', padding: '8px 10px', borderRadius: '6px' }}>
              <div style={{ color: '#a0a09e', fontSize: '10px' }}>DATACENTER</div>
              <div style={{ fontWeight: 600, color: '#ffab00' }}>DC-{latest.datacenterId}</div>
            </div>
            <div style={{ background: '#21201d', padding: '8px 10px', borderRadius: '6px' }}>
              <div style={{ color: '#a0a09e', fontSize: '10px' }}>WORKER ID</div>
              <div style={{ fontWeight: 600, color: '#00b0ff' }}>Node-{latest.workerId}</div>
            </div>
            <div style={{ background: '#21201d', padding: '8px 10px', borderRadius: '6px' }}>
              <div style={{ color: '#a0a09e', fontSize: '10px' }}>SEQUENCE</div>
              <div style={{ fontWeight: 600, color: '#00e676' }}>#{latest.sequence}</div>
            </div>
          </div>
        </div>
      )}

      {/* Generated IDs Audit Stream */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--color-hairline)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            Recent Generated IDs Stream ({records.length} shown)
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
            Monotonically increasing &bull; Zero DB coordination
          </span>
        </div>

        <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f5f4f0', color: 'var(--color-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-hairline)' }}>
                <th style={{ padding: '8px 12px' }}>64-Bit Snowflake ID</th>
                <th style={{ padding: '8px 12px' }}>Time (ms)</th>
                <th style={{ padding: '8px 12px' }}>DC / Worker</th>
                <th style={{ padding: '8px 12px' }}>Seq</th>
                <th style={{ padding: '8px 12px' }}>B-Tree Monotonicity</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => {
                const nextOlder = records[idx + 1];
                const isMonotonic = !nextOlder || BigInt(r.id) > BigInt(nextOlder.id);

                return (
                  <tr key={r.id + '-' + idx} style={{ borderBottom: '1px solid #f0eee9' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {r.id}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--color-muted)' }}>
                      {r.timeFormatted}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      DC-{r.datacenterId} / Node-{r.workerId}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>
                      #{r.sequence}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {isMonotonic ? (
                        <span style={{ color: '#2e7d32', fontWeight: 600 }}>✓ Valid Ascending</span>
                      ) : (
                        <span style={{ color: '#c62828', fontWeight: 700 }}>✗ Skew Anomaly</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
