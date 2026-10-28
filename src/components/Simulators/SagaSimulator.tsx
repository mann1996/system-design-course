import React, { useState } from 'react';

interface SagaStep {
  name: string;
  service: string;
  forwardAction: string;
  compensatingAction: string;
  status: 'idle' | 'executing' | 'success' | 'failed' | 'compensating' | 'compensated';
  localState: string;
}

export const SagaSimulator: React.FC = () => {
  const [sagaType, setSagaType] = useState<'orchestration' | 'choreography'>('orchestration');
  const [failureTarget, setFailureTarget] = useState<'none' | 'inventory' | 'payment' | 'delivery'>('payment');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [sagaStatus, setSagaStatus] = useState<'idle' | 'running' | 'success' | 'compensated'>('idle');
  const [logs, setLogs] = useState<string[]>([
    'Simulator ready. Select a failure scenario and click "Execute Distributed Saga".',
  ]);

  const initialSteps: SagaStep[] = [
    {
      name: '1. Create Order Record',
      service: 'Order Service',
      forwardAction: 'INSERT INTO orders (status=PENDING)',
      compensatingAction: 'UPDATE orders SET status=CANCELLED',
      status: 'idle',
      localState: 'orders: empty',
    },
    {
      name: '2. Reserve Stock',
      service: 'Inventory Service',
      forwardAction: 'UPDATE stock SET reserved = reserved + 1',
      compensatingAction: 'UPDATE stock SET reserved = reserved - 1',
      status: 'idle',
      localState: 'stock: 100 available',
    },
    {
      name: '3. Authorize Payment',
      service: 'Payment Service',
      forwardAction: 'POST /v1/charges (Hold $120)',
      compensatingAction: 'POST /v1/refunds (Release Hold)',
      status: 'idle',
      localState: 'balance: $500',
    },
    {
      name: '4. Dispatch Courier',
      service: 'Delivery Service',
      forwardAction: 'POST /v1/shipments/assign',
      compensatingAction: 'POST /v1/shipments/cancel',
      status: 'idle',
      localState: 'fleet: idle',
    },
  ];

  const [steps, setSteps] = useState<SagaStep[]>(initialSteps);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const handleReset = () => {
    setSteps(initialSteps);
    setIsRunning(false);
    setSagaStatus('idle');
    setLogs(['Simulator reset. Ready for next workflow execution.']);
  };

  const executeSaga = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSagaStatus('running');
    setSteps(initialSteps);

    const currentSteps = [...initialSteps];
    addLog(
      `Starting ${sagaType.toUpperCase()} Saga for Order #ORD-8492 (Failure scenario: ${failureTarget.toUpperCase()})`
    );

    let failedAtIndex = -1;

    // Phase 1: Forward Transactions
    for (let i = 0; i < currentSteps.length; i++) {
      currentSteps[i].status = 'executing';
      setSteps([...currentSteps]);

      if (sagaType === 'orchestration') {
        addLog(`[Saga Orchestrator &rarr; ${currentSteps[i].service}] Sending Command: "${currentSteps[i].forwardAction}"`);
      } else {
        addLog(`[Event Choreography] ${currentSteps[i].service} consumed previous event and processing local TX.`);
      }

      await new Promise((r) => setTimeout(r, 600));

      const isFailure =
        (i === 1 && failureTarget === 'inventory') ||
        (i === 2 && failureTarget === 'payment') ||
        (i === 3 && failureTarget === 'delivery');

      if (isFailure) {
        currentSteps[i].status = 'failed';
        currentSteps[i].localState = 'TX ROLLED BACK (Local constraint error)';
        setSteps([...currentSteps]);
        failedAtIndex = i;
        addLog(
          `💥 ERROR at Step ${i + 1} (${currentSteps[i].service}): Local transaction failed! Initiating backward compensation.`
        );
        break;
      } else {
        currentSteps[i].status = 'success';
        if (i === 0) currentSteps[i].localState = 'orders: #ORD-8492 (PENDING)';
        if (i === 1) currentSteps[i].localState = 'stock: 99 available (1 reserved)';
        if (i === 2) currentSteps[i].localState = 'balance: $380 ($120 authorized)';
        if (i === 3) currentSteps[i].localState = 'fleet: Courier #14 assigned';
        setSteps([...currentSteps]);
        addLog(`✓ Step ${i + 1} (${currentSteps[i].service}) COMMITTED locally.`);
      }
    }

    // Phase 2: Backward Compensation if failure occurred
    if (failedAtIndex !== -1) {
      addLog(`===> EXECUTING SAGA COMPENSATING TRANSACTIONS (Reversing steps ${failedAtIndex} down to 1) <===`);

      for (let j = failedAtIndex - 1; j >= 0; j--) {
        currentSteps[j].status = 'compensating';
        setSteps([...currentSteps]);

        if (sagaType === 'orchestration') {
          addLog(
            `[Saga Orchestrator &rarr; ${currentSteps[j].service}] Sending Compensating Command: "${currentSteps[j].compensatingAction}"`
          );
        } else {
          addLog(`[Choreography] ${currentSteps[j].service} received SagaFailed event, triggering compensation.`);
        }

        await new Promise((r) => setTimeout(r, 600));

        currentSteps[j].status = 'compensated';
        if (j === 0) currentSteps[j].localState = 'orders: #ORD-8492 (CANCELLED)';
        if (j === 1) currentSteps[j].localState = 'stock: 100 available (0 reserved)';
        if (j === 2) currentSteps[j].localState = 'balance: $500 (Refunded)';
        setSteps([...currentSteps]);
        addLog(`↺ Compensated Step ${j + 1} on ${currentSteps[j].service}. State reconciled.`);
      }

      setSagaStatus('compensated');
      addLog('🏁 SAGA COMPLETE: System returned to eventual consistency. 0 stranded locks or orphan reservations.');
    } else {
      setSagaStatus('success');
      currentSteps[0].localState = 'orders: #ORD-8492 (CONFIRMED)';
      setSteps([...currentSteps]);
      addLog('🎉 SAGA COMPLETE: All 4 distributed services committed successfully.');
    }

    setIsRunning(false);
  };

  return (
    <div className="card card-cream" style={{ padding: '24px', borderRadius: '12px', margin: '24px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '20px' }}>Interactive Distributed Saga &amp; Compensation Simulator</h3>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--color-muted)' }}>
            Observe how forward transactions execute and how compensating actions semantically undo partial state without 2PC locks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${sagaType === 'orchestration' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => !isRunning && setSagaType('orchestration')}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            Orchestration (Coordinator)
          </button>
          <button
            type="button"
            className={`btn ${sagaType === 'choreography' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => !isRunning && setSagaType('choreography')}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            Choreography (Events)
          </button>
        </div>
      </div>

      {/* Controls Bar */}
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
        <button
          type="button"
          className="btn btn-primary"
          onClick={executeSaga}
          disabled={isRunning}
          style={{ opacity: isRunning ? 0.7 : 1 }}
        >
          {isRunning ? 'Executing Workflow...' : 'Execute Distributed Saga'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          <span style={{ fontWeight: 500 }}>Inject Fault:</span>
          <select
            value={failureTarget}
            onChange={(e) => setFailureTarget(e.target.value as any)}
            disabled={isRunning}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-hairline)',
              background: 'var(--color-canvas)',
              fontFamily: 'inherit',
              fontSize: '13px',
            }}
          >
            <option value="none">No Fault (Happy Path - All 4 Succeed)</option>
            <option value="inventory">Step 2: Inventory Out of Stock</option>
            <option value="payment">Step 3: Payment Declined (Card Error)</option>
            <option value="delivery">Step 4: Delivery Courier Fleet Full</option>
          </select>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={isRunning}
          style={{ marginLeft: 'auto' }}
        >
          Reset
        </button>
      </div>

      {/* Step Visualizer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {steps.map((st) => {
          let cardBg = 'var(--color-canvas)';
          let borderColor = 'var(--color-hairline)';
          let badgeText = st.status.toUpperCase();
          let badgeBg = 'var(--color-surface-card)';
          let badgeColor = 'var(--color-ink)';

          if (st.status === 'executing') {
            cardBg = '#fff9db';
            borderColor = 'var(--color-accent-amber)';
            badgeBg = 'var(--color-accent-amber)';
            badgeColor = '#ffffff';
          } else if (st.status === 'success') {
            cardBg = '#ebfbee';
            borderColor = 'var(--color-success)';
            badgeBg = 'var(--color-success)';
            badgeColor = '#ffffff';
          } else if (st.status === 'failed') {
            cardBg = '#fff5f5';
            borderColor = 'var(--color-error)';
            badgeBg = 'var(--color-error)';
            badgeColor = '#ffffff';
          } else if (st.status === 'compensating') {
            cardBg = '#fff4e6';
            borderColor = 'var(--color-primary)';
            badgeBg = 'var(--color-primary)';
            badgeColor = '#ffffff';
          } else if (st.status === 'compensated') {
            cardBg = '#f8f9fa';
            borderColor = 'var(--color-muted)';
            badgeBg = 'var(--color-muted)';
            badgeColor = '#ffffff';
          }

          return (
            <div
              key={st.name}
              className="card"
              style={{
                padding: '16px',
                background: cardBg,
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                transition: 'all 0.25s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)' }}>{st.service}</span>
                <span
                  className="badge"
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: badgeBg,
                    color: badgeColor,
                  }}
                >
                  {badgeText}
                </span>
              </div>

              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>{st.name}</div>

              <div style={{ fontSize: '12px', margin: '4px 0' }}>
                <span style={{ color: 'var(--color-muted)' }}>Forward:</span>{' '}
                <code style={{ fontSize: '11px' }}>{st.forwardAction}</code>
              </div>

              <div style={{ fontSize: '12px', margin: '4px 0' }}>
                <span style={{ color: 'var(--color-muted)' }}>Undo:</span>{' '}
                <code style={{ fontSize: '11px', color: 'var(--color-primary)' }}>{st.compensatingAction}</code>
              </div>

              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--color-hairline)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-body-strong)',
                }}
              >
                Local DB: {st.localState}
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal Log */}
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
          <span>SAGA WORKFLOW &amp; COMPENSATION AUDIT LOG</span>
          <span>Status: {sagaStatus.toUpperCase()}</span>
        </div>
        <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {logs.map((log, i) => (
            <div key={i} style={{ color: log.includes('ERROR') ? '#ff6b6b' : log.includes('✓') ? '#51cf66' : log.includes('↺') ? '#ffa94d' : 'var(--color-on-dark)' }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};