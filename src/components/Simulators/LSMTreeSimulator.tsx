import React, { useState, useRef } from 'react';

interface KeyValueEntry {
  key: string;
  value: string;
  isTombstone?: boolean;
  version: number;
}

interface SSTable {
  id: string;
  level: number;
  entries: KeyValueEntry[];
  bloomFilterBits: number[]; // 16-bit array
  sparseIndex: { key: string; offset: number }[];
  createdAt: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'write' | 'read' | 'flush' | 'compact' | 'bloom_skip';
  message: string;
}

const BLOOM_FILTER_SIZE = 16;
const MEMTABLE_CAPACITY = 4;

// 3 simple hash functions for 16-bit bloom filter
function hash1(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % BLOOM_FILTER_SIZE;
}

function hash2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash % BLOOM_FILTER_SIZE;
}

function hash3(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 17 + str.charCodeAt(i) * 13) >>> 0;
  }
  return hash % BLOOM_FILTER_SIZE;
}

function computeBloomBits(keys: string[]): number[] {
  const bits = new Array(BLOOM_FILTER_SIZE).fill(0);
  keys.forEach((k) => {
    bits[hash1(k)] = 1;
    bits[hash2(k)] = 1;
    bits[hash3(k)] = 1;
  });
  return bits;
}

function checkBloomFilter(key: string, bits: number[]): boolean {
  const h1 = hash1(key);
  const h2 = hash2(key);
  const h3 = hash3(key);
  return bits[h1] === 1 && bits[h2] === 1 && bits[h3] === 1;
}

