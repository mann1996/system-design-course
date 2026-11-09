import React, { useState } from 'react';

type SemanticMode = 'at_least_once' | 'exactly_once';

interface CheckpointSnapshot {
  id: number;
  timestamp: string;
  sourceOffset: number;
  rocksDbState: Record<string, number>;
  status: 'in_progress' | 'completed' | 'aborted';
}

export const StatefulCheckpointSimulator: React.FC = () => {
  const [semanticMode, setSemanticMode] = useState<SemanticMode>('exactly_once');
  const [kafkaOffset, setKafkaOffset] = useState<number>(1040);
  const [activeTxnBuffer, setActiveTxnBuffer] = useState<{ id: string; amount: number; user: string }[]>([]);
  const [committedBankLedger, setCommittedBankLedger] = useState<{ id: string; amount: number; user: string }[]>([
    { id: 'TXN-1038', user: 'user_alice', amount: 100 },
    { id: 'TXN-1039', user: 'user_bob', amount: 250 },
  ]);

  // Local embedded RocksDB state (user running account balance)
  const [rocksDbState, setRocksDbState] = useState<Record<string, number>>({
    user_alice: 100,
    user_bob: 250,
  });

  const [checkpointId, setCheckpointId] = useState<number>(1);
  const [checkpoints, setCheckpoints] = useState<CheckpointSnapshot[]>([
    {
      id: 1,
      timestamp: '12:00:00 UTC',
      sourceOffset: 1039,
      rocksDbState: { user_alice: 100, user_bob: 250 },
      status: 'completed',
    },
  ]);

  const [preCommittedTxn, setPreCommittedTxn] = useState<{ id: string; amount: number; user: string }[]>([]);
  const [activeLog, setActiveLog] = useState<string>(
    'Streaming Engine Online. State Backend: Embedded RocksDB (local NVMe). Sink: Two-Phase Commit (2PC) Transactional Sink.'
  );

  // Ingest transaction event
  const handleIngestTransaction = (user: string, amount: number) => {
    const nextOffset = kafkaOffset + 1;
    const txnId = `TXN-${nextOffset}`;

    setKafkaOffset(nextOffset);

    // Update in-flight operator state
    const newTxn = { id: txnId, user, amount };
    setActiveTxnBuffer((prev) => [...prev, newTxn]);

    // Update RocksDB state immediately in local operator
    setRocksDbState((prev) => ({
      ...prev,
      [user]: (prev[user] || 0) + amount,
    }));

    setActiveLog(
      `📥 [INGEST ${txnId}] Consumed from Kafka offset ${nextOffset}. Local RocksDB updated (${user} += $${amount}). Appended to 2PC pre-commit buffer.`
    );
  };

  // Trigger Chandy-Lamport / ABS Checkpoint Barrier
  const handleTriggerCheckpoint = () => {
    const nextCpId = checkpointId + 1;
    setCheckpointId(nextCpId);

    const snapshotState = { ...rocksDbState };
    const currentOffset = kafkaOffset;

    setActiveLog(
      `🚩 [BARRIER INJECTED] Checkpoint Barrier #${nextCpId} dispatched at Kafka offset ${currentOffset}. Operators aligning barriers...`
    );

    // Phase 1: Pre-commit in 2PC sink
    const pendingToPrecommit = [...activeTxnBuffer];
    setPreCommittedTxn(pendingToPrecommit);
    setActiveTxnBuffer([]);

    setTimeout(() => {
      // Phase 2: Asynchronous upload to remote durable storage (S3)
      const newSnapshot: CheckpointSnapshot = {
        id: nextCpId,
        timestamp: new Date().toLocaleTimeString(),
        sourceOffset: currentOffset,
        rocksDbState: snapshotState,
        status: 'completed',
      };

      setCheckpoints((prev) => [newSnapshot, ...prev]);

      // Phase 3: Coordinator confirms global checkpoint -> Sink executes commit()
      setCommittedBankLedger((prev) => [...prev, ...pendingToPrecommit]);
      setPreCommittedTxn([]);

      setActiveLog(
        `✅ [CHECKPOINT #${nextCpId} COMMITTED] Chandy-Lamport barrier reached sink. RocksDB state flushed to S3. 2PC Sink executed commit() on ${pendingToPrecommit.length} transactions.`
      );
    }, 600);
  };

  // Simulate Worker Node Crash
  const handleCrashWorker = () => {
    if (semanticMode === 'at_least_once') {
      // In naive at-least-once:
      // Offset was committed at consumer level arbitrarily or uncoordinated with sink.
      // Suppose operator crashes with uncheckpointed buffer:
      // It restarts, re-reads Kafka from offset 1039, re-executes all transactions, but sink already wrote some!
      // This causes duplicate charges!
      const duplicateTxn = {
        id: `TXN-DUP-${kafkaOffset}`,
        user: 'user_alice',
        amount: 150,
      };

      setCommittedBankLedger((prev) => [...prev, duplicateTxn]);
      setActiveLog(
        `💥 [WORKER CRASH - AT-LEAST-ONCE ANOMALY] Worker crashed without 2PC coordination! Consumer re-read uncommitted messages without rollback. SINK RECORDED DUPLICATE TRANSACTION (${duplicateTxn.id})! Alice was charged twice!`
      );
    } else {
      // In Exactly-Once with 2PC:
      // Worker aborts uncommitted pre-commit transactions
      // Restores RocksDB state from latest successful S3 checkpoint
      const latestCp = checkpoints[0];
      if (!latestCp) return;

      setKafkaOffset(latestCp.sourceOffset);
      setRocksDbState(latestCp.rocksDbState);
      setActiveTxnBuffer([]);
      setPreCommittedTxn([]);

      setActiveLog(
        `🛡️ [WORKER CRASH - EXACTLY-ONCE RECOVERY] Worker crashed! 2PC coordinator aborted uncommitted preCommit buffer. Rewound Kafka to Checkpoint #${latestCp.id} (Offset ${latestCp.sourceOffset}). RocksDB restored from S3 snapshot. ZERO duplicates, ZERO lost state!`
      );
    }
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
            Interactive State &amp; Exactly-Once Simulator
          </span>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 600 }}>
            Chandy-Lamport Checkpointing &amp; Two-Phase Commit Sinks
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTriggerCheckpoint}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            📸 Inject Checkpoint Barrier
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCrashWorker}
            style={{ fontSize: '13px', padding: '6px 14px', color: '#e03131' }}
          >
            💥 Crash Worker Node
          </button>
        </div>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Experience how distributed stream processors guarantee <strong>End-to-End Exactly-Once Semantics</strong>. Contrast naive at-least-once duplicate writes against <strong>Asynchronous Barrier Snapshotting (ABS)</strong> coordinated with <strong>Two-Phase Commit (2PC) Sinks</strong>.
      </p>

      {/* Semantic Mode Toggle */}
      <div
        style={{
          background: 'var(--color-surface-subtle, #f5f2eb)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--rounded-md)',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Fault Tolerance Semantics:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn ${semanticMode === 'exactly_once' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSemanticMode('exactly_once')}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              🛡️ End-to-End Exactly-Once (2PC + ABS)
            </button>
            <button
              type="button"
              className={`btn ${semanticMode === 'at_least_once' ? 'btn-secondary' : 'btn-secondary'}`}
              onClick={() => setSemanticMode('at_least_once')}
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                border: semanticMode === 'at_least_once' ? '2px solid #e03131' : undefined,
                color: semanticMode === 'at_least_once' ? '#e03131' : undefined,
              }}
            >
              ⚠️ Naive At-Least-Once (Duplicate Risk)
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Inject Stream Payments:
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleIngestTransaction('user_alice', 50)}
              style={{ fontSize: '11px', padding: '5px 10px' }}
            >
              + Alice $50
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleIngestTransaction('user_bob', 120)}
              style={{ fontSize: '11px', padding: '5px 10px' }}
            >
              + Bob $120
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleIngestTransaction('user_charlie', 300)}
              style={{ fontSize: '11px', padding: '5px 10px' }}
            >
              + Charlie $300
            </button>
          </div>
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
        <span style={{ color: '#cc785c', fontWeight: 600 }}>[STREAM_COORDINATOR]:</span> {activeLog}
      </div>

      {/* Streaming DAG Pipeline Flow */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Stage 1: Kafka Source */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="badge">1. Kafka Source Partition</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '12px' }}>
              Offset: {kafkaOffset}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
            Partition: <code>payments.v1 (Partition 0)</code>. Monotonic log offset advances with every incoming event.
          </p>
          <div style={{ background: '#f8f9fa', padding: '8px 12px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>
            Last Checkpointed Offset: <strong>{checkpoints[0]?.sourceOffset ?? 1039}</strong>
          </div>
        </div>

        {/* Stage 2: Stateful Operator (RocksDB) */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid #cc785c',
            borderRadius: 'var(--rounded-md)',
            padding: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="badge badge-coral">2. Stateful Operator (RocksDB)</span>
            <span style={{ fontSize: '11px', color: '#cc785c', fontWeight: 600 }}>Local NVMe</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
            Embedded LSM-tree maintains cumulative running balances in local process storage:
          </p>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '8px 12px', fontSize: '11px', fontFamily: 'monospace' }}>
            {Object.entries(rocksDbState).map(([u, bal]) => (
              <div key={u} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>{u}:</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>${bal}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stage 3: Two-Phase Commit Sink */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="badge badge-teal">3. Transactional Sink (2PC)</span>
            <span style={{ fontSize: '11px', color: '#2a9d8f', fontWeight: 600 }}>External Bank API</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
            Two-Phase Commit isolates uncommitted transactions until Checkpoint Barrier succeeds:
          </p>
          <div style={{ fontSize: '11px', fontFamily: 'monospace' }}>
            <div style={{ color: '#b25e00', marginBottom: '4px' }}>
              Pending Pre-Commit Buffer: <strong>{activeTxnBuffer.length + preCommittedTxn.length} items</strong>
            </div>
            <div style={{ color: '#2b8a3e' }}>
              Committed Settlements: <strong>{committedBankLedger.length} items</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Durable Checkpoints Storage (S3 / MinIO) Table */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 10px' }}>
          Remote Durable Checkpoint Store (Amazon S3 / MinIO)
        </h4>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Checkpoint ID</th>
                <th>Snapshot Timestamp</th>
                <th>Aligned Kafka Offset</th>
                <th>RocksDB Snapshot State</th>
                <th>Coordinator Status</th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.map((cp) => (
                <tr key={cp.id}>
                  <td><code>Barrier #{cp.id}</code></td>
                  <td>{cp.timestamp}</td>
                  <td><code>Offset {cp.sourceOffset}</code></td>
                  <td>
                    <code style={{ fontSize: '11px' }}>
                      {JSON.stringify(cp.rocksDbState)}
                    </code>
                  </td>
                  <td>
                    <span className="badge badge-teal">
                      ✓ {cp.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Finalized External Ledger */}
      <div>
        <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 10px' }}>
          External Banking Ledger (Downstream Finalized Writes)
        </h4>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>User Account</th>
                <th>Settled Amount</th>
                <th>Integrity Audit</th>
              </tr>
            </thead>
            <tbody>
              {committedBankLedger.slice(-6).map((tx, idx) => (
                <tr key={`${tx.id}-${idx}`}>
                  <td><code>{tx.id}</code></td>
                  <td><code>{tx.user}</code></td>
                  <td><strong>${tx.amount}</strong></td>
                  <td>
                    {tx.id.includes('DUP') ? (
                      <span style={{ color: '#c92a2a', fontWeight: 700 }}>
                        🚨 PHANTOM DUPLICATE (Double Charged)
                      </span>
                    ) : (
                      <span style={{ color: '#2b8a3e', fontWeight: 600 }}>
                        ✓ Validated Exactly-Once
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
