import React, { useState } from 'react';

interface OrderRecord {
  id: string;
  amount: number;
  customer: string;
  status: string;
  createdAt: string;
}

interface OutboxRecord {
  id: string;
  eventType: string;
  payload: string;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  retryCount: number;
}

interface BrokerMessage {
  offset: number;
  topic: string;
  key: string;
  payload: string;
  timestamp: string;
}

interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

export const OutboxSimulator: React.FC = () => {
  const [architecture, setArchitecture] = useState<'dual_write' | 'outbox'>('dual_write');
  const [brokerBroken, setBrokerBroken] = useState<boolean>(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [outbox, setOutbox] = useState<OutboxRecord[]>([]);
  const [brokerMessages, setBrokerMessages] = useState<BrokerMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init',
      time: '00:00:00',
      type: 'info',
      text: 'Simulator initialized. Choose an architecture pattern and simulate order placement.',
    },
  ]);

  const addLog = (type: 'info' | 'success' | 'warning' | 'error', text: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ id: Math.random().toString(36).substring(2, 9), time, type, text }, ...prev.slice(0, 19)]);
  };

  const handlePlaceOrder = () => {
    const orderNum = orders.length + 1;
    const orderId = `ORD-${orderNum.toString().padStart(4, '0')}`;
    const amount = Math.floor(Math.random() * 200) + 40;
    const customer = `user_${Math.floor(Math.random() * 899 + 100)}`;

    if (architecture === 'dual_write') {
      // Approach A: Naive Dual-Write
      // Step 1: Write to Database
      const newOrder: OrderRecord = {
        id: orderId,
        amount,
        customer,
        status: 'PAID',
        createdAt: new Date().toLocaleTimeString(),
      };
      setOrders((prev) => [newOrder, ...prev]);
      addLog('success', `[PostgreSQL] TX COMMITTED: Inserted order ${orderId} ($${amount}) into "orders" table.`);

      // Step 2: Synchronous attempt to publish to Kafka
      if (brokerBroken) {
        addLog(
          'error',
          `[Kafka Publish FAILED] Connection refused / timeout on topic "orders.events". Node process caught error, but DB write was ALREADY committed!`
        );
        addLog(
          'warning',
          `🚨 CRITICAL INCONSISTENCY: Order ${orderId} exists in DB, but 0 events reached Kafka! Downstream inventory & shipping will NEVER execute.`
        );
      } else {
        const newMsg: BrokerMessage = {
          offset: brokerMessages.length,
          topic: 'orders.events',
          key: orderId,
          payload: JSON.stringify({ event: 'OrderCreated', orderId, amount, customer }),
          timestamp: new Date().toLocaleTimeString(),
        };
        setBrokerMessages((prev) => [newMsg, ...prev]);
        addLog('success', `[Kafka] Message published successfully at offset #${newMsg.offset}.`);
      }
    } else {
      // Approach B: Transactional Outbox
      // Step 1: Single atomic ACID SQL transaction writes both Order and Outbox record
      const newOrder: OrderRecord = {
        id: orderId,
        amount,
        customer,
        status: 'PAID',
        createdAt: new Date().toLocaleTimeString(),
      };
      const eventId = `EVT-${(outbox.length + 1).toString().padStart(4, '0')}`;
      const newOutbox: OutboxRecord = {
        id: eventId,
        eventType: 'OrderCreated',
        payload: JSON.stringify({ orderId, amount, customer }),
        status: 'PENDING',
        retryCount: 0,
      };

      setOrders((prev) => [newOrder, ...prev]);
      setOutbox((prev) => [newOutbox, ...prev]);

      addLog(
        'success',
        `[PostgreSQL] ATOMIC TRANSACTION COMMITTED: "orders" table (${orderId}) and "outbox_events" table (${eventId}) committed together in 1 SQL TX.`
      );

      // Trigger Relay Worker check immediately
      setTimeout(() => {
        relayOutboxEvent(newOutbox);
      }, 500);
    }
  };

  const relayOutboxEvent = (record: OutboxRecord) => {
    if (brokerBroken) {
      setOutbox((prev) =>
        prev.map((o) => (o.id === record.id ? { ...o, status: 'FAILED', retryCount: o.retryCount + 1 } : o))
      );
      addLog(
        'error',
        `[Relay Worker] Attempt to publish ${record.id} failed: Broker unreachable. Event remains safe in DB outbox for exponential retry.`
      );
    } else {
      setOutbox((prev) => prev.map((o) => (o.id === record.id ? { ...o, status: 'PUBLISHED' } : o)));
      const newMsg: BrokerMessage = {
        offset: brokerMessages.length,
        topic: 'orders.events',
        key: record.id,
        payload: record.payload,
        timestamp: new Date().toLocaleTimeString(),
      };
      setBrokerMessages((prev) => [newMsg, ...prev]);
      addLog(
        'success',
        `[Relay Worker &rarr; Kafka] Delivered event ${record.id} to topic "orders.events". Marked status='PUBLISHED' in DB outbox.`
      );
    }
  };

  const handleRetryPendingOutbox = () => {
    const pendingOrFailed = outbox.filter((o) => o.status !== 'PUBLISHED');
    if (pendingOrFailed.length === 0) {
      addLog('info', '[Relay Worker] No pending or failed outbox events to relay.');
      return;
    }
    addLog('info', `[Relay Worker] Polling ${pendingOrFailed.length} pending events with SELECT ... FOR UPDATE SKIP LOCKED.`);
    pendingOrFailed.forEach((rec, idx) => {
      setTimeout(() => {
        relayOutboxEvent(rec);
      }, idx * 300);
    });
  };

  const handleReset = () => {
    setOrders([]);
    setOutbox([]);
    setBrokerMessages([]);
    setLogs([
      {
        id: 'reset',
        time: new Date().toLocaleTimeString(),
        type: 'info',
        text: 'Simulator reset. Ready for next experiment.',
      },
    ]);
  };

  const divergenceCount =
    architecture === 'dual_write'
      ? orders.length - brokerMessages.length
      : outbox.filter((o) => o.status !== 'PUBLISHED').length;

  return (
    <div className="card card-cream" style={{ padding: '24px', borderRadius: '12px', margin: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '20px' }}>Interactive Dual-Write vs. Transactional Outbox Simulator</h3>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--color-muted)' }}>
            Compare naive dual-writes against the Transactional Outbox pattern during network partitions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${architecture === 'dual_write' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setArchitecture('dual_write')}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            Naive Dual-Write
          </button>
          <button
            type="button"
            className={`btn ${architecture === 'outbox' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setArchitecture('outbox')}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            Transactional Outbox
          </button>
        </div>
      </div>

      {/* Simulator Control Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: 'var(--color-surface-soft)',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <button type="button" className="btn btn-primary" onClick={handlePlaceOrder}>
          + Place Order ($)
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => setBrokerBroken((prev) => !prev)}
          style={{
            background: brokerBroken ? 'var(--color-error)' : 'var(--color-surface-card)',
            color: brokerBroken ? '#ffffff' : 'var(--color-ink)',
            borderColor: brokerBroken ? 'var(--color-error)' : 'var(--color-hairline)',
          }}
        >
          {brokerBroken ? 'Broker: PARTITIONED (Offline)' : 'Broker: HEALTHY (Online)'}
        </button>

        {architecture === 'outbox' && (
          <button type="button" className="btn btn-secondary" onClick={handleRetryPendingOutbox}>
            Run Relay Worker Poll
          </button>
        )}

        <button type="button" className="btn btn-secondary" onClick={handleReset} style={{ marginLeft: 'auto' }}>
          Reset
        </button>
      </div>

      {/* Metric Callout Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div className="card" style={{ padding: '14px', background: 'var(--color-canvas)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Database Orders
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600, marginTop: '4px' }}>{orders.length}</div>
        </div>

        <div className="card" style={{ padding: '14px', background: 'var(--color-canvas)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Broker Delivered
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600, marginTop: '4px' }}>{brokerMessages.length}</div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px',
            background: divergenceCount > 0 ? '#fdf2f2' : 'var(--color-canvas)',
            borderRadius: '8px',
            border: divergenceCount > 0 ? '1px solid var(--color-error)' : '1px solid var(--color-hairline)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: divergenceCount > 0 ? 'var(--color-error)' : 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {architecture === 'dual_write' ? 'Silent Divergence (Lost)' : 'Pending in Outbox'}
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 600,
              marginTop: '4px',
              color: divergenceCount > 0 ? 'var(--color-error)' : 'var(--color-ink)',
            }}
          >
            {divergenceCount > 0
              ? `${divergenceCount} ${architecture === 'dual_write' ? 'PERMANENTLY LOST' : 'Buffered in DB'}`
              : '0 (Consistent)'}
          </div>
        </div>
      </div>

      {/* Side-by-Side Data Stores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* PostgreSQL Store View */}
        <div className="card" style={{ padding: '16px', background: 'var(--color-canvas)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>PostgreSQL: "orders" Table</span>
            <span className="badge badge-teal">ACID Store</span>
          </div>

          <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            {orders.length === 0 ? (
              <div style={{ color: 'var(--color-muted)', padding: '8px 0' }}>No records in orders table.</div>
            ) : (
              orders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--color-hairline)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    <strong>{o.id}</strong> ({o.customer})
                  </span>
                  <span>
                    ${o.amount} &bull; <span style={{ color: 'var(--color-success)' }}>{o.status}</span>
                  </span>
                </div>
              ))
            )}
          </div>

          {architecture === 'outbox' && (
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--color-hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>PostgreSQL: "outbox_events"</span>
                <span className="badge badge-coral">Same Local TX</span>
              </div>
              <div style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                {outbox.length === 0 ? (
                  <div style={{ color: 'var(--color-muted)', padding: '6px 0' }}>No outbox events.</div>
                ) : (
                  outbox.map((ob) => (
                    <div
                      key={ob.id}
                      style={{
                        padding: '4px 6px',
                        borderBottom: '1px solid var(--color-hairline)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>
                        <strong>{ob.id}</strong>: {ob.eventType}
                      </span>
                      <span
                        className="badge"
                        style={{
                          fontSize: '11px',
                          background:
                            ob.status === 'PUBLISHED'
                              ? 'var(--color-success)'
                              : ob.status === 'FAILED'
                                ? 'var(--color-error)'
                                : 'var(--color-amber)',
                          color: '#ffffff',
                        }}
                      >
                        {ob.status} {ob.retryCount > 0 ? `(retry ${ob.retryCount})` : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Message Broker View */}
        <div className="card" style={{ padding: '16px', background: 'var(--color-canvas)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Kafka / Message Broker: "orders.events"</span>
            <span
              className="badge"
              style={{
                background: brokerBroken ? 'var(--color-error)' : 'var(--color-success)',
                color: '#fff',
              }}
            >
              {brokerBroken ? 'Partitioned' : 'Connected'}
            </span>
          </div>

          <div style={{ maxHeight: '280px', overflowY: 'auto', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            {brokerMessages.length === 0 ? (
              <div style={{ color: 'var(--color-muted)', padding: '8px 0' }}>
                No events received by broker.
                {architecture === 'dual_write' && orders.length > 0 && brokerBroken && (
                  <div style={{ color: 'var(--color-error)', marginTop: '8px' }}>
                    Orders exist in DB but failed to publish! Data is silently desynchronized.
                  </div>
                )}
              </div>
            ) : (
              brokerMessages.map((msg) => (
                <div
                  key={msg.offset}
                  style={{
                    padding: '8px',
                    marginBottom: '6px',
                    borderRadius: '6px',
                    background: 'var(--color-surface-soft)',
                    border: '1px solid var(--color-hairline)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-muted)' }}>
                    <span>Offset #{msg.offset} &bull; Key: {msg.key}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px', wordBreak: 'break-all' }}>{msg.payload}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Terminal / Event Log */}
      <div
        style={{
          background: 'var(--color-surface-dark)',
          color: 'var(--color-on-dark)',
          padding: '16px',
          borderRadius: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--color-on-dark-soft)' }}>
          <span>SYSTEM AUDIT &amp; EXECUTION LOG</span>
          <span>{logs.length} events</span>
        </div>
        <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {logs.map((log) => (
            <div key={log.id} style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--color-on-dark-soft)' }}>[{log.time}]</span>
              <span
                style={{
                  color:
                    log.type === 'error'
                      ? '#ff6b6b'
                      : log.type === 'warning'
                        ? 'var(--color-accent-amber)'
                        : log.type === 'success'
                          ? '#51cf66'
                          : 'var(--color-on-dark)',
                }}
              >
                {log.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};