export const LSMTreeSimulator: React.FC = () => {
  // WAL entries
  const [wal, setWal] = useState<string[]>([]);
  
  // In-memory MemTable (sorted by key)
  const [memTable, setMemTable] = useState<KeyValueEntry[]>([
    { key: 'user:101', value: 'Alice', version: 1 },
    { key: 'user:104', value: 'David', version: 1 },
  ]);

  // Disk SSTables
  const [sstables, setSstables] = useState<SSTable[]>([
    {
      id: 'SST-L0-1',
      level: 0,
      entries: [
        { key: 'device:sensor_a', value: '23.4C', version: 1 },
        { key: 'device:sensor_b', value: '45.1C', version: 1 },
        { key: 'user:102', value: 'Bob (Old)', version: 1 },
      ],
      bloomFilterBits: computeBloomBits(['device:sensor_a', 'device:sensor_b', 'user:102']),
      sparseIndex: [
        { key: 'device:sensor_a', offset: 0 },
        { key: 'user:102', offset: 2 },
      ],
      createdAt: 'Boot',
    },
    {
      id: 'SST-L1-1',
      level: 1,
      entries: [
        { key: 'config:max_conn', value: '5000', version: 1 },
        { key: 'config:timeout_ms', value: '250', version: 1 },
        { key: 'user:101', value: 'Alice (Stale)', version: 0 },
      ],
      bloomFilterBits: computeBloomBits(['config:max_conn', 'config:timeout_ms', 'user:101']),
      sparseIndex: [
        { key: 'config:max_conn', offset: 0 },
        { key: 'user:101', offset: 2 },
      ],
      createdAt: 'Boot',
    },
  ]);

  const [inputKey, setInputKey] = useState('user:103');
  const [inputValue, setInputValue] = useState('Charlie');
  const [searchKey, setSearchKey] = useState('user:101');
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    source: string;
    value?: string;
    isTombstone?: boolean;
    diskReadsSaved: number;
    steps: string[];
  } | null>(null);

  const [diskReadsSavedTotal, setDiskReadsSavedTotal] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: '00:00:00',
      type: 'write',
      message: 'LSM-Tree storage engine initialized with 1 WAL, MemTable (2 items), and 2 SSTables.',
    },
  ]);

  const versionRef = useRef(2);

  const addLog = (type: LogEntry['type'], message: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [
      { id: Math.random().toString(36).substring(2, 9), timestamp: time, type, message },
      ...prev.slice(0, 19),
    ]);
  };

  const handleWrite = (isDelete = false) => {
    if (!inputKey.trim()) return;

    const trimmedKey = inputKey.trim();
    const trimmedVal = isDelete ? '[TOMBSTONE: DELETED]' : inputValue.trim() || 'default_val';
    const currentVersion = versionRef.current++;

    // Step 1: Append to WAL
    const walEntry = `${isDelete ? 'DELETE' : 'PUT'} ${trimmedKey} = ${trimmedVal} (v${currentVersion})`;
    setWal((prev) => [walEntry, ...prev.slice(0, 7)]);

    // Step 2: Insert into MemTable (sorted by key, overwrite if duplicate)
    setMemTable((prev) => {
      const existingIdx = prev.findIndex((e) => e.key === trimmedKey);
      let updated: KeyValueEntry[];

      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = {
          key: trimmedKey,
          value: trimmedVal,
          isTombstone: isDelete,
          version: currentVersion,
        };
      } else {
        updated = [
          ...prev,
          {
            key: trimmedKey,
            value: trimmedVal,
            isTombstone: isDelete,
            version: currentVersion,
          },
        ];
      }

      // Sort alphabetically by key (like SkipList in RAM)
      updated.sort((a, b) => a.key.localeCompare(b.key));

      addLog(
        'write',
        `${isDelete ? 'Tombstone' : 'Write'} appended to WAL & MemTable: key="${trimmedKey}" (v${currentVersion}).`
      );

      // Auto-flush if capacity reached
      if (updated.length >= MEMTABLE_CAPACITY) {
        setTimeout(() => {
          triggerFlush(updated);
        }, 300);
        return [];
      }

      return updated;
    });
  };

  const triggerFlush = (tableToFlush: KeyValueEntry[] = memTable) => {
    if (tableToFlush.length === 0) return;

    const keys = tableToFlush.map((e) => e.key);
    const bloomBits = computeBloomBits(keys);
    const sparseIndex = tableToFlush
      .filter((_, idx) => idx % 2 === 0)
      .map((entry, idx) => ({ key: entry.key, offset: idx * 2 }));

    const sstableId = `SST-L0-${Date.now().toString().slice(-4)}`;
    const newSSTable: SSTable = {
      id: sstableId,
      level: 0,
      entries: [...tableToFlush],
      bloomFilterBits: bloomBits,
      sparseIndex,
      createdAt: new Date().toTimeString().split(' ')[0],
    };

    setSstables((prev) => [newSSTable, ...prev]);
    setMemTable([]);
    setWal([]); // Truncate WAL because MemTable is safely persisted to SSTable
    addLog(
      'flush',
      `MemTable flushed to disk as immutable ${sstableId} (${tableToFlush.length} keys). WAL truncated.`
    );
  };

  const handleRead = () => {
    if (!searchKey.trim()) return;
    const target = searchKey.trim();
    const steps: string[] = [];
    let savedInQuery = 0;

    steps.push(`1. Checking in-memory MemTable for "${target}"...`);

    // Check MemTable first
    const memEntry = memTable.find((e) => e.key === target);
    if (memEntry) {
      steps.push(`✓ HIT in MemTable (RAM)! Retrieved in ~10ns. (v${memEntry.version})`);
      setSearchResult({
        found: true,
        source: 'MemTable (RAM)',
        value: memEntry.value,
        isTombstone: memEntry.isTombstone,
        diskReadsSaved: 0,
        steps,
      });
      addLog('read', `Read HIT in MemTable for "${target}" (v${memEntry.version}).`);
      return;
    }
    steps.push(`✗ Miss in MemTable. Searching disk SSTables (L0 to L1)...`);

    // Check SSTables from youngest to oldest (L0 first, then L1)
    let foundEntry: KeyValueEntry | null = null;
    let foundSource = '';

    for (const table of sstables) {
      steps.push(`Checking ${table.id} (Level ${table.level}):`);

      // Check Bloom Filter
      const bloomPass = checkBloomFilter(target, table.bloomFilterBits);
      if (!bloomPass) {
        steps.push(
          `  ↳ Bloom Filter returned NEGATIVE (0 disk seek). Key definitely NOT in ${table.id}. Skipping disk seek!`
        );
        savedInQuery++;
        continue;
      }

      steps.push(`  ↳ Bloom Filter returned POSITIVE. Reading sparse index & scanning data block on disk...`);
      const entry = table.entries.find((e) => e.key === target);
      if (entry) {
        foundEntry = entry;
        foundSource = `${table.id} (Disk)`;
        steps.push(`  ↳ ✓ Key FOUND in ${table.id}! Value: "${entry.value}" (v${entry.version})`);
        break;
      } else {
        steps.push(`  ↳ ⚠ False Positive in Bloom filter! Key was not in ${table.id} data blocks.`);
      }
    }

    setDiskReadsSavedTotal((prev) => prev + savedInQuery);

    if (foundEntry) {
      setSearchResult({
        found: true,
        source: foundSource,
        value: foundEntry.value,
        isTombstone: foundEntry.isTombstone,
        diskReadsSaved: savedInQuery,
        steps,
      });
      addLog('read', `Read completed for "${target}". Source: ${foundSource}. Bloom filter saved ${savedInQuery} disk seeks.`);
    } else {
      setSearchResult({
        found: false,
        source: 'None',
        diskReadsSaved: savedInQuery,
        steps: [...steps, `✗ Key "${target}" NOT found in any SSTable or MemTable.`],
      });
      addLog(
        'bloom_skip',
        `Key "${target}" does not exist. Bloom filters saved ${savedInQuery} disk reads out of ${sstables.length} tables!`
      );
    }
  };

  const handleCompaction = () => {
    if (sstables.length < 2) {
      addLog('compact', 'Need at least 2 SSTables on disk to execute compaction.');
      return;
    }

    addLog('compact', 'Triggering Leveled Compaction: merging all SSTables, discarding tombstones and stale versions...');

    // Merge all entries, keeping only the highest version per key
    const mergedMap = new Map<string, KeyValueEntry>();

    // Process from oldest to newest so higher versions overwrite
    [...sstables].reverse().forEach((table) => {
      table.entries.forEach((entry) => {
        const existing = mergedMap.get(entry.key);
        if (!existing || entry.version >= existing.version) {
          mergedMap.set(entry.key, entry);
        }
      });
    });

    // Remove tombstones physically during compaction!
    const compactedEntries: KeyValueEntry[] = [];
    mergedMap.forEach((entry) => {
      if (!entry.isTombstone) {
        compactedEntries.push(entry);
      }
    });

    compactedEntries.sort((a, b) => a.key.localeCompare(b.key));

    const keys = compactedEntries.map((e) => e.key);
    const compactedSSTable: SSTable = {
      id: `SST-L1-Compacted`,
      level: 1,
      entries: compactedEntries,
      bloomFilterBits: computeBloomBits(keys),
      sparseIndex: compactedEntries
        .filter((_, idx) => idx % 2 === 0)
        .map((entry, idx) => ({ key: entry.key, offset: idx * 2 })),
      createdAt: new Date().toTimeString().split(' ')[0],
    };

    setSstables([compactedSSTable]);
    addLog(
      'compact',
      `Compaction finished! Replaced ${sstables.length} fragmented SSTables with 1 unified Level-1 SSTable (${compactedEntries.length} active keys). All tombstones and stale versions purged!`
    );
  };

  return (
    <div className="card card-cream" style={{ padding: '24px', margin: '32px 0', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Interactive Architecture Simulator</span>
          <h3 style={{ margin: '4px 0 8px' }}>Log-Structured Merge-Tree (LSM-Tree) &amp; Bloom Filter Engine</h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-ink-muted)' }}>
            Experience how RocksDB, Cassandra, and ClickHouse write in sequential memory and use Bloom filters to eliminate random disk reads.
          </p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: '#181715', color: '#faf9f5', padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>
            <span style={{ color: '#00c49f', fontWeight: 700 }}>{diskReadsSavedTotal}</span> Disk Seeks Saved by Bloom Filters
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={handleCompaction}
            title="Merge SSTables and purge tombstones"
          >
            ⚡ Run Compaction
          </button>
        </div>
      </div>

      {/* Operation Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Write / Delete Card */}
        <div style={{ background: '#faf9f5', border: '1px solid var(--color-hairline)', borderRadius: '12px', padding: '16px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>1. Write / Update / Delete Path</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Key</label>
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-hairline)', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Value</label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-hairline)', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, padding: '7px 12px', fontSize: '12px' }}
              onClick={() => handleWrite(false)}
            >
              Write Key (PUT)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, padding: '7px 12px', fontSize: '12px', color: '#d32f2f', borderColor: '#ffcdd2' }}
              onClick={() => handleWrite(true)}
            >
              Delete (Tombstone)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '7px 12px', fontSize: '12px' }}
              onClick={() => triggerFlush()}
              title="Flush current MemTable immediately"
            >
              Flush RAM
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '8px' }}>
            * MemTable automatically flushes to disk when it holds {MEMTABLE_CAPACITY} items.
          </div>
        </div>

        {/* Read / Query Card */}
        <div style={{ background: '#faf9f5', border: '1px solid var(--color-hairline)', borderRadius: '12px', padding: '16px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>2. Read Path &amp; Bloom Filter Evaluation</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              type="text"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              placeholder="e.g. user:101 or missing:key"
              style={{ flex: 1, padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-hairline)', fontFamily: 'var(--font-mono)' }}
            />
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '7px 16px', fontSize: '12px' }}
              onClick={handleRead}
            >
              Search Key
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>Quick test:</span>
            {['user:101', 'user:102', 'device:sensor_a', 'non_existent:key'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSearchKey(k)}
                style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--color-hairline)', background: '#fff', cursor: 'pointer' }}
              >
                {k}
              </button>
            ))}
          </div>

          {searchResult && (
            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: searchResult.found ? '#e8f5e9' : '#fff3e0', border: `1px solid ${searchResult.found ? '#a5d6a7' : '#ffe082'}`, fontSize: '12px' }}>
              <div style={{ fontWeight: 600, color: searchResult.found ? '#2e7d32' : '#e65100', marginBottom: '4px' }}>
                {searchResult.found
                  ? searchResult.isTombstone
                    ? `Key Deleted (Tombstone found in ${searchResult.source})`
                    : `Key Found in ${searchResult.source}: "${searchResult.value}"`
                  : 'Key Not Found in any Storage Tier'}
              </div>
              <div style={{ fontSize: '11px', color: '#555' }}>
                {searchResult.steps.map((st, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-mono)', margin: '2px 0' }}>{st}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Storage Tiers Diagram */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Tier 1: WAL & RAM */}
        <div style={{ background: '#181715', color: '#faf9f5', borderRadius: '12px', padding: '16px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '6px' }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px' }}>1. IN-MEMORY MEMTABLE</span>
            <span style={{ fontSize: '11px', color: '#888' }}>RAM (SkipList / RB-Tree)</span>
          </div>

          <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px' }}>
            Capacity: {memTable.length} / {MEMTABLE_CAPACITY} items
            <div style={{ height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
              <div style={{ width: `${(memTable.length / MEMTABLE_CAPACITY) * 100}%`, height: '100%', background: memTable.length >= MEMTABLE_CAPACITY ? '#ff5252' : '#00c49f' }} />
            </div>
          </div>

          {memTable.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', padding: '8px 0' }}>
              MemTable is empty (flushed to SSTable).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {memTable.map((entry) => (
                <div
                  key={entry.key}
                  style={{
                    background: '#222',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    borderLeft: entry.isTombstone ? '3px solid #ff5252' : '3px solid #00c49f',
                    fontSize: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: '#fff', fontWeight: 600 }}>{entry.key}</span>
                  <span style={{ color: entry.isTombstone ? '#ff8a80' : '#81c784' }}>
                    {entry.isTombstone ? '[TOMBSTONE]' : entry.value} <span style={{ fontSize: '10px', color: '#888' }}>(v{entry.version})</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '16px', borderTop: '1px solid #333', paddingTop: '8px' }}>
            <span style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>SEQUENTIAL WAL (DISK LOG):</span>
            <div style={{ fontSize: '10px', color: '#aaa', maxHeight: '70px', overflowY: 'auto' }}>
              {wal.length === 0 ? <div>(WAL empty - all data persisted to SSTables)</div> : wal.map((w, idx) => <div key={idx}>&gt; {w}</div>)}
            </div>
          </div>
        </div>

        {/* Tier 2: SSTables on Disk */}
        <div style={{ background: '#faf9f5', border: '1px solid var(--color-hairline)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--color-hairline)', paddingBottom: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>2. DISK SSTABLES (IMMUTABLE FILES)</span>
            <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>{sstables.length} files</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto' }}>
            {sstables.map((sstable) => (
              <div
                key={sstable.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '10px',
                  background: sstable.level === 0 ? '#fff8e1' : '#f1f8e9',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, color: sstable.level === 0 ? '#b78103' : '#33691e' }}>
                    {sstable.id} (Level {sstable.level})
                  </span>
                  <span style={{ color: '#888' }}>{sstable.entries.length} keys</span>
                </div>

                {/* Bloom Filter Bits */}
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#555', display: 'block', marginBottom: '2px' }}>Bloom Filter (16-bit):</span>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {sstable.bloomFilterBits.map((b, idx) => (
                      <div
                        key={idx}
                        title={`Bit ${idx}: ${b}`}
                        style={{
                          flex: 1,
                          height: '14px',
                          background: b === 1 ? '#cc785c' : '#e0e0e0',
                          borderRadius: '2px',
                          color: b === 1 ? '#fff' : '#666',
                          fontSize: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {b}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Entries */}
                <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {sstable.entries.map((e, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        background: '#fff',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        border: '1px solid #eee',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{e.key}</span>
                      <span style={{ color: e.isTombstone ? '#d32f2f' : '#2e7d32' }}>
                        {e.isTombstone ? '[TOMBSTONE]' : e.value} <span style={{ fontSize: '9px', color: '#888' }}>(v{e.version})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Execution Event Log */}
      <div style={{ background: '#181715', borderRadius: '10px', padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
        <div style={{ color: 'var(--color-primary)', fontWeight: 700, marginBottom: '6px', fontSize: '11px' }}>
          // ENGINE EVENT TRACE LOG
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
          {logs.map((log) => (
            <div key={log.id} style={{ color: log.type === 'bloom_skip' ? '#00c49f' : log.type === 'flush' ? '#ffab00' : log.type === 'compact' ? '#80d8ff' : '#faf9f5' }}>
              <span style={{ color: '#888' }}>[{log.timestamp}]</span> [{log.type.toUpperCase()}] {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
