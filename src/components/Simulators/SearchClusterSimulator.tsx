import React, { useState } from 'react';

interface IndexedDoc {
  id: string;
  tenantId: string;
  title: string;
  category: string;
  price: number;
  tokens: string[];
}

interface PostingsEntry {
  docId: string;
  tf: number;
  positions: number[];
}

interface InvertedIndex {
  [term: string]: PostingsEntry[];
}

type QueryRoutingMode = 'scatter_gather' | 'targeted_routing';
type PaginationMode = 'standard_from_size' | 'search_after_cursor';

export const SearchClusterSimulator: React.FC = () => {
  const [documents, setDocuments] = useState<IndexedDoc[]>([
    {
      id: 'doc-101',
      tenantId: 'merchant_alpha',
      title: 'Noise Cancelling Wireless Headphones',
      category: 'Electronics',
      price: 249,
      tokens: ['noise', 'cancelling', 'wireless', 'headphones'],
    },
    {
      id: 'doc-102',
      tenantId: 'merchant_alpha',
      title: 'Ergonomic Mechanical Keyboard Wireless',
      category: 'Electronics',
      price: 129,
      tokens: ['ergonomic', 'mechanical', 'keyboard', 'wireless'],
    },
    {
      id: 'doc-103',
      tenantId: 'merchant_beta',
      title: 'Wireless Gaming Mouse Ultra Lightweight',
      category: 'Electronics',
      price: 79,
      tokens: ['wireless', 'gaming', 'mouse', 'ultra', 'lightweight'],
    },
    {
      id: 'doc-104',
      tenantId: 'merchant_beta',
      title: 'Noise Isolating Earbuds Wired',
      category: 'Audio',
      price: 49,
      tokens: ['noise', 'isolating', 'earbuds', 'wired'],
    },
    {
      id: 'doc-105',
      tenantId: 'merchant_gamma',
      title: 'Mechanical Office Chair Lumbar Support',
      category: 'Furniture',
      price: 320,
      tokens: ['mechanical', 'office', 'chair', 'lumbar', 'support'],
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('wireless mechanical');
  const [routingMode, setRoutingMode] = useState<QueryRoutingMode>('scatter_gather');
  const [selectedTenant, setSelectedTenant] = useState('merchant_alpha');
  const [paginationMode, setPaginationMode] = useState<PaginationMode>('standard_from_size');
  const [pageOffset, setPageOffset] = useState<number>(0);
  const [segmentsCount, setSegmentsCount] = useState<number>(3);
  const [softDeletedDocs, setSoftDeletedDocs] = useState<number>(2);
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [activeLog, setActiveLog] = useState<string>('Cluster healthy: 3 data nodes online, 3 primary shards active.');

  // Shard hashing helper
  const getShardForDoc = (docId: string, tenantId: string, useRouting: boolean): number => {
    const key = useRouting ? tenantId : docId;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 3; // Shards 0, 1, 2
  };

  // Build Inverted Index dynamically
  const invertedIndex: InvertedIndex = {};
  documents.forEach((doc) => {
    doc.tokens.forEach((term, pos) => {
      if (!invertedIndex[term]) {
        invertedIndex[term] = [];
      }
      const existing = invertedIndex[term].find((p) => p.docId === doc.id);
      if (existing) {
        existing.tf += 1;
        existing.positions.push(pos);
      } else {
        invertedIndex[term].push({ docId: doc.id, tf: 1, positions: [pos] });
      }
    });
  });

  // Terms list sorted
  const sortedTerms = Object.keys(invertedIndex).sort();

  // Compute shards
  const shards: { id: number; node: string; docs: IndexedDoc[] }[] = [
    { id: 0, node: 'DataNode-1', docs: [] },
    { id: 1, node: 'DataNode-2', docs: [] },
    { id: 2, node: 'DataNode-3', docs: [] },
  ];

  documents.forEach((doc) => {
    const shardIdx = getShardForDoc(doc.id, doc.tenantId, routingMode === 'targeted_routing');
    shards[shardIdx].docs.push(doc);
  });

  // Run Query
  const queryTokens = searchQuery
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const targetShard = routingMode === 'targeted_routing'
    ? getShardForDoc('sample', selectedTenant, true)
    : null;

  // Search matching
  const matchingDocsWithScores: { doc: IndexedDoc; score: number; shardId: number }[] = [];

  documents.forEach((doc) => {
    const docShard = getShardForDoc(doc.id, doc.tenantId, routingMode === 'targeted_routing');
    if (routingMode === 'targeted_routing' && docShard !== targetShard) {
      return; // skipped by routing
    }

    let matchCount = 0;
    queryTokens.forEach((qt) => {
      if (doc.tokens.includes(qt)) {
        matchCount++;
      }
    });

    if (matchCount > 0) {
      // Simple BM25 approximation
      const score = Number((matchCount * 1.5 + (doc.tokens.length * 0.1)).toFixed(2));
      matchingDocsWithScores.push({ doc, score, shardId: docShard });
    }
  });

  matchingDocsWithScores.sort((a, b) => b.score - a.score);

  // Performance metrics based on modes
  const nodesContacted = routingMode === 'scatter_gather' ? 3 : 1;
  const shardsScanned = routingMode === 'scatter_gather' ? 3 : 1;
  const estimatedLatencyMs = routingMode === 'scatter_gather'
    ? 24 + (paginationMode === 'standard_from_size' && pageOffset > 1000 ? 140 : 8)
    : 4 + (paginationMode === 'standard_from_size' && pageOffset > 1000 ? 45 : 2);

  const coordinatorHeapAllocMb = paginationMode === 'standard_from_size' && pageOffset > 1000
    ? (pageOffset * 0.0048).toFixed(1)
    : '0.4';

  const handleIndexSample = () => {
    const samplePool = [
      {
        id: `doc-${100 + documents.length + 1}`,
        tenantId: selectedTenant,
        title: 'Wireless Fast Charging Pad Qi2',
        category: 'Accessories',
        price: 39,
        tokens: ['wireless', 'fast', 'charging', 'pad'],
      },
      {
        id: `doc-${100 + documents.length + 1}`,
        tenantId: selectedTenant,
        title: 'Mechanical Keycaps Custom PBT Double-Shot',
        category: 'Accessories',
        price: 55,
        tokens: ['mechanical', 'keycaps', 'custom', 'double-shot'],
      },
    ];

    const newDoc = samplePool[documents.length % samplePool.length];
    setDocuments((prev) => [...prev, newDoc]);
    setSegmentsCount((prev) => prev + 1);
    setActiveLog(
      `[INDEX] Ingested "${newDoc.title}". Flushed into new in-memory Lucene segment. Total documents: ${documents.length + 1}.`
    );
  };

  const handleSegmentMerge = () => {
    setIsMerging(true);
    setActiveLog('[MERGE] TieredMergePolicy triggered. Compacting immutable segments in background...');
    setTimeout(() => {
      setSegmentsCount(1);
      setSoftDeletedDocs(0);
      setIsMerging(false);
      setActiveLog('[MERGE COMPLETE] 3 segments merged into 1 optimized segment. Reclaimed 2 soft-deleted documents.');
    }, 1200);
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
          <span className="badge badge-coral" style={{ marginRight: '8px' }}>Interactive Engine Simulator</span>
          <h3 style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: 600 }}>
            Distributed Search: Inverted Index &amp; Shard Routing
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleIndexSample}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            + Index New Document
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSegmentMerge}
            disabled={isMerging || segmentsCount <= 1}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            {isMerging ? 'Merging Segments...' : '⚡ Trigger Segment Merge'}
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--color-body)', fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px' }}>
        Simulate how distributed search engines (Elasticsearch, OpenSearch, Lucene) parse documents into inverted indexes, shard data across cluster nodes, and execute scatter-gather versus routed search queries.
      </p>

      {/* Control Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
            Search Query
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--rounded-md)',
              border: '1px solid var(--color-border)',
              fontFamily: 'inherit',
              fontSize: '14px',
              background: 'var(--color-surface)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '6px' }}>
            Query Routing Architecture
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setRoutingMode('scatter_gather');
                setActiveLog('[QUERY PLAN] Mode: Scatter-Gather. Coordinating node broadcasts to ALL 3 shards.');
              }}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: routingMode === 'scatter_gather' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: routingMode === 'scatter_gather' ? '#ffffff' : 'var(--color-text)',
                fontWeight: routingMode === 'scatter_gather' ? 600 : 400,
              }}
            >
              Scatter-Gather
            </button>
            <button
              type="button"
              onClick={() => {
                setRoutingMode('targeted_routing');
                setActiveLog(`[QUERY PLAN] Mode: Targeted Routing (_routing=${selectedTenant}). Query sent strictly to Shard ${targetShard}.`);
              }}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: routingMode === 'targeted_routing' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: routingMode === 'targeted_routing' ? '#ffffff' : 'var(--color-text)',
                fontWeight: routingMode === 'targeted_routing' ? 600 : 400,
              }}
            >
              Targeted (_routing)
            </button>
          </div>
        </div>

        {routingMode === 'targeted_routing' && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '6px' }}>
              Routing Tenant Key
            </label>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--rounded-md)',
                border: '1px solid var(--color-border)',
                fontFamily: 'inherit',
                fontSize: '14px',
                background: 'var(--color-surface)',
              }}
            >
              <option value="merchant_alpha">merchant_alpha (Shard {getShardForDoc('sample', 'merchant_alpha', true)})</option>
              <option value="merchant_beta">merchant_beta (Shard {getShardForDoc('sample', 'merchant_beta', true)})</option>
              <option value="merchant_gamma">merchant_gamma (Shard {getShardForDoc('sample', 'merchant_gamma', true)})</option>
            </select>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '6px' }}>
            Pagination Model
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setPaginationMode('standard_from_size');
                setPageOffset(0);
              }}
              style={{
                flex: 1,
                padding: '7px 8px',
                fontSize: '11px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: paginationMode === 'standard_from_size' ? 'var(--color-surface)' : 'transparent',
                fontWeight: paginationMode === 'standard_from_size' ? 600 : 400,
                color: 'var(--color-text)',
              }}
            >
              Standard (from: {pageOffset})
            </button>
            <button
              type="button"
              onClick={() => {
                setPaginationMode('standard_from_size');
                setPageOffset(50000);
                setActiveLog('[ALERT] Deep pagination: from=50000. Each shard must collect 50,010 documents into RAM priority queues!');
              }}
              style={{
                flex: 1,
                padding: '7px 8px',
                fontSize: '11px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid #d32f2f',
                background: pageOffset === 50000 ? '#ffebee' : 'transparent',
                color: '#d32f2f',
                fontWeight: pageOffset === 50000 ? 600 : 400,
              }}
            >
              Deep (from: 50k) ⚠️
            </button>
            <button
              type="button"
              onClick={() => {
                setPaginationMode('search_after_cursor');
                setPageOffset(0);
                setActiveLog('[PAGINATION] search_after cursor active. O(1) memory overhead using Lucene doc value sort.');
              }}
              style={{
                flex: 1,
                padding: '7px 8px',
                fontSize: '11px',
                borderRadius: 'var(--rounded-md)',
                cursor: 'pointer',
                border: '1px solid #2e7d32',
                background: paginationMode === 'search_after_cursor' ? '#e8f5e9' : 'transparent',
                color: '#2e7d32',
                fontWeight: paginationMode === 'search_after_cursor' ? 600 : 400,
              }}
            >
              search_after ✓
            </button>
          </div>
        </div>
      </div>

      {/* Cluster Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div style={{ background: 'var(--color-card)', padding: '12px 16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Nodes Contacted</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: nodesContacted > 1 ? '#cc785c' : '#2e7d32', marginTop: '4px' }}>
            {nodesContacted} of 3 ({shardsScanned} shards)
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
            {routingMode === 'scatter_gather' ? 'Full cluster broadcast' : 'Single targeted node'}
          </div>
        </div>

        <div style={{ background: 'var(--color-card)', padding: '12px 16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Query Latency (p99)</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: estimatedLatencyMs > 50 ? '#d32f2f' : 'var(--color-text)', marginTop: '4px' }}>
            ~{estimatedLatencyMs} ms
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
            {paginationMode === 'standard_from_size' && pageOffset > 1000 ? 'Deep priority queue merge' : 'Scatter phase + Fetch phase'}
          </div>
        </div>

        <div style={{ background: 'var(--color-card)', padding: '12px 16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Coordinator Heap</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: Number(coordinatorHeapAllocMb) > 10 ? '#d32f2f' : 'var(--color-text)', marginTop: '4px' }}>
            {coordinatorHeapAllocMb} MB
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
            {paginationMode === 'search_after_cursor' ? 'Fixed O(K) heap usage' : `from=${pageOffset} queue sorting`}
          </div>
        </div>

        <div style={{ background: 'var(--color-card)', padding: '12px 16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Lucene Segments</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}>
            {segmentsCount} active
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
            {softDeletedDocs} soft-deleted tombstones
          </div>
        </div>
      </div>

      {/* Main Visualizer: Cluster Shards vs Inverted Index */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Left: Cluster Shard Topology */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
              Cluster Shard Topology &amp; Allocation
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
              {routingMode === 'targeted_routing' ? `Filtered to Shard ${targetShard}` : 'All 3 Shards Active'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {shards.map((s) => {
              const isTarget = routingMode === 'targeted_routing' ? s.id === targetShard : true;
              return (
                <div
                  key={s.id}
                  style={{
                    border: isTarget ? '2px solid var(--color-primary)' : '1px dashed var(--color-border)',
                    borderRadius: 'var(--rounded-md)',
                    padding: '12px',
                    background: isTarget ? 'var(--color-card)' : '#fafafa',
                    opacity: isTarget ? 1 : 0.45,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>
                      {s.node} &bull; Shard [{s.id}]
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isTarget ? '#e8f5e9' : '#eeeeee',
                        color: isTarget ? '#2e7d32' : '#757575',
                        fontWeight: 600,
                      }}
                    >
                      {isTarget ? 'QUERY ACTIVE' : 'SKIPPED BY ROUTING'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>
                    Documents indexed ({s.docs.length}):
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {s.docs.map((d) => (
                        <span
                          key={d.id}
                          style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono, monospace)',
                          }}
                        >
                          {d.id} ({d.tenantId})
                        </span>
                      ))}
                      {s.docs.length === 0 && (
                        <span style={{ color: 'var(--color-muted)', fontStyle: 'italic', fontSize: '11px' }}>
                          No documents allocated
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Inverted Index Table (Term Dictionary + Postings) */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '16px',
            maxHeight: '380px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
              Lucene Inverted Index (Term Dictionary &rarr; Postings)
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
              {sortedTerms.length} Unique Terms
            </span>
          </div>

          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-muted)' }}>
                <th style={{ padding: '6px 4px' }}>Term</th>
                <th style={{ padding: '6px 4px' }}>DF</th>
                <th style={{ padding: '6px 4px' }}>Postings List (DocID, TF, Pos)</th>
              </tr>
            </thead>
            <tbody>
              {sortedTerms.map((term) => {
                const isMatchingQuery = queryTokens.includes(term);
                const postings = invertedIndex[term];
                return (
                  <tr
                    key={term}
                    style={{
                      borderBottom: '1px solid #f0ede6',
                      background: isMatchingQuery ? 'rgba(204, 120, 92, 0.12)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '6px 4px', fontWeight: isMatchingQuery ? 700 : 500, color: isMatchingQuery ? '#cc785c' : 'inherit' }}>
                      {term}
                    </td>
                    <td style={{ padding: '6px 4px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {postings.length}
                    </td>
                    <td style={{ padding: '6px 4px', fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}>
                      {postings.map((p, pIdx) => (
                        <span
                          key={pIdx}
                          style={{
                            display: 'inline-block',
                            background: 'var(--color-card)',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            marginRight: '4px',
                            marginBottom: '2px',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          [{p.docId}: tf={p.tf}]
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Query Results & Coordinator Consolidation */}
      <div
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--rounded-md)',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
            Coordinating Node: Final Ranked Results (Fetch Phase)
          </h4>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#cc785c' }}>
            {matchingDocsWithScores.length} Hits Found
          </span>
        </div>

        {matchingDocsWithScores.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px' }}>
            No documents matched query tokens &ldquo;{searchQuery}&rdquo; within the selected shard routing boundary.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {matchingDocsWithScores.map(({ doc, score, shardId }, rank) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--color-surface)',
                  padding: '8px 12px',
                  borderRadius: 'var(--rounded-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, marginRight: '8px', color: '#cc785c' }}>#{rank + 1}</span>
                  <span style={{ fontWeight: 600, fontSize: '13px', marginRight: '8px' }}>{doc.title}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)', marginRight: '6px' }}>({doc.category})</span>
                  <span style={{ fontSize: '11px', background: 'var(--color-card)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                    ${doc.price}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    Shard [{shardId}] &bull; Tenant: {doc.tenantId}
                  </span>
                  <span
                    style={{
                      background: '#e8f5e9',
                      color: '#2e7d32',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  >
                    score: {score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Terminal Audit Log */}
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
        <span style={{ color: '#cc785c', fontWeight: 700 }}>CLUSTER LOG &gt;</span>
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activeLog}
        </span>
      </div>
    </div>
  );
};
