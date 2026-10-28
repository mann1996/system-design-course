import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeRow } from '../../components/UI/BadgeRow';
import { PrimarySourceCallout } from '../../components/UI/PrimarySourceCallout';
import { CodeWindowCard } from '../../components/UI/CodeWindowCard';
import { AIPitfallCallout } from '../../components/UI/AIPitfallCallout';
import { Quiz } from '../../components/UI/Quiz';
import { AgentReminder } from '../../components/UI/AgentReminder';
import { LessonNavButtons } from '../../components/UI/LessonNavButtons';
import { LessonHeaderStatus } from '../../components/UI/LessonHeaderStatus';
import { SagaSimulator } from '../../components/Simulators/SagaSimulator';

export const Lesson0008: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0008"
            lessonBadge="Lesson 0008"
            moduleBadge="Module 3: Asynchronous Decoupling"
            time="20 mins"
            tag="Saga Simulator"
          />
          <h1>Distributed Transactions: The Saga Pattern &amp; Compensating Workflows</h1>
          <p className="lead-text">
            Coordinate multi-service business workflows across distributed databases without Two-Phase Commit (2PC) bottlenecks, compare Choreography vs. Orchestration sagas, and engineer reliable compensating rollback actions.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0008" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Hector Garcia-Molina &amp; Kenneth Salem, <em>Sagas</em> (ACM, 1987); Chris Richardson, <em>Microservices Patterns</em> (Manning, 2018), Chapter 4: &ldquo;Managing Transactions with Sagas&rdquo;; Martin Fowler on <em>The Saga Pattern</em>; and <em>The Amazon Builders' Library</em>, <strong>Implementing Orchestrated Workflows</strong>.
            </p>
          }
        />

        <h2>1. The Death of ACID in Distributed Systems</h2>
        <p>
          In <Link to="/lessons/0006">Lesson 0006</Link> and <Link to="/lessons/0007">Lesson 0007</Link>, we established that decoupled message brokers and the Transactional Outbox pattern enable resilient, asynchronous event publishing.
        </p>
        <p>
          In a monolithic application, maintaining business invariants across multiple tables is simple. When an e-commerce checkout executes, you wrap the entire operation in a single local database transaction:
        </p>
        <pre style={{ background: 'var(--color-surface-dark)', color: 'var(--color-on-dark)', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto' }}>
{`BEGIN TRANSACTION;
  INSERT INTO orders (id, user_id, amount) VALUES ('ord_1', 'u_42', 150);
  UPDATE inventory SET reserved = reserved + 1 WHERE item_id = 'item_9';
  UPDATE customer_balances SET balance = balance - 150 WHERE user_id = 'u_42';
COMMIT;`}
        </pre>
        <p>
          The relational database engine enforces <strong>ACID</strong> guarantees: if any check fails, the transaction rolls back cleanly, and concurrent requests see either the complete state or nothing.
        </p>
        <p>
          However, as we split systems into domain-oriented microservices (each with its own private database), a single business process spans multiple independent network services:
        </p>
        <div style={{ textAlign: 'center', margin: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-muted)' }}>
          Order Service (Postgres) &rarr; Inventory Service (MySQL) &rarr; Payment Service (Stripe) &rarr; Delivery Service (DynamoDB)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Why 2PC Fails</span>
            <h4 style={{ margin: '8px 0' }}>The Two-Phase Commit (2PC) Trap</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Classic distributed transactions use 2-Phase Commit (XA protocol). In phase 1, a coordinator asks all services to prepare and lock their database rows. In phase 2, it asks them to commit. If the coordinator or network dies during phase 1, <strong>row locks are held indefinitely</strong>, freezing database tables across your cluster and causing total outage.
            </p>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>The Cloud Reality</span>
            <h4 style={{ margin: '8px 0' }}>Eventual Consistency via Sagas</h4>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Modern high-throughput systems abandon synchronous distributed locks. Instead of trying to maintain instantaneous consistency, we break the multi-step transaction into a series of local ACID transactions called a <strong>Saga</strong>, accepting eventual consistency across network boundaries.
            </p>
          </div>
        </div>

        <AIPitfallCallout title='The AI Assistant Blind Spot: "Compensations are Just SQL Rollbacks"'>
          <p>
            When asked to handle errors in distributed workflows, AI coding tools frequently suggest "rolling back" preceding services as if they were database transactions.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            In reality, distributed compensations are <strong>semantic forward actions</strong>, not database rollbacks:
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li>You cannot "rollback" a charged credit card: you must issue an asynchronous refund.</li>
            <li>You cannot "rollback" a confirmation email: you must dispatch a cancellation apology email.</li>
            <li>Compensating actions can fail over the network! Therefore, every compensating action <strong>must be strictly idempotent and retry until it succeeds</strong>.</li>
          </ul>
        </AIPitfallCallout>

        <h2>2. Anatomy of a Saga: Forward Transactions and Compensations</h2>
        <p>
          Formally introduced in 1987 by Hector Garcia-Molina and Kenneth Salem, a Saga is a sequence of local transactions:
        </p>
        <div style={{ textAlign: 'center', margin: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--color-primary)' }}>
          T₁, T₂, T₃, &hellip;, Tₙ
        </div>
        <p>
          For every local transaction <code>Tᵢ</code> that mutates state, there is a corresponding compensating transaction <code>Cᵢ</code> that semantically undoes its changes:
        </p>
        <div className="table-wrapper" style={{ margin: '20px 0' }}>
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>Service</th>
                <th>Forward Action (Tᵢ)</th>
                <th>Compensating Action (Cᵢ)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td><strong>Order Service</strong></td>
                <td>Create order in <code>PENDING</code> state</td>
                <td>Update order status to <code>CANCELLED</code></td>
              </tr>
              <tr>
                <td>2</td>
                <td><strong>Inventory Service</strong></td>
                <td>Reserve SKU stock on shelf</td>
                <td>Release reserved SKU stock back to shelf</td>
              </tr>
              <tr>
                <td>3</td>
                <td><strong>Payment Service</strong></td>
                <td>Authorize credit card charge</td>
                <td>Release authorization hold or refund payment</td>
              </tr>
              <tr>
                <td>4</td>
                <td><strong>Delivery Service</strong></td>
                <td>Assign courier route (Pivot Step)</td>
                <td>Cancel courier dispatch</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="callout callout-coral">
          <div className="callout-title">The "Pivot Transaction" Concept</div>
          <p style={{ margin: 0 }}>
            In any Saga, there is a <strong>Pivot Transaction</strong>: the point of no return. Once the pivot transaction commits, the Saga will not be compensated—all remaining subsequent steps are guaranteed to execute forward (retrying until completion).
          </p>
        </div>

        <h2>3. Interactive Distributed Saga &amp; Compensation Simulator</h2>
        <p>
          Simulate an e-commerce order workflow across four microservices. Choose an orchestration or choreography pattern, inject failures into different services, and watch how backward compensating transactions restore eventual consistency:
        </p>

        <SagaSimulator />

        <h2>4. Choreography vs. Orchestration: The Two Saga Archetypes</h2>
        <p>
          How should distributed services coordinate the steps of a Saga? Architects must choose between two models:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-teal" style={{ marginBottom: '8px' }}>Decentralized</span>
            <h3 style={{ margin: '8px 0' }}>Choreography (Event-Driven)</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              Services publish and subscribe to domain events without any central orchestrator. For example, <code>InventoryService</code> listens to <code>OrderCreated</code>, reserves stock, and publishes <code>StockReserved</code>.
            </p>
            <div style={{ marginTop: '12px', fontSize: '13px' }}>
              <strong>Strengths:</strong> Highly decoupled, low overhead for short workflows (2&ndash;3 steps).<br />
              <strong>Weaknesses:</strong> &ldquo;Distributed spaghetti&rdquo;; difficult to visualize overall workflow state; circular dependency traps; complex debugging.
            </div>
          </div>

          <div className="card card-cream" style={{ padding: '20px', borderRadius: '12px' }}>
            <span className="badge badge-coral" style={{ marginBottom: '8px' }}>Centralized Control</span>
            <h3 style={{ margin: '8px 0' }}>Orchestration (Command-Driven)</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              A dedicated Saga Orchestrator (state machine) sends explicit commands to participants (e.g. <code>ReserveStockCommand</code>) and receives replies. Popular production tools: <strong>Temporal.io</strong>, <strong>AWS Step Functions</strong>.
            </p>
            <div style={{ marginTop: '12px', fontSize: '13px' }}>
              <strong>Strengths:</strong> Single source of truth for workflow state; trivial to monitor, audit, and inject timeouts.<br />
              <strong>Weaknesses:</strong> Orchestrator must be kept lightweight to avoid becoming a monolithic bottleneck.
            </div>
          </div>
        </div>

        <h2>5. TypeScript Implementation: Type-Safe Saga Orchestrator</h2>
        <p>
          Here is a resilient, production-grade Saga Orchestrator pattern in TypeScript demonstrating forward execution and backward compensation with error containment:
        </p>

        <CodeWindowCard
          title="src/sagas/saga-orchestrator.ts"
          code={`export interface SagaStep<TContext> {
  name: string;
  execute: (context: TContext) => Promise<void>;
  compensate: (context: TContext) => Promise<void>;
}

export class SagaOrchestrator<TContext> {
  private steps: Array<SagaStep<TContext>> = [];

  public addStep(step: SagaStep<TContext>): this {
    this.steps.push(step);
    return this;
  }

  public async execute(context: TContext): Promise<boolean> {
    const executedSteps: Array<SagaStep<TContext>> = [];

    // Phase 1: Forward Execution Loop
    for (const step of this.steps) {
      try {
        console.log(\`[Saga] Executing forward step: \${step.name}\`);
        await step.execute(context);
        executedSteps.push(step);
      } catch (error) {
        console.error(\`[Saga] Step "\${step.name}" failed: \${(error as Error).message}\`);
        
        // Phase 2: Backward Compensation Loop
        await this.rollback(executedSteps, context);
        return false;
      }
    }

    console.log('[Saga] All steps committed successfully.');
    return true;
  }

  private async rollback(
    executedSteps: Array<SagaStep<TContext>>, 
    context: TContext
  ): Promise<void> {
    console.warn('[Saga] Initiating backward compensating transactions...');

    // Reverse order: compensate from last committed step down to the first
    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const step = executedSteps[i];
      let compensated = false;
      let retries = 0;

      // Compensations MUST retry until success to preserve eventual consistency!
      while (!compensated && retries < 5) {
        try {
          console.log(\`[Saga] Compensating step: \${step.name} (attempt \${retries + 1})\`);
          await step.compensate(context);
          compensated = true;
        } catch (compError) {
          retries++;
          console.error(\`[Saga] Compensation failed on \${step.name}, retrying...\`, compError);
          await new Promise((res) => setTimeout(res, 500 * Math.pow(2, retries))); // Exponential backoff
        }
      }

      if (!compensated) {
        // If compensation permanently fails, alert humans / route to Dead Letter Queue
        console.error(\`🚨 CRITICAL: Manual intervention required for step: \${step.name}\`);
      }
    }
  }
}`}
        />

        <h2>6. Handling Lack of Isolation: Semantic Locks</h2>
        <p>
          The biggest architectural danger of Sagas compared to ACID transactions is the <strong>absence of the 'I' (Isolation)</strong>. Because local transactions commit immediately to individual databases, intermediate dirty states are visible to external queries.
        </p>
        <p>
          For instance, if User A reserves the last plane seat in Step 1, User B will see the seat as unavailable. If Step 3 subsequently fails and the seat is released, User B experienced an anomaly.
        </p>
        <p>
          Architects solve this by using <strong>Semantic Locks</strong>:
        </p>
        <ul style={{ paddingLeft: '24px', lineHeight: 1.7 }}>
          <li>
            Never mark an order as <code>ACTIVE</code> until all Saga steps complete. Keep it in <code>PENDING_APPROVAL</code>.
          </li>
          <li>
            Tag reserved inventory with an expiration timeout (TTL) and saga execution ID.
          </li>
          <li>
            Use commutative operations (e.g. account credits and debits that commute in order) where possible.
          </li>
        </ul>

        <h2>7. Active Retrieval: Test Your Understanding</h2>

        <Quiz
          id="quiz_0008_1"
          question="1. Why is Two-Phase Commit (2PC) generally avoided across independent microservices in modern cloud architectures?"
          options={[
            {
              text: 'Because 2PC requires message brokers to implement append-only commit logs.',
              isCorrect: false,
              explanation: '2PC is a distributed consensus/locking protocol, independent of append-only logs.'
            },
            {
              text: 'Because 2PC prohibits relational databases from executing indexed SQL queries.',
              isCorrect: false,
              explanation: '2PC coordinates commits across databases, but does not interfere with SQL indexing.'
            },
            {
              text: 'Because coordinator failures hold database row locks across network boundaries.',
              isCorrect: true,
              explanation: 'In 2PC, participating databases lock their rows in the prepare phase. If the coordinator or network fails, those locks are held open indefinitely, stalling the entire cluster.'
            },
            {
              text: 'Because 2PC automatically converts synchronous REST calls into asynchronous streams.',
              isCorrect: false,
              explanation: '2PC is synchronous and blocking; it does not convert calls to streams.'
            }
          ]}
        />

        <Quiz
          id="quiz_0008_2"
          question="2. What is the primary architectural trade-off of Choreography-based Sagas compared to Orchestration-based Sagas?"
          options={[
            {
              text: 'Choreography guarantees strict ACID isolation across all microservice database transactions.',
              isCorrect: false,
              explanation: 'No Saga pattern provides full ACID isolation; intermediate state is always observable.'
            },
            {
              text: 'Choreography eliminates central coordinators but increases event coupling and operational obscurity.',
              isCorrect: true,
              explanation: 'Choreography avoids a central orchestrator, but as the number of services grows, it becomes difficult to understand, trace, and debug the decentralized web of domain events.'
            },
            {
              text: 'Choreography requires centralized workflow engines like Temporal to execute state transitions.',
              isCorrect: false,
              explanation: 'Orchestration requires workflow engines like Temporal; choreography uses decentralized pub/sub.'
            },
            {
              text: 'Choreography enforces synchronous HTTP calls between microservices to prevent network partitions.',
              isCorrect: false,
              explanation: 'Choreography relies on asynchronous events (Kafka/RabbitMQ), not synchronous HTTP calls.'
            }
          ]}
        />

        <Quiz
          id="quiz_0008_3"
          question="3. Why must compensating transactions in a distributed Saga be engineered to be strictly idempotent?"
          options={[
            {
              text: 'Because network failures during rollback will cause the orchestrator to retry compensations.',
              isCorrect: true,
              explanation: 'Compensating actions execute across unreliable networks. If an acknowledgment is dropped, the orchestrator retries the compensation. If the compensation is not idempotent (e.g. duplicate refunds), financial or state corruption occurs.'
            },
            {
              text: 'Because relational databases reject updates that decrease numeric account balances multiple times.',
              isCorrect: false,
              explanation: 'Relational databases will happily execute multiple deductions unless application logic or constraints prevent it.'
            },
            {
              text: 'Because idempotent operations prevent downstream services from recording any logs during audit.',
              isCorrect: false,
              explanation: 'Idempotency ensures consistent state under duplicate execution; it does not disable auditing.'
            },
            {
              text: 'Because the CAP theorem requires compensating actions to commit within one millisecond.',
              isCorrect: false,
              explanation: 'The CAP theorem deals with consistency, availability, and partitions, not millisecond timing constraints.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0008" />

        <AgentReminder
          title="Ready to Secure Your System Edge?"
          promptText='Ask an AI chat of your choice: "Now that we have decoupled async queues, outboxes, and sagas, how do we protect our services from traffic surges using API Gateways and Distributed Rate Limiting?"'
        />
      </div>
    </div>
  );
};