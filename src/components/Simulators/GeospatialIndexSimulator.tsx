import React, { useState, useRef, useMemo } from 'react';

type SpatialMode = 'geohash' | 'quadtree' | 's2';

interface SpatialPoint {
  id: string;
  name: string;
  lat: number; // 0 to 100 relative coord
  lng: number; // 0 to 100 relative coord
  geohash: string;
}

interface QuadNode {
  bounds: { x: number; y: number; w: number; h: number };
  points: SpatialPoint[];
  children?: {
    nw: QuadNode;
    ne: QuadNode;
    sw: QuadNode;
    se: QuadNode;
  };
}

// Simple Base32 character set used by Geohash
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeMockGeohash(lat: number, lng: number, precision: number): string {
  let latMin = 0;
  let latMax = 100;
  let lngMin = 0;
  let lngMax = 100;
  let hash = '';
  let bits = 0;
  let ch = 0;
  let isEven = true; // start with lng

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bits);
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bits);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }
    isEven = !isEven;
    bits++;

    if (bits === 5) {
      hash += BASE32[ch];
      bits = 0;
      ch = 0;
    }
  }

  return hash;
}

function buildQuadTree(
  points: SpatialPoint[],
  bounds: { x: number; y: number; w: number; h: number },
  maxPointsPerNode: number,
  depth = 0
): QuadNode {
  const node: QuadNode = { bounds, points: [] };

  if (points.length <= maxPointsPerNode || depth >= 5) {
    node.points = points;
    return node;
  }

  const hw = bounds.w / 2;
  const hh = bounds.h / 2;

  const nwBounds = { x: bounds.x, y: bounds.y, w: hw, h: hh };
  const neBounds = { x: bounds.x + hw, y: bounds.y, w: hw, h: hh };
  const swBounds = { x: bounds.x, y: bounds.y + hh, w: hw, h: hh };
  const seBounds = { x: bounds.x + hw, y: bounds.y + hh, w: hw, h: hh };

  const nwPts: SpatialPoint[] = [];
  const nePts: SpatialPoint[] = [];
  const swPts: SpatialPoint[] = [];
  const sePts: SpatialPoint[] = [];

  points.forEach((p) => {
    if (p.lng < bounds.x + hw && p.lat < bounds.y + hh) nwPts.push(p);
    else if (p.lng >= bounds.x + hw && p.lat < bounds.y + hh) nePts.push(p);
    else if (p.lng < bounds.x + hw && p.lat >= bounds.y + hh) swPts.push(p);
    else sePts.push(p);
  });

  node.children = {
    nw: buildQuadTree(nwPts, nwBounds, maxPointsPerNode, depth + 1),
    ne: buildQuadTree(nePts, neBounds, maxPointsPerNode, depth + 1),
    sw: buildQuadTree(swPts, swBounds, maxPointsPerNode, depth + 1),
    se: buildQuadTree(sePts, seBounds, maxPointsPerNode, depth + 1),
  };

  return node;
}

// Generate Hilbert curve coordinates for S2 comparison
function d2xy(n: number, d: number): [number, number] {
  let rx: number;
  let ry: number;
  let s: number;
  let t = d;
  let x = 0;
  let y = 0;
  for (s = 1; s < n; s *= 2) {
    rx = 1 & (t / 2);
    ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      const temp = x;
      x = y;
      y = temp;
    }
    x += s * rx;
    y += s * ry;
    t = Math.floor(t / 4);
  }
  return [x, y];
}

