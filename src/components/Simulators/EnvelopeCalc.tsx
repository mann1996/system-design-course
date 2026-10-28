import React, { useState } from 'react';

export const EnvelopeCalc: React.FC = () => {
  const [dau, setDau] = useState<number>(50000);
  const [reqPerUser, setReqPerUser] = useState<number>(40);
  const [payloadKb, setPayloadKb] = useState<number>(2);
  const [peakMultiplier, setPeakMultiplier] = useState<number>(2);

  const totalRequests = (dau || 0) * (reqPerUser || 0);
  const avgQps = totalRequests > 0 ? (totalRequests / 86400).toFixed(1) : '0';
  const peakQps = totalRequests > 0 ? (parseFloat(avgQps) * peakMultiplier).toFixed(1) : '0';
  const numericPeakQps = parseFloat(peakQps);
  const dailyGb = totalRequests > 0 ? ((totalRequests * payloadKb) / (1024 * 1024)).toFixed(2) : '0';
  const yearlyGb = totalRequests > 0 ? (parseFloat(dailyGb) * 365).toFixed(1) : '0';
  const yearlyTb = totalRequests > 0 ? (parseFloat(yearlyGb) / 1024).toFixed(2) : '0';
  const cache20PctMb = totalRequests > 0 ? ((parseFloat(dailyGb) * 1024) * 0.2).toFixed(0) : '0';

  const isHighTraffic = numericPeakQps > 5000;
  const verdictColor = isHighTraffic ? 'var(--color-error)' : '#206d33';

  return (
    <div className="calc-container" style={{ margin: '32px 0' }}>
      <h3 style={{ margin: '0 0 8px' }}>Interactive Capacity Calculator</h3>
      <p style={{ margin: '0 0 20px', color: 'var(--color-muted)', fontSize: '14px' }}>
        Tweak user volume, request frequency, and payload sizes to evaluate capacity thresholds in real time.
      </p>

      <div className="calc-grid">
        <div className="calc-field">
          <label htmlFor="dau-input">Daily Active Users (DAU):</label>
          <input
            id="dau-input"
            type="number"
            value={dau}
            onChange={(e) => setDau(Math.max(0, parseFloat(e.target.value) || 0))}
            step="10000"
          />
        </div>

        <div className="calc-field">
          <label htmlFor="req-user-input">Avg Requests / User / Day:</label>
          <input
            id="req-user-input"
            type="number"
            value={reqPerUser}
            onChange={(e) => setReqPerUser(Math.max(0, parseFloat(e.target.value) || 0))}
            step="5"
          />
        </div>

        <div className="calc-field">
          <label htmlFor="payload-input">Avg Payload / Request (KB):</label>
          <input
            id="payload-input"
            type="number"
            value={payloadKb}
            onChange={(e) => setPayloadKb(Math.max(0, parseFloat(e.target.value) || 0))}
            step="1"
          />
        </div>

        <div className="calc-field">
          <label htmlFor="peak-multiplier">Peak Multiplier:</label>
          <select
            id="peak-multiplier"
            value={peakMultiplier}
            onChange={(e) => setPeakMultiplier(parseFloat(e.target.value))}
          >
            <option value="2">2.0x (Standard steady business)</option>
            <option value="3">3.0x (Flash sales &amp; push events)</option>
            <option value="5">5.0x (Viral consumer spikes)</option>
          </select>
        </div>
      </div>

      <div className="calc-result" id="calc-output" style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '6px' }}>
          &bull; <strong>Total Daily Traffic:</strong> {totalRequests.toLocaleString()} requests/day
        </div>
        <div style={{ marginBottom: '6px' }}>
          &bull; <strong>Average Throughput:</strong> {avgQps} QPS | <strong>Peak:</strong> {peakQps} QPS
        </div>
        <div style={{ marginBottom: '6px' }}>
          &bull; <strong>Daily Ingest:</strong> {dailyGb} GB/day | <strong>1-Year Storage:</strong> {yearlyGb} GB (~{yearlyTb} TB)
        </div>
        <div style={{ marginBottom: '8px' }}>
          &bull; <strong>20% Hot Cache Size:</strong> ~{cache20PctMb} MB RAM needed
        </div>
        <div
          style={{
            display: 'inline-block',
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px dashed var(--color-hairline)',
            color: verdictColor,
            fontWeight: 600,
            lineHeight: 1.4
          }}
        >
          &rarr; Architectural Verdict:{' '}
          {numericPeakQps <= 2000
            ? 'Easily handled by a single Node.js instance + single PostgreSQL database with index optimization.'
            : numericPeakQps <= 10000
            ? 'Requires standard horizontal Node.js clustering behind a reverse proxy (Nginx) + read replica DB.'
            : 'High-throughput system: Sharded database, distributed cache (Redis cluster), and asynchronous message queues.'}
        </div>
      </div>
    </div>
  );
};
