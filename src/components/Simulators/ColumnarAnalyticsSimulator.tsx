import React, { useState } from 'react';

type StorageEngine = 'row_oltp' | 'column_olap';
type CompressionMode = 'none' | 'dictionary_rle';
type ExecutionEngine = 'volcano_row_iterator' | 'vectorized_simd';
type IngestionPattern = 'single_row_inserts' | 'micro_batch_buffer';

export const ColumnarAnalyticsSimulator: React.FC = () => {
  const [engine, setEngine] = useState<StorageEngine>('column_olap');
  const [compression, setCompression] = useState<CompressionMode>('dictionary_rle');
  const [execution, setExecution] = useState<ExecutionEngine>('vectorized_simd');
  const [ingestion, setIngestion] = useState<IngestionPattern>('micro_batch_buffer');
  const [granuleFilterActive, setGranuleFilterActive] = useState<boolean>(true);

  // Ingestion parts counter
  const [partsCount, setPartsCount] = useState<number>(12);
  const [isTooManyPartsError, setIsTooManyPartsError] = useState<boolean>(false);
  const [activeLog, setActiveLog] = useState<string>(
    'OLAP cluster initialized: ClickHouse MergeTree engine with 1,000,000 telemetry events.'
  );

  // Base metrics for 1,000,000 events (10 columns, 120 bytes/row total)
  // Query: SELECT country, sum(revenue_cents) FROM events WHERE country = 'US'
  // Only 2 columns required: country (1 byte string/dict), revenue_cents (4 bytes int) = 5 bytes/row
  const totalRows = 1000000;
  const totalGranules = 122; // 1,000,000 / 8,192 ≈ 122 granules

  // Calculate disk I/O scanned
  let diskBytesScannedMb = 0;
  if (engine === 'row_oltp') {
    // Row oriented reads all 120 bytes of every row
    diskBytesScannedMb = 120.0;
  } else {
    // Columnar projection pruning: reads only 2 columns (5 bytes/row uncompressed = 5.0 MB)
    if (compression === 'none') {
      diskBytesScannedMb = granuleFilterActive ? 1.6 : 5.0;
    } else {
      // RLE on country + delta on revenue: 12x compression
      diskBytesScannedMb = granuleFilterActive ? 0.18 : 0.42;
    }
  }

  // Calculate query latency & processing throughput
  let latencyMs = 0;
  let processingThroughputMRowsPerSec = 0;

  if (engine === 'row_oltp') {
    latencyMs = 385; // disk IOPS saturation + row memory deserialization
    processingThroughputMRowsPerSec = 2.6;
  } else {
    if (execution === 'volcano_row_iterator') {
      latencyMs = compression === 'none' ? 48 : 28;
      processingThroughputMRowsPerSec = 18.0;
    } else {
      // Vectorized SIMD execution
      latencyMs = compression === 'none' ? 9 : 3.8;
      processingThroughputMRowsPerSec = 145.0;
    }
  }

  const granulesSkipped = engine === 'column_olap' && granuleFilterActive ? 94 : 0;
  const granulesScanned = totalGranules - granulesSkipped;

  const handleSimulateInsert = (pattern: IngestionPattern) => {
    setIngestion(pattern);
    if (pattern === 'single_row_inserts') {
      const newParts = partsCount + 45;
      setPartsCount(newParts);
      if (newParts > 50) {
        setIsTooManyPartsError(true);
        setActiveLog(
          '❌ DB::Exception: Too many parts in all data parts in table (57 parts > 50 threshold). Merges are failing to keep pace!'
        );
      } else {
        setActiveLog(`[WRITE WARN] 45 individual inserts generated 45 unmerged part directories on disk.`);
      }
    } else {
      setIsTooManyPartsError(false);
      setPartsCount(8);
      setActiveLog(
        `✓ [BATCH WRITE] 50,000 events accumulated in client buffer -> Flushed into 1 single compressed part (data_1_50000). Merges healthy.`
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span className="badge badge-coral">Interactive Architecture Simulator</span>
            <span className="badge" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}>
              Mode: {ingestion === 'micro_batch_buffer' ? 'Micro-Batch Buffer' : 'Single-Row Unbuffered'}
            </span>
          </div>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 600 }}>
            OLAP &amp; Columnar Storage: ClickHouse vs Row OLTP Engine ({totalRows.toLocaleString()} Events)
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleSimulateInsert('single_row_inserts')}
            style={{ fontSize: '13px', padding: '6px 14px', border: '1px solid #d32f2f', color: '#d32f2f' }}
          >
            Insert 1-by-1 (Anti-Pattern) ⚠️
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleSimulateInsert('micro_batch_buffer')}
            style={{ fontSize: '13px', padding: '6px 14px', border: '1px solid #2e7d32', color: '#2e7d32' }}
          >
            Flush Micro-Batch (10k rows) ✓
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--color-body)', fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px' }}>
        Observe why relational databases (PostgreSQL/MySQL) stall on analytical aggregations across 1,000,000 records, while columnar engines (ClickHouse, Parquet, Snowflake) achieve sub-5ms performance using projection pruning, RLE compression, sparse index granule skipping, and SIMD vectorized execution.
      </p>

      {/* Control Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
          background: 'var(--color-card)',
          padding: '16px',
          borderRadius: 'var(--rounded-md)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '6px' }}>
            Storage Layout Architecture
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setEngine('row_oltp');
                setActiveLog('[ENGINE] Switched to Row-Oriented OLTP. Reading 10 columns across all 120-byte tuples.');
              }}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: engine === 'row_oltp' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: engine === 'row_oltp' ? '#ffffff' : 'var(--color-text)',
                fontWeight: engine === 'row_oltp' ? 600 : 400,
              }}
            >
              Row OLTP (Postgres)
            </button>
            <button
              type="button"
              onClick={() => {
                setEngine('column_olap');
                setActiveLog('[ENGINE] Switched to Columnar OLAP. Projection pruning enabled: reading only 2 required columns.');
              }}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: engine === 'column_olap' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: engine === 'column_olap' ? '#ffffff' : 'var(--color-text)',
                fontWeight: engine === 'column_olap' ? 600 : 400,
              }}
            >
              Columnar OLAP (ClickHouse)
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '6px' }}>
            Column Compression
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={engine === 'row_oltp'}
              onClick={() => {
                setCompression('none');
                setActiveLog('[COMPRESSION] Raw uncompressed column byte streams.');
              }}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: compression === 'none' ? 'var(--color-surface)' : 'transparent',
                fontWeight: compression === 'none' ? 600 : 400,
                color: engine === 'row_oltp' ? 'var(--color-muted)' : 'var(--color-text)',
              }}
            >
              Raw Bytes
            </button>
            <button
              type="button"
              disabled={engine === 'row_oltp'}
              onClick={() => {
                setCompression('dictionary_rle');
                setActiveLog('[COMPRESSION] RLE on Country column + Delta on Revenue. 12x reduction in disk size!');
              }}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: compression === 'dictionary_rle' ? '#e8f5e9' : 'transparent',
                color: engine === 'row_oltp' ? 'var(--color-muted)' : '#2e7d32',
                fontWeight: compression === 'dictionary_rle' ? 600 : 400,
              }}
            >
              RLE + Dict (12x) ✓
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '6px' }}>
            CPU Execution Model
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={engine === 'row_oltp'}
              onClick={() => {
                setExecution('volcano_row_iterator');
                setActiveLog('[CPU EXEC] Volcano Iterator: one function call next() per row tuple.');
              }}
              style={{
                flex: 1,
                padding: '7px 8px',
                fontSize: '11px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: execution === 'volcano_row_iterator' ? 'var(--color-surface)' : 'transparent',
                fontWeight: execution === 'volcano_row_iterator' ? 600 : 400,
              }}
            >
              Volcano (Row Iterator)
            </button>
            <button
              type="button"
              disabled={engine === 'row_oltp'}
              onClick={() => {
                setExecution('vectorized_simd');
                setActiveLog('[CPU EXEC] SIMD Vectorized Execution: tight loops on 8,192 row vectors in L1/L2 cache.');
              }}
              style={{
                flex: 1,
                padding: '7px 8px',
                fontSize: '11px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid #2e7d32',
                background: execution === 'vectorized_simd' ? '#e8f5e9' : 'transparent',
                color: '#2e7d32',
                fontWeight: execution === 'vectorized_simd' ? 600 : 400,
              }}
            >
              Vectorized (SIMD) ⚡
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '6px' }}>
            ClickHouse Granule Pruning
          </label>
          <button
            type="button"
            disabled={engine === 'row_oltp'}
            onClick={() => {
              setGranuleFilterActive((prev) => !prev);
              setActiveLog(
                granuleFilterActive
                  ? '[INDEX] Granule filtering disabled: scanning all 122 marks.'
                  : '[INDEX] Granule filtering enabled: binary search on min/max marks in RAM skips 94 granules on disk!'
              );
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              fontSize: '12px',
              borderRadius: 'var(--rounded-md)',
              cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: granuleFilterActive ? 'var(--color-card)' : 'transparent',
              fontWeight: 600,
              color: granuleFilterActive ? '#cc785c' : 'var(--color-muted)',
            }}
          >
            {granuleFilterActive ? '✓ Sparse Index: Skip Granules' : 'Full Scan (All Marks)'}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div style={{ background: 'var(--color-card)', padding: '12px 16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Disk I/O Scanned</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: diskBytesScannedMb > 50 ? '#d32f2f' : '#2e7d32', marginTop: '4px' }}>
            {diskBytesScannedMb.toFixed(2)} MB
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
            {engine === 'row_oltp' ? '120 MB full row scan' : `${((1 - diskBytesScannedMb / 120) * 100).toFixed(1)}% I/O eliminated`}
          </div>
        </div>

        <div style={{ background: 'var(--color-card)', padding: '12px 16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Query Latency</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: latencyMs > 50 ? '#d32f2f' : '#2e7d32', marginTop: '4px' }}>
            {latencyMs} ms
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
            {engine === 'row_oltp' ? 'Disk IOPS thrashing' : `${(385 / latencyMs).toFixed(0)}x speedup vs Postgres`}
          </div>
        </div>

        <div style={{ background: 'var(--color-card)', padding: '12px 16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CPU Processing Rate</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>
            {processingThroughputMRowsPerSec} M rows/s
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
            {execution === 'vectorized_simd' ? 'SIMD vector loop in L1/L2' : 'Iterative function call overhead'}
          </div>
        </div>

        <div style={{ background: 'var(--color-card)', padding: '12px 16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>MergeTree Parts</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: isTooManyPartsError ? '#d32f2f' : '#2e7d32', marginTop: '4px' }}>
            {partsCount} parts {isTooManyPartsError && '⚠️'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
            {isTooManyPartsError ? 'TOO MANY PARTS CRASH' : 'Background merges healthy'}
          </div>
        </div>
      </div>

      {/* Visual Layout Comparison: Row Page vs Column Striping */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Left: Row-Oriented Layout */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: engine === 'row_oltp' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '16px',
            opacity: engine === 'row_oltp' ? 1 : 0.65,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              Row-Oriented Physical Page (PostgreSQL 8 KB Page)
            </h4>
            <span style={{ fontSize: '11px', color: '#d32f2f', fontWeight: 600 }}>
              {engine === 'row_oltp' ? 'ACTIVE SCAN' : 'INACTIVE'}
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--color-body)', margin: '0 0 10px' }}>
            Entire tuple stored contiguously. To read <code>revenue_cents</code>, the disk reader must load all 10 unrequested columns (IP, UserAgent, EventType, etc.) into RAM buffer pool:
          </p>

          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[1, 2, 3].map((rowIdx) => (
              <div
                key={rowIdx}
                style={{
                  background: 'var(--color-card)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  gap: '4px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: 'var(--color-muted)' }}>Row {rowIdx}:</span>
                <span style={{ background: '#ffcdd2', padding: '0 4px', borderRadius: '2px' }}>country:&quot;US&quot;</span>
                <span style={{ background: '#e0e0e0', padding: '0 4px', borderRadius: '2px' }}>user_id:94821</span>
                <span style={{ background: '#e0e0e0', padding: '0 4px', borderRadius: '2px' }}>event:&quot;click&quot;</span>
                <span style={{ background: '#c8e6c9', padding: '0 4px', borderRadius: '2px' }}>rev:2500</span>
                <span style={{ background: '#e0e0e0', padding: '0 4px', borderRadius: '2px' }}>ip:192.168.1.1</span>
                <span style={{ background: '#e0e0e0', padding: '0 4px', borderRadius: '2px' }}>ua:&quot;Mozilla/5.0...&quot;</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#d32f2f' }}>
            ⚠️ 95% of scanned bytes are discarded immediately after deserialization.
          </div>
        </div>

        {/* Right: Columnar Layout & Granules */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: engine === 'column_olap' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '16px',
            opacity: engine === 'column_olap' ? 1 : 0.65,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              Column-Oriented Disk Files (ClickHouse Granule Layout)
            </h4>
            <span style={{ fontSize: '11px', color: '#2e7d32', fontWeight: 600 }}>
              {engine === 'column_olap' ? 'ACTIVE SCAN' : 'INACTIVE'}
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--color-body)', margin: '0 0 10px' }}>
            Each column stored in independent compressed files. Unqueried columns (IP, UserAgent) are NEVER loaded from disk:
          </p>

          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ background: '#e8f5e9', padding: '6px 10px', borderRadius: '4px', border: '1px solid #c8e6c9' }}>
              <span style={{ fontWeight: 700, color: '#2e7d32' }}>country.bin: </span>
              {compression === 'dictionary_rle' ? (
                <span>[&quot;US&quot; x 450000, &quot;DE&quot; x 200000, &quot;JP&quot; x 350000] (RLE Compressed)</span>
              ) : (
                <span>[&quot;US&quot;, &quot;US&quot;, &quot;US&quot;, &quot;DE&quot;, &quot;JP&quot; ...] (Uncompressed raw bytes)</span>
              )}
            </div>

            <div style={{ background: '#e8f5e9', padding: '6px 10px', borderRadius: '4px', border: '1px solid #c8e6c9' }}>
              <span style={{ fontWeight: 700, color: '#2e7d32' }}>revenue_cents.bin: </span>
              {compression === 'dictionary_rle' ? (
                <span>[Delta-Packed Int32: +2500, +0, +1200, +499] (Compressed)</span>
              ) : (
                <span>[2500, 2500, 0, 1200, 499 ...] (Raw 4-byte integers)</span>
              )}
            </div>

            <div style={{ background: '#f5f5f5', padding: '6px 10px', borderRadius: '4px', border: '1px dashed #bdbdbd', color: '#9e9e9e' }}>
              <span>user_agent.bin, ip_address.bin (Skipped completely by projection pruning - 0 bytes read)</span>
            </div>
          </div>

          <div style={{ marginTop: '8px', fontSize: '11px', color: '#2e7d32' }}>
            ✓ Sparse Primary Index (8,192 rows/mark) in RAM scanned {granulesScanned} and skipped {granulesSkipped} of {totalGranules} granules on disk.
          </div>
        </div>
      </div>

      {/* Terminal Log */}
      <div
        style={{
          background: '#181715',
          borderRadius: 'var(--rounded-md)',
          padding: '12px 16px',
          color: '#efe9de',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span style={{ color: '#cc785c', fontWeight: 700 }}>ANALYTICS ENGINE &gt;</span>
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activeLog}
        </span>
      </div>
    </div>
  );
};
