import React, { useState } from 'react';

type DurabilityScheme = 'replication_3x' | 'erasure_8_4' | 'erasure_4_2';

interface ChunkMeta {
  chunkIndex: number;
  type: 'data' | 'parity';
  label: string;
  hash: string;
  sizeMb: number;
  assignedNodeId: number;
}

interface StoredObject {
  id: string;
  fileName: string;
  sizeMb: number;
  chunkSizeMb: number;
  scheme: DurabilityScheme;
  chunks: ChunkMeta[];
  uploadedAt: string;
}

interface StorageNode {
  id: number;
  rack: string;
  zone: string;
  isAlive: boolean;
  storedChunksCount: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'upload' | 'reconstruct' | 'failure' | 'dedup' | 'info';
  message: string;
}

// Generate deterministic pseudo-hash
function fakeSha256(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256-${hex}${seed.slice(0, 4)}`;
}

export const BlobStorageSimulator: React.FC = () => {
  const [scheme, setScheme] = useState<DurabilityScheme>('erasure_8_4');
  const [fileSizeMb, setFileSizeMb] = useState<number>(64);
  const [fileName, setFileName] = useState<string>('video_stadium_tour.mp4');
  const [storedObjects, setStoredObjects] = useState<StoredObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // 12 Storage Nodes distributed across 3 Availability Zones
  const [nodes, setNodes] = useState<StorageNode[]>([
    { id: 1, rack: 'Rack-A1', zone: 'us-east-1a', isAlive: true, storedChunksCount: 0 },
    { id: 2, rack: 'Rack-A2', zone: 'us-east-1a', isAlive: true, storedChunksCount: 0 },
    { id: 3, rack: 'Rack-A3', zone: 'us-east-1a', isAlive: true, storedChunksCount: 0 },
    { id: 4, rack: 'Rack-A4', zone: 'us-east-1a', isAlive: true, storedChunksCount: 0 },
    { id: 5, rack: 'Rack-B1', zone: 'us-east-1b', isAlive: true, storedChunksCount: 0 },
    { id: 6, rack: 'Rack-B2', zone: 'us-east-1b', isAlive: true, storedChunksCount: 0 },
    { id: 7, rack: 'Rack-B3', zone: 'us-east-1b', isAlive: true, storedChunksCount: 0 },
    { id: 8, rack: 'Rack-B4', zone: 'us-east-1b', isAlive: true, storedChunksCount: 0 },
    { id: 9, rack: 'Rack-C1', zone: 'us-east-1c', isAlive: true, storedChunksCount: 0 },
    { id: 10, rack: 'Rack-C2', zone: 'us-east-1c', isAlive: true, storedChunksCount: 0 },
    { id: 11, rack: 'Rack-C3', zone: 'us-east-1c', isAlive: true, storedChunksCount: 0 },
    { id: 12, rack: 'Rack-C4', zone: 'us-east-1c', isAlive: true, storedChunksCount: 0 },
  ]);

  const [reconstructionStatus, setReconstructionStatus] = useState<{
    success: boolean;
    message: string;
    survivingCount: number;
    neededCount: number;
    details: string[];
  } | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: '00:00:00',
      type: 'info',
      message: 'S3-compatible Object Storage cluster online. 12 storage nodes across 3 Availability Zones.',
    },
  ]);

  const addLog = (type: LogEntry['type'], message: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [
      { id: Math.random().toString(36).substring(2, 9), timestamp: time, type, message },
      ...prev.slice(0, 19),
    ]);
  };

  const handleUpload = () => {
    if (!fileName.trim()) return;

    // Check for Content-Addressable Storage (CAS) Deduplication
    const existing = storedObjects.find((obj) => obj.fileName === fileName.trim() && obj.sizeMb === fileSizeMb);
    if (existing) {
      addLog(
        'dedup',
        `CAS Deduplication: File "${fileName}" matches existing content hash. Pointer created in Metadata Plane (0 new disk bytes written)!`
      );
      setSelectedObjectId(existing.id);
      return;
    }

    const objectId = `obj-${Date.now().toString().slice(-4)}`;
    const chunks: ChunkMeta[] = [];

    if (scheme === 'replication_3x') {
      // 3x Replication: 1 data chunk replicated across 3 nodes
      const chunkHash = fakeSha256(`${fileName}-c0`);
      chunks.push({ chunkIndex: 0, type: 'data', label: 'Chunk 0 (Copy A)', hash: chunkHash, sizeMb: fileSizeMb, assignedNodeId: 1 });
      chunks.push({ chunkIndex: 0, type: 'data', label: 'Chunk 0 (Copy B)', hash: chunkHash, sizeMb: fileSizeMb, assignedNodeId: 5 });
      chunks.push({ chunkIndex: 0, type: 'data', label: 'Chunk 0 (Copy C)', hash: chunkHash, sizeMb: fileSizeMb, assignedNodeId: 9 });
    } else if (scheme === 'erasure_4_2') {
      // 4 Data + 2 Parity (survives 2 failures, 1.5x overhead)
      const dataChunkSize = fileSizeMb / 4;
      for (let i = 0; i < 4; i++) {
        chunks.push({
          chunkIndex: i,
          type: 'data',
          label: `Data D${i + 1}`,
          hash: fakeSha256(`${fileName}-d${i}`),
          sizeMb: dataChunkSize,
          assignedNodeId: (i % 12) + 1,
        });
      }
      for (let p = 0; p < 2; p++) {
        chunks.push({
          chunkIndex: 4 + p,
          type: 'parity',
          label: `Parity P${p + 1}`,
          hash: fakeSha256(`${fileName}-p${p}`),
          sizeMb: dataChunkSize,
          assignedNodeId: ((4 + p) % 12) + 1,
        });
      }
    } else {
      // 8 Data + 4 Parity (Reed-Solomon RS(8,4))
      // Survives 4 node/rack failures, 1.5x overhead
      const dataChunkSize = fileSizeMb / 8;
      for (let i = 0; i < 8; i++) {
        chunks.push({
          chunkIndex: i,
          type: 'data',
          label: `Data D${i + 1}`,
          hash: fakeSha256(`${fileName}-d${i}`),
          sizeMb: dataChunkSize,
          assignedNodeId: (i % 12) + 1,
        });
      }
      for (let p = 0; p < 4; p++) {
        chunks.push({
          chunkIndex: 8 + p,
          type: 'parity',
          label: `Parity P${p + 1}`,
          hash: fakeSha256(`${fileName}-p${p}`),
          sizeMb: dataChunkSize,
          assignedNodeId: ((8 + p) % 12) + 1,
        });
      }
    }

    const newObj: StoredObject = {
      id: objectId,
      fileName,
      sizeMb: fileSizeMb,
      chunkSizeMb: scheme === 'replication_3x' ? fileSizeMb : fileSizeMb / (scheme === 'erasure_4_2' ? 4 : 8),
      scheme,
      chunks,
      uploadedAt: new Date().toTimeString().split(' ')[0],
    };

    setStoredObjects((prev) => [newObj, ...prev]);
    setSelectedObjectId(objectId);

    // Update node chunk counts
    setNodes((prev) =>
      prev.map((node) => {
        const assigned = chunks.filter((c) => c.assignedNodeId === node.id).length;
        return { ...node, storedChunksCount: node.storedChunksCount + assigned };
      })
    );

    const overhead = scheme === 'replication_3x' ? '300% (3x cost)' : '150% (1.5x cost)';
    addLog(
      'upload',
      `Uploaded "${fileName}" (${fileSizeMb} MB) with ${scheme}. Created ${chunks.length} chunks distributed across nodes. Storage overhead: ${overhead}.`
    );
  };

  const toggleNodeState = (nodeId: number) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          const nextState = !n.isAlive;
          addLog(
            'failure',
            `Storage Node ${n.id} (${n.zone} / ${n.rack}) marked as ${nextState ? 'ONLINE (Healthy)' : 'DEAD (Disk Crash)'}.`
          );
          return { ...n, isAlive: nextState };
        }
        return n;
      })
    );
  };

  const handleTestReadAndReconstruct = () => {
    const activeObj = storedObjects.find((o) => o.id === selectedObjectId) || storedObjects[0];
    if (!activeObj) {
      addLog('info', 'Please upload an object first.');
      return;
    }

    const details: string[] = [];
    const aliveNodeIds = new Set(nodes.filter((n) => n.isAlive).map((n) => n.id));

    const survivingChunks = activeObj.chunks.filter((c) => aliveNodeIds.has(c.assignedNodeId));
    const lostChunks = activeObj.chunks.filter((c) => !aliveNodeIds.has(c.assignedNodeId));

    details.push(`Target Object: "${activeObj.fileName}" (${activeObj.scheme})`);
    details.push(`Total Chunks: ${activeObj.chunks.length} | Available: ${survivingChunks.length} | Lost: ${lostChunks.length}`);

    if (activeObj.scheme === 'replication_3x') {
      const anyCopyAlive = survivingChunks.length > 0;
      if (anyCopyAlive) {
        setReconstructionStatus({
          success: true,
          message: 'Read SUCCESS via surviving replica.',
          survivingCount: survivingChunks.length,
          neededCount: 1,
          details: [...details, `✓ Read served from Node ${survivingChunks[0].assignedNodeId}.`],
        });
        addLog('reconstruct', `Object "${activeObj.fileName}" read successfully from surviving replica.`);
      } else {
        setReconstructionStatus({
          success: false,
          message: 'DATA LOSS: All 3 replicas destroyed across all availability zones!',
          survivingCount: 0,
          neededCount: 1,
          details: [...details, `✗ Catastrophic loss: all 3 storage nodes holding chunk copies failed.`],
        });
        addLog('failure', `Catastrophic data loss on "${activeObj.fileName}" (all replicas offline).`);
      }
      return;
    }

    // Erasure Coding Evaluation
    const requiredDataCount = activeObj.scheme === 'erasure_4_2' ? 4 : 8;
    const maxFailuresAllowed = activeObj.scheme === 'erasure_4_2' ? 2 : 4;

    if (survivingChunks.length >= requiredDataCount) {
      details.push(`Surviving chunks (${survivingChunks.length}) >= required data shards (${requiredDataCount}).`);
      if (lostChunks.length > 0) {
        details.push(`Galois Field RS Matrix Math: Reconstructing ${lostChunks.length} lost shards [${lostChunks.map((c) => c.label).join(', ')}] in background!`);
      } else {
        details.push(`All original shards healthy. No reconstruction needed.`);
      }

      setReconstructionStatus({
        success: true,
        message: `Read SUCCESS! Object fully intact (survived ${lostChunks.length} node failures).`,
        survivingCount: survivingChunks.length,
        neededCount: requiredDataCount,
        details,
      });
      addLog(
        'reconstruct',
        `Object "${activeObj.fileName}" read and reconstructed successfully using ${survivingChunks.length} surviving shards.`
      );
    } else {
      details.push(`FATAL: Only ${survivingChunks.length} chunks survived, but ${requiredDataCount} are required to solve the linear equations!`);
      setReconstructionStatus({
        success: false,
        message: `DATA CORRUPTED: Lost ${lostChunks.length} nodes (maximum fault tolerance was ${maxFailuresAllowed} nodes)!`,
        survivingCount: survivingChunks.length,
        neededCount: requiredDataCount,
        details,
      });
      addLog(
        'failure',
        `Unrecoverable error on "${activeObj.fileName}": ${lostChunks.length} nodes offline exceeded fault tolerance threshold (${maxFailuresAllowed}).`
      );
    }
  };

  const handleResetNodes = () => {
    setNodes((prev) => prev.map((n) => ({ ...n, isAlive: true })));
    setReconstructionStatus(null);
    addLog('info', 'All 12 storage nodes restored to healthy online state.');
  };

  const currentObj = storedObjects.find((o) => o.id === selectedObjectId) || storedObjects[0];

  return (
    <div className="card card-cream" style={{ padding: '24px', margin: '32px 0', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Interactive Architecture Simulator</span>
          <h3 style={{ margin: '4px 0 8px' }}>Distributed Object Storage: Chunking &amp; Reed-Solomon Erasure Coding</h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-ink-muted)' }}>
            Examine how S3, MinIO, and Ceph partition large objects into content-addressed chunks and eliminate 3x replication cost using Galois Field erasure coding.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={handleResetNodes}
          >
            ↺ Restore All Nodes
          </button>
        </div>
      </div>

      {/* Upload Controls */}
      <div style={{ background: '#faf9f5', border: '1px solid var(--color-hairline)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>1. Ingress &amp; Storage Configuration</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Object Name</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-hairline)', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Payload Size</label>
            <select
              value={fileSizeMb}
              onChange={(e) => setFileSizeMb(Number(e.target.value))}
              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-hairline)' }}
            >
              <option value={16}>16 MB (Small Media)</option>
              <option value={64}>64 MB (Standard Video)</option>
              <option value={128}>128 MB (High-Res Asset)</option>
              <option value={256}>256 MB (Database Dump)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Durability Architecture</label>
            <select
              value={scheme}
              onChange={(e) => setScheme(e.target.value as DurabilityScheme)}
              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-hairline)' }}
            >
              <option value="erasure_8_4">Reed-Solomon RS(8,4) — 8 Data + 4 Parity (1.5x storage)</option>
              <option value="erasure_4_2">Reed-Solomon RS(4,2) — 4 Data + 2 Parity (1.5x storage)</option>
              <option value="replication_3x">3x Replication — 3 Full Copies (3.0x storage)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '13px' }}
            onClick={handleUpload}
          >
            Upload Object &amp; Chunk
          </button>
          <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
            * Chunks are content-addressed with SHA-256 and mapped to storage nodes.
          </span>
        </div>
      </div>

      {/* Comparison Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>STORAGE OVERHEAD RATIO</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: scheme === 'replication_3x' ? '#ff5252' : '#00c49f', margin: '4px 0' }}>
            {scheme === 'replication_3x' ? '300% (3.0×)' : '150% (1.5×)'}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa' }}>
            {scheme === 'replication_3x' ? '100 GB payload = 300 GB raw disk' : '100 GB payload = 150 GB raw disk (50% savings!)'}
          </div>
        </div>

        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>FAULT TOLERANCE CEILING</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#80d8ff', margin: '4px 0' }}>
            {scheme === 'erasure_8_4' ? '4 Simultaneous Node Failures' : scheme === 'erasure_4_2' ? '2 Node Failures' : '2 Replicas Dead (1 Must Live)'}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa' }}>
            {scheme === 'erasure_8_4' ? 'Any 8 of 12 shards reconstruct 100% of data' : 'Simple replica survival requirement'}
          </div>
        </div>

        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '10px', padding: '14px' }}>
          <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>ESTIMATED DURABILITY SLA</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffd54f', margin: '4px 0' }}>
            99.999999999%
          </div>
          <div style={{ fontSize: '11px', color: '#aaa' }}>
            Eleven 9s across distributed AZ racks
          </div>
        </div>
      </div>

      {/* Storage Nodes Rack Grid */}
      <div style={{ background: '#faf9f5', border: '1px solid var(--color-hairline)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '15px' }}>2. Storage Node Cluster &amp; Failure Simulator</h4>
          <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>Click any node to simulate hardware/chassis failure:</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          {nodes.map((node) => {
            const assignedForActive = currentObj ? currentObj.chunks.filter((c) => c.assignedNodeId === node.id) : [];
            return (
              <div
                key={node.id}
                onClick={() => toggleNodeState(node.id)}
                style={{
                  background: node.isAlive ? '#fff' : '#ffebee',
                  border: `2px solid ${node.isAlive ? '#a5d6a7' : '#ef5350'}`,
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: node.isAlive ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                }}
                title={`Click to toggle failure on Node ${node.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                  <span>N{node.id}</span>
                  <span style={{ color: node.isAlive ? '#2e7d32' : '#c62828', fontWeight: 700 }}>
                    {node.isAlive ? 'ONLINE' : 'DEAD'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: node.isAlive ? '#181715' : '#c62828' }}>
                  {node.rack}
                </div>
                <div style={{ fontSize: '9px', color: '#666', marginBottom: '6px' }}>{node.zone}</div>

                {assignedForActive.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {assignedForActive.map((chunk, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          background: chunk.type === 'parity' ? '#e0f2f1' : '#fff3e0',
                          color: chunk.type === 'parity' ? '#00695c' : '#e65100',
                          fontWeight: 600,
                          border: `1px solid ${chunk.type === 'parity' ? '#b2dfdb' : '#ffe0b2'}`,
                        }}
                      >
                        {chunk.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '10px', color: '#aaa' }}>No chunks</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '13px' }}
            onClick={handleTestReadAndReconstruct}
          >
            ⚡ Test Read &amp; Reconstruct Object
          </button>
          <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
            Active Object: <strong>{currentObj ? `${currentObj.fileName} (${currentObj.scheme})` : 'None'}</strong>
          </div>
        </div>

        {reconstructionStatus && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: reconstructionStatus.success ? '#e8f5e9' : '#ffebee',
              border: `1px solid ${reconstructionStatus.success ? '#a5d6a7' : '#ef5350'}`,
            }}
          >
            <div style={{ fontWeight: 700, color: reconstructionStatus.success ? '#2e7d32' : '#c62828', fontSize: '14px', marginBottom: '6px' }}>
              {reconstructionStatus.message}
            </div>
            <div style={{ fontSize: '12px', color: '#444' }}>
              {reconstructionStatus.details.map((d, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-mono)', margin: '3px 0' }}>{d}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cluster Event Log */}
      <div style={{ background: '#181715', borderRadius: '10px', padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
        <div style={{ color: 'var(--color-primary)', fontWeight: 700, marginBottom: '6px', fontSize: '11px' }}>
          // OBJECT STORAGE CLUSTER EVENT TRACE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
          {logs.map((log) => (
            <div key={log.id} style={{ color: log.type === 'failure' ? '#ff5252' : log.type === 'reconstruct' ? '#00c49f' : log.type === 'dedup' ? '#ffd54f' : '#faf9f5' }}>
              <span style={{ color: '#888' }}>[{log.timestamp}]</span> [{log.type.toUpperCase()}] {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