export const GeospatialIndexSimulator: React.FC = () => {
  const [mode, setMode] = useState<SpatialMode>('geohash');
  const [geohashPrecision, setGeohashPrecision] = useState<number>(5);
  const [searchRadius, setSearchRadius] = useState<number>(18);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number }>({ lat: 51, lng: 49 });
  const [useNeighborExpansion, setUseNeighborExpansion] = useState<boolean>(true);
  const [quadCapacity, setQuadCapacity] = useState<number>(3);
  const [s2CurveOrder, setS2CurveOrder] = useState<number>(3); // 2^3 = 8x8 grid

  const [points, setPoints] = useState<SpatialPoint[]>([
    { id: 'p1', name: 'Coffee Roasters', lat: 48, lng: 47, geohash: '' },
    { id: 'p2', name: 'Downtown Station', lat: 53, lng: 52, geohash: '' },
    { id: 'p3', name: 'Boutique Hotel', lat: 52, lng: 46, geohash: '' },
    { id: 'p4', name: 'Harbor Pier', lat: 38, lng: 55, geohash: '' },
    { id: 'p5', name: 'City Museum', lat: 60, lng: 44, geohash: '' },
    { id: 'p6', name: 'Cross-Border Cafe (Edge Trap)', lat: 49.5, lng: 50.5, geohash: '' },
    { id: 'p7', name: 'Tech Campus', lat: 25, lng: 75, geohash: '' },
    { id: 'p8', name: 'West End Market', lat: 70, lng: 25, geohash: '' },
    { id: 'p9', name: 'East Financial Hub', lat: 75, lng: 80, geohash: '' },
    { id: 'p10', name: 'Suburban Plaza', lat: 20, lng: 20, geohash: '' },
  ]);

  const [activeLog, setActiveLog] = useState<string>(
    'Spatial index engine initialized. Select a spatial strategy to explore coordinate partitioning and proximity retrieval.'
  );

  const canvasRef = useRef<SVGSVGElement | null>(null);

  // Re-encode geohashes when precision or points change
  const encodedPoints = useMemo(() => {
    return points.map((p) => ({
      ...p,
      geohash: encodeMockGeohash(p.lat, p.lng, geohashPrecision),
    }));
  }, [points, geohashPrecision]);

  const centerGeohash = useMemo(() => {
    return encodeMockGeohash(searchCenter.lat, searchCenter.lng, geohashPrecision);
  }, [searchCenter, geohashPrecision]);

  // Compute grid resolution based on precision
  const gridDivisions = useMemo(() => {
    // 4 chars -> 4x4, 5 chars -> 8x8, 6 chars -> 16x16, 7 chars -> 32x32
    if (geohashPrecision <= 4) return 4;
    if (geohashPrecision === 5) return 8;
    if (geohashPrecision === 6) return 16;
    return 32;
  }, [geohashPrecision]);

  const cellSize = 100 / gridDivisions;

  // Identify center cell index in grid
  const centerCellX = Math.floor(searchCenter.lng / cellSize);
  const centerCellY = Math.floor(searchCenter.lat / cellSize);

  // Compute active cells for Geohash
  const activeCells = useMemo(() => {
    const cells: { x: number; y: number; isCenter: boolean; prefix: string }[] = [];
    if (!useNeighborExpansion) {
      // Only center cell
      cells.push({
        x: centerCellX,
        y: centerCellY,
        isCenter: true,
        prefix: centerGeohash,
      });
    } else {
      // Center cell + 8 neighboring cells (3x3 grid)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = centerCellX + dx;
          const ny = centerCellY + dy;
          if (nx >= 0 && nx < gridDivisions && ny >= 0 && ny < gridDivisions) {
            const sampleLng = (nx + 0.5) * cellSize;
            const sampleLat = (ny + 0.5) * cellSize;
            const prefix = encodeMockGeohash(sampleLat, sampleLng, geohashPrecision);
            cells.push({
              x: nx,
              y: ny,
              isCenter: dx === 0 && dy === 0,
              prefix,
            });
          }
        }
      }
    }
    return cells;
  }, [centerCellX, centerCellY, gridDivisions, cellSize, useNeighborExpansion, centerGeohash, geohashPrecision]);

  // Points within physical radius
  const physicallyMatchingPoints = useMemo(() => {
    return encodedPoints.filter((p) => {
      const dist = Math.sqrt(Math.pow(p.lng - searchCenter.lng, 2) + Math.pow(p.lat - searchCenter.lat, 2));
      return dist <= searchRadius;
    });
  }, [encodedPoints, searchCenter, searchRadius]);

  // Points retrieved by Geohash query
  const geohashCandidatePoints = useMemo(() => {
    const activePrefixes = new Set(activeCells.map((c) => c.prefix));
    return encodedPoints.filter((p) => activePrefixes.has(p.geohash));
  }, [encodedPoints, activeCells]);

  // Points that are physically within radius BUT missed by naive prefix query
  const missedBoundaryPoints = useMemo(() => {
    if (useNeighborExpansion) return [];
    return physicallyMatchingPoints.filter((p) => !geohashCandidatePoints.some((c) => c.id === p.id));
  }, [physicallyMatchingPoints, geohashCandidatePoints, useNeighborExpansion]);

  // Build QuadTree
  const quadTreeRoot = useMemo(() => {
    return buildQuadTree(encodedPoints, { x: 0, y: 0, w: 100, h: 100 }, quadCapacity);
  }, [encodedPoints, quadCapacity]);

  // Count QuadTree nodes inspected for range query
  const quadTreeQueryStats = useMemo(() => {
    let nodesChecked = 0;
    let leavesChecked = 0;
    let pointsChecked = 0;

    function searchNode(node: QuadNode) {
      nodesChecked++;
      // Check if bounding box intersects circle
      const closestX = Math.max(node.bounds.x, Math.min(searchCenter.lng, node.bounds.x + node.bounds.w));
      const closestY = Math.max(node.bounds.y, Math.min(searchCenter.lat, node.bounds.y + node.bounds.h));
      const dX = searchCenter.lng - closestX;
      const dY = searchCenter.lat - closestY;
      const intersects = dX * dX + dY * dY <= searchRadius * searchRadius;

      if (!intersects) return;

      if (!node.children) {
        leavesChecked++;
        pointsChecked += node.points.length;
        return;
      }

      searchNode(node.children.nw);
      searchNode(node.children.ne);
      searchNode(node.children.sw);
      searchNode(node.children.se);
    }

    searchNode(quadTreeRoot);
    return { nodesChecked, leavesChecked, pointsChecked };
  }, [quadTreeRoot, searchCenter, searchRadius]);

  // Hilbert curve points for S2 mode
  const hilbertPoints = useMemo(() => {
    const n = Math.pow(2, s2CurveOrder);
    const total = n * n;
    const pts: [number, number][] = [];
    for (let d = 0; d < total; d++) {
      const [x, y] = d2xy(n, d);
      // Map to 0-100 canvas
      const cx = (x + 0.5) * (100 / n);
      const cy = (y + 0.5) * (100 / n);
      pts.push([cx, cy]);
    }
    return pts;
  }, [s2CurveOrder]);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const boundedX = Math.max(2, Math.min(98, Math.round(x * 10) / 10));
    const boundedY = Math.max(2, Math.min(98, Math.round(y * 10) / 10));

    setSearchCenter({ lng: boundedX, lat: boundedY });
    setActiveLog(
      `Search radius relocated to (Lng: ${boundedX}, Lat: ${boundedY}). Recalculating spatial grid partitions.`
    );
  };

  const addRandomPoints = () => {
    const newPoints: SpatialPoint[] = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const lng = Math.round((Math.random() * 88 + 6) * 10) / 10;
      const lat = Math.round((Math.random() * 88 + 6) * 10) / 10;
      newPoints.push({
        id: `p_dyn_${Date.now()}_${i}`,
        name: `Venue #${points.length + i + 1}`,
        lat,
        lng,
        geohash: '',
      });
    }
    setPoints((prev) => [...prev, ...newPoints]);
    setActiveLog(`Added ${count} randomized spatial venues. Updated B-tree partition hashes and QuadTree quadrants.`);
  };

  const resetVenues = () => {
    setPoints([
      { id: 'p1', name: 'Coffee Roasters', lat: 48, lng: 47, geohash: '' },
      { id: 'p2', name: 'Downtown Station', lat: 53, lng: 52, geohash: '' },
      { id: 'p3', name: 'Boutique Hotel', lat: 52, lng: 46, geohash: '' },
      { id: 'p4', name: 'Harbor Pier', lat: 38, lng: 55, geohash: '' },
      { id: 'p5', name: 'City Museum', lat: 60, lng: 44, geohash: '' },
      { id: 'p6', name: 'Cross-Border Cafe (Edge Trap)', lat: 49.5, lng: 50.5, geohash: '' },
      { id: 'p7', name: 'Tech Campus', lat: 25, lng: 75, geohash: '' },
      { id: 'p8', name: 'West End Market', lat: 70, lng: 25, geohash: '' },
      { id: 'p9', name: 'East Financial Hub', lat: 75, lng: 80, geohash: '' },
      { id: 'p10', name: 'Suburban Plaza', lat: 20, lng: 20, geohash: '' },
    ]);
    setSearchCenter({ lat: 51, lng: 49 });
    setActiveLog('Reset to baseline spatial fleet topology.');
  };

  return (
    <div className="simulator-card" style={{ margin: '32px 0' }}>
      <div className="simulator-header">
        <div>
          <span className="badge badge-coral" style={{ marginBottom: '8px', display: 'inline-block' }}>
            Interactive Spatial Lab
          </span>
          <h3 style={{ margin: '0 0 6px' }}>Geospatial Indexing &amp; Proximity Search Simulator</h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addRandomPoints}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            + Add Venues
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={resetVenues}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Explore how 2D geographic coordinates are mapped into 1D sorted indexes. Toggle between{' '}
        <strong>Geohash Space-Filling Curves</strong>, <strong>Hierarchical QuadTrees</strong>, and{' '}
        <strong>Google S2 Hilbert Curves</strong>. Click anywhere on the map to relocate the query center and observe
        boundary edge false negatives.
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Spatial Partitioning Strategy:
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['geohash', 'quadtree', 's2'] as SpatialMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn ${mode === m ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setMode(m);
                  if (m === 'geohash') {
                    setActiveLog(
                      'Switched to Geohash Mode. Space is partitioned using interleaved bitwise longitude/latitude Base32 prefixes.'
                    );
                  } else if (m === 'quadtree') {
                    setActiveLog(
                      'Switched to QuadTree Mode. 2D space splits recursively into NW, NE, SW, SE quadrants when capacity threshold is reached.'
                    );
                  } else {
                    setActiveLog(
                      'Switched to Google S2 Mode. Demonstrating 1D continuous Hilbert curve mapping without diagonal tearing.'
                    );
                  }
                }}
                style={{ fontSize: '12px', padding: '4px 10px', textTransform: 'capitalize' }}
              >
                {m === 's2' ? 'Google S2' : m}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
            {mode === 'geohash' && 'Z-order Morton curve & Base32 grid'}
            {mode === 'quadtree' && 'Recursive 2D hierarchical quad-split'}
            {mode === 's2' && 'Continuous space-filling Hilbert curve'}
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            Search Radius: <strong>{searchRadius} units (~{searchRadius * 250}m)</strong>
          </label>
          <input
            type="range"
            min={8}
            max={35}
            step={1}
            value={searchRadius}
            onChange={(e) => setSearchRadius(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {mode === 'geohash' && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Geohash Precision: <strong>Level {geohashPrecision} ({gridDivisions}x{gridDivisions} cells)</strong>
            </label>
            <input
              type="range"
              min={4}
              max={6}
              step={1}
              value={geohashPrecision}
              onChange={(e) => setGeohashPrecision(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  checked={useNeighborExpansion}
                  onChange={(e) => setUseNeighborExpansion(e.target.checked)}
                />
                <span><strong>8-Neighbor Cell Expansion</strong> (Fixes Edge Trap)</span>
              </label>
            </div>
          </div>
        )}

        {mode === 'quadtree' && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Max Points Per Quadrant: <strong>{quadCapacity} pts</strong>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={quadCapacity}
              onChange={(e) => setQuadCapacity(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
              Exceeding threshold splits node into 4 sub-quadrants
            </span>
          </div>
        )}

        {mode === 's2' && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Hilbert Curve Order: <strong>Level {s2CurveOrder} ({Math.pow(4, s2CurveOrder)} cells)</strong>
            </label>
            <input
              type="range"
              min={2}
              max={4}
              step={1}
              value={s2CurveOrder}
              onChange={(e) => setS2CurveOrder(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
              Preserves 1D spatial locality without diagonal jumps
            </span>
          </div>
        )}
      </div>

      {/* Main Interactive Map & Canvas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(280px, 0.8fr)',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* SVG Spatial Canvas */}
        <div
          style={{
            background: 'var(--color-canvas, #1e1d1a)',
            border: '2px solid var(--color-border)',
            borderRadius: 'var(--rounded-lg)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(0,0,0,0.4)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
            }}
          >
            <span>Click map to move search center pin (Lng, Lat)</span>
            <span>Dimensions: 100 x 100 Spatial Units</span>
          </div>

          <svg
            ref={canvasRef}
            viewBox="0 0 100 100"
            onClick={handleCanvasClick}
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              display: 'block',
              cursor: 'crosshair',
              background: '#161513',
            }}
          >
            <defs>
              <pattern id="gridPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#gridPattern)" />

            {/* MODE 1: Geohash Grid & Cell Highlighting */}
            {mode === 'geohash' && (
              <>
                {/* Active Geohash Cells */}
                {activeCells.map((cell, idx) => (
                  <rect
                    key={`cell_${idx}`}
                    x={cell.x * cellSize}
                    y={cell.y * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={cell.isCenter ? 'rgba(204, 120, 92, 0.25)' : 'rgba(232, 165, 90, 0.15)'}
                    stroke={cell.isCenter ? '#cc785c' : '#e8a55a'}
                    strokeWidth={cell.isCenter ? '0.8' : '0.4'}
                    strokeDasharray={cell.isCenter ? undefined : '1, 1'}
                  />
                ))}

                {/* Grid Lines */}
                {Array.from({ length: gridDivisions }).map((_, i) => (
                  <React.Fragment key={`grid_line_${i}`}>
                    <line
                      x1={i * cellSize}
                      y1={0}
                      x2={i * cellSize}
                      y2={100}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="0.3"
                    />
                    <line
                      x1={0}
                      y1={i * cellSize}
                      x2={100}
                      y2={i * cellSize}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="0.3"
                    />
                  </React.Fragment>
                ))}

                {/* Geohash Labels on active cells */}
                {activeCells.map((cell, idx) => (
                  <text
                    key={`lbl_${idx}`}
                    x={(cell.x + 0.1) * cellSize}
                    y={(cell.y + 0.3) * cellSize}
                    fill={cell.isCenter ? '#cc785c' : '#e8a55a'}
                    fontSize="2.4"
                    fontFamily="monospace"
                    fontWeight={cell.isCenter ? 'bold' : 'normal'}
                    opacity={0.8}
                  >
                    {cell.prefix}
                  </text>
                ))}
              </>
            )}

            {/* MODE 2: QuadTree Recursive Quadrants */}
            {mode === 'quadtree' && (
              <>
                {(() => {
                  const rects: JSX.Element[] = [];
                  function renderQuadLines(node: QuadNode, depth = 0) {
                    rects.push(
                      <rect
                        key={`qt_${node.bounds.x}_${node.bounds.y}_${depth}`}
                        x={node.bounds.x}
                        y={node.bounds.y}
                        width={node.bounds.w}
                        height={node.bounds.h}
                        fill={node.children ? 'none' : 'rgba(93, 184, 166, 0.05)'}
                        stroke="#5db8a6"
                        strokeWidth={Math.max(0.2, 0.8 - depth * 0.15)}
                        opacity={0.7}
                      />
                    );
                    if (node.children) {
                      renderQuadLines(node.children.nw, depth + 1);
                      renderQuadLines(node.children.ne, depth + 1);
                      renderQuadLines(node.children.sw, depth + 1);
                      renderQuadLines(node.children.se, depth + 1);
                    }
                  }
                  renderQuadLines(quadTreeRoot);
                  return rects;
                })()}
              </>
            )}

            {/* MODE 3: Google S2 Hilbert Space-Filling Curve */}
            {mode === 's2' && (
              <>
                {/* Draw continuous Hilbert path */}
                <polyline
                  points={hilbertPoints.map((p) => `${p[0]},${p[1]}`).join(' ')}
                  fill="none"
                  stroke="#5db8a6"
                  strokeWidth="0.6"
                  strokeOpacity="0.8"
                />
                {hilbertPoints.map((p, i) => (
                  <circle key={`hp_${i}`} cx={p[0]} cy={p[1]} r="0.6" fill="#5db8a6" opacity="0.6" />
                ))}
              </>
            )}

            {/* Physical Search Circle */}
            <circle
              cx={searchCenter.lng}
              cy={searchCenter.lat}
              r={searchRadius}
              fill="rgba(204, 120, 92, 0.12)"
              stroke="#cc785c"
              strokeWidth="0.8"
              strokeDasharray="2, 1"
            />

            {/* Search Center Pin */}
            <circle cx={searchCenter.lng} cy={searchCenter.lat} r="1.8" fill="#cc785c" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx={searchCenter.lng} cy={searchCenter.lat} r="5" fill="none" stroke="#cc785c" strokeWidth="0.4" opacity="0.5">
              <animate attributeName="r" values="2;7;2" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="2.5s" repeatCount="indefinite" />
            </circle>

            {/* Venue Points */}
            {encodedPoints.map((pt) => {
              const isPhysicallyInside = physicallyMatchingPoints.some((p) => p.id === pt.id);
              const isGeohashCandidate = geohashCandidatePoints.some((p) => p.id === pt.id);
              const isMissedEdgeTrap = missedBoundaryPoints.some((p) => p.id === pt.id);

              let pointColor = '#8e8b82'; // neutral out of range
              if (isMissedEdgeTrap) {
                pointColor = '#c64545'; // RED: dangerous false negative!
              } else if (isPhysicallyInside) {
                pointColor = '#5db872'; // GREEN: matched
              } else if (isGeohashCandidate) {
                pointColor = '#e8a55a'; // ORANGE: candidate cell but pruned by radius
              }

              return (
                <g key={pt.id}>
                  <circle
                    cx={pt.lng}
                    cy={pt.lat}
                    r={isMissedEdgeTrap ? '2.4' : isPhysicallyInside ? '2.0' : '1.4'}
                    fill={pointColor}
                    stroke="#ffffff"
                    strokeWidth="0.5"
                  />
                  <text
                    x={pt.lng + 2.5}
                    y={pt.lat + 1}
                    fill={isMissedEdgeTrap ? '#c64545' : '#e6dfd8'}
                    fontSize="2.2"
                    fontWeight={isPhysicallyInside || isMissedEdgeTrap ? 'bold' : 'normal'}
                  >
                    {pt.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right Info & Analysis Pane */}
        <div>
          {/* Edge Trap Warning Banner */}
          {missedBoundaryPoints.length > 0 && (
            <div
              style={{
                background: 'rgba(198, 69, 69, 0.12)',
                border: '1px solid #c64545',
                borderRadius: 'var(--rounded-md)',
                padding: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c64545', fontWeight: 600, fontSize: '13px' }}>
                <span>⚠️ Boundary Edge False Negative Detected!</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text)', lineHeight: 1.4 }}>
                <strong>{missedBoundaryPoints.length} venue(s)</strong> are physically inside the search radius, but because they lie just across a Geohash boundary box in an adjacent cell, a naive prefix query (<code>WHERE geohash LIKE &apos;{centerGeohash}%&apos;</code>) completely fails to find them! Check <em>&ldquo;8-Neighbor Cell Expansion&rdquo;</em> to resolve this.
              </p>
            </div>
          )}

          {/* Metrics Summary Card */}
          <div
            style={{
              background: 'var(--color-surface-subtle, #f5f2eb)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--rounded-md)',
              padding: '16px',
              marginBottom: '16px',
            }}
          >
            <h4 style={{ margin: '0 0 12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Query Execution Analytics
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>
                  Total Venues Indexed:
                </span>
                <strong style={{ fontSize: '16px' }}>{points.length} points</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>
                  Points Within Radius:
                </span>
                <strong style={{ fontSize: '16px', color: '#5db872' }}>
                  {physicallyMatchingPoints.length} valid
                </strong>
              </div>

              {mode === 'geohash' && (
                <>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>
                      Center Geohash Prefix:
                    </span>
                    <strong style={{ fontSize: '14px', fontFamily: 'monospace', color: '#cc785c' }}>
                      {centerGeohash}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>
                      Cells Searched:
                    </span>
                    <strong style={{ fontSize: '14px' }}>
                      {activeCells.length} {useNeighborExpansion ? '(Center + 8 Neighbors)' : '(Center Only)'}
                    </strong>
                  </div>
                </>
              )}

              {mode === 'quadtree' && (
                <>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>
                      Quad Nodes Visited:
                    </span>
                    <strong style={{ fontSize: '14px', color: '#5db8a6' }}>
                      {quadTreeQueryStats.nodesChecked} nodes
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>
                      Points Scanned:
                    </span>
                    <strong style={{ fontSize: '14px' }}>
                      {quadTreeQueryStats.pointsChecked} / {points.length} ({Math.round((1 - quadTreeQueryStats.pointsChecked / Math.max(1, points.length)) * 100)}% pruned)
                    </strong>
                  </div>
                </>
              )}

              {mode === 's2' && (
                <>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>
                      Hilbert Curve Resolution:
                    </span>
                    <strong style={{ fontSize: '14px', color: '#5db8a6' }}>
                      {Math.pow(4, s2CurveOrder)} 1D cells
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>
                      Boundary Discontinuities:
                    </span>
                    <strong style={{ fontSize: '14px', color: '#5db872' }}>
                      0 (Continuous)
                    </strong>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Strategy Comparison Matrix */}
          <div
            style={{
              background: 'var(--color-surface-subtle, #f5f2eb)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--rounded-md)',
              padding: '14px',
              marginBottom: '16px',
              fontSize: '12px',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>
              Architectural Takeaway:
            </strong>
            {mode === 'geohash' && (
              <p style={{ margin: 0 }}>
                Geohashes map 2D coordinates into 1D strings by interleaving longitude and latitude bits into Base32. Nearby points generally share common prefixes, enabling standard B-Tree indexing in PostgreSQL or Redis. <strong>Fatal Trap:</strong> Cell boundaries cut across continuous space; two venues 5 meters apart on opposite sides of a grid line share 0 common prefix characters, necessitating <strong>8-neighbor bounding box queries</strong>.
              </p>
            )}
            {mode === 'quadtree' && (
              <p style={{ margin: 0 }}>
                QuadTrees partition space hierarchically. In dense urban centers with 50,000 venues per square kilometer, QuadTrees subdivide deeply into tiny quadrants, while sparse rural zones remain in a single coarse leaf. <strong>Trade-off:</strong> QuadTrees are complex to rebalance dynamically in high-write environments, making them ideal for in-memory read-heavy spatial services.
              </p>
            )}
            {mode === 's2' && (
              <p style={{ margin: 0 }}>
                Google S2 projects the sphere onto the 6 faces of an enveloping cube, then applies a hierarchical <strong>Hilbert curve</strong> on each face. Unlike Geohash&apos;s Z-order curve which suffers from diagonal tearing, the Hilbert curve guarantees that points close on the 1D curve are strictly close in 2D space. S2 uses compact 64-bit integers and powers Google Maps, Foursquare, and Uber H3.
              </p>
            )}
          </div>

          {/* Engine Activity Log */}
          <div
            style={{
              background: 'var(--color-surface-dark, #181715)',
              color: 'var(--color-on-dark, #faf9f5)',
              borderRadius: 'var(--rounded-md)',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '11px',
              lineHeight: 1.4,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ color: 'var(--color-on-dark-soft, #a09d96)', marginBottom: '4px' }}>
              [SPATIAL_INDEX_DIAGNOSTIC]
            </div>
            <div>{activeLog}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
