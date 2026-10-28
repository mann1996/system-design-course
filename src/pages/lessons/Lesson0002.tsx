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
import { ClusterSimulator } from '../../components/Simulators/ClusterSimulator';

export const Lesson0002: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container">
        <header>
          <BadgeRow
            lessonId="0002"
            lessonBadge="Lesson 0002"
            moduleBadge="Module 1: Foundations & Compute"
            time="15 mins"
            tag="Cluster Sim"
          />
          <h1>Scaling the Compute Layer: Horizontal Scaling &amp; Statelessness</h1>
          <p className="lead-text">
            How to scale Node.js applications beyond a single process without falling into the distributed state traps that plague AI-generated code.
          </p>
        </header>

        <LessonHeaderStatus lessonId="0002" />

        <PrimarySourceCallout
          sourceText={
            <p style={{ margin: 0 }}>
              <strong>Read:</strong> Martin Kleppmann, <em>Designing Data-Intensive Applications</em>, Chapter 1 ("Reliability & Maintainability") and the{' '}
              <a href="https://12factor.net/processes" target="_blank" rel="noopener noreferrer">
                Twelve-Factor App Methodology: VI. Processes (Execute the app as one or more stateless processes)
              </a>.
            </p>
          }
        />

        <h2>1. The Two Ways to Scale Compute</h2>
        <p>
          In <Link to="/lessons/0001">Lesson 0001</Link>, we saw that a single server can easily handle up to ~2,000 QPS. But what happens when traffic spikes to 10,000 QPS, or when your server crashes for a maintenance reboot and drops all active user requests?
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Vertical Scaling (Scale Up)</th>
                <th>Horizontal Scaling (Scale Out)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Mechanism</strong></td>
                <td>Upgrade existing box to more CPU cores &amp; RAM (e.g. 4 cores &rarr; 64 cores).</td>
                <td>Add identical server instances behind a Load Balancer (1 node &rarr; 5 nodes).</td>
              </tr>
              <tr>
                <td><strong>Complexity</strong></td>
                <td>Zero code changes. Everything remains on <code>localhost</code>.</td>
                <td>Requires <strong>statelessness</strong>, load balancers, and externalized state stores.</td>
              </tr>
              <tr>
                <td><strong>Ceiling &amp; Cost</strong></td>
                <td>Hard physical ceiling. High-end hardware cost grows exponentially.</td>
                <td>Virtually infinite ceiling using cheap commodity virtual machines.</td>
              </tr>
              <tr>
                <td><strong>Availability</strong></td>
                <td><strong>Single Point of Failure (SPOF)</strong>. If server dies, entire app is down.</td>
                <td><strong>High Availability (HA)</strong>. If 1 node dies, the remaining nodes handle traffic.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. The Node.js Single-Thread Trap</h2>
        <p>
          Because Node.js runs on a single-threaded JavaScript event loop, <strong>one Node.js process can only utilize exactly ONE CPU core</strong>.
        </p>
        <p>
          If an AI suggests deploying your Node.js application to a high-powered 16-core cloud server (e.g., an AWS <code>c6i.4xlarge</code>) using a simple <code>node server.js</code> command:
        </p>
        <ul>
          <li>1 core will run at 100% capacity under peak load.</li>
          <li>The other 15 cores will sit at <strong>0% utilization</strong>. You are paying for 16 cores while wasting 93.7% of the machine.</li>
        </ul>

        <div className="callout callout-source">
          <div className="callout-title">How Architects Fix This</div>
          <p style={{ margin: 0 }}>
            <strong>On a single machine:</strong> Use the Node.js <code>cluster</code> module or process managers like <strong>PM2</strong> (<code>pm2 start server.js -i max</code>) to fork one worker process per CPU core.<br />
            <strong>Across multiple machines / cloud:</strong> Package the Node application into a Docker container and run replicas across nodes managed by an Application Load Balancer (ALB) or container orchestrator.
          </p>
        </div>

        <h2>3. The #1 AI Coding Bug: The Stateful Server Trap</h2>
        <p>
          When an AI is asked to implement user authentication, rate limiting, or file uploads, it instinctively writes code that stores state in process memory:
        </p>

        <CodeWindowCard
          title="naive-ai-server.js — Dangerous Pattern"
          code={`// NAIVE AI PATTERN: In-memory session store
const activeSessions = new Map();

app.post('/login', (req, res) => {
  const sessionId = crypto.randomUUID();
  activeSessions.set(sessionId, { userId: user.id }); // Stored in Server RAM!
  res.cookie('sid', sessionId);
  res.send('Logged in');
});

app.get('/dashboard', (req, res) => {
  const session = activeSessions.get(req.cookies.sid);
  if (!session) return res.status(401).send('Unauthorized'); // BUG UNDER HORIZONTAL SCALING!
  res.send('Welcome');
});`}
        />

        <AIPitfallCallout title="Why This Works on Localhost but Fails in Production">
          <p>
            On your laptop, there is only 1 server instance. Both <code>/login</code> and <code>/dashboard</code> hit the same process memory.
          </p>
          <p>In production with 3 replicas behind a Round-Robin Load Balancer:</p>
          <ol style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            <li>User sends <code>POST /login</code> &rarr; Load Balancer routes to <strong>Server A</strong>. Session saved in Server A's RAM.</li>
            <li>User clicks Dashboard (<code>GET /dashboard</code>) &rarr; Load Balancer routes to <strong>Server B</strong>.</li>
            <li>Server B inspects its own memory &rarr; Session not found &rarr; <strong>HTTP 401 Unauthorized!</strong></li>
            <li>The user is randomly logged out every time they refresh the page.</li>
          </ol>
        </AIPitfallCallout>

        <h2>4. Interactive Simulator: Stateful vs. Stateless Cluster</h2>
        <p>
          Experience the bug firsthand. Toggle between Stateful and Stateless modes, click <strong>"1. Login User"</strong>, and then click <strong>"2. Fetch Profile"</strong> repeatedly to watch how requests route across servers.
        </p>

        <ClusterSimulator />

        <h2>5. The Golden Rule: The 5-Point Statelessness Checklist</h2>
        <p>
          For a complete architectural breakdown of Layer 4 vs Layer 7 load balancers and the health-check disaster to avoid, review our{' '}
          <Link to="/reference/ref-lb">Load Balancing &amp; Stateless Compute Reference Sheet</Link>.
        </p>

        <h2>6. Active Knowledge Retrieval</h2>
        <p>Test your storage strength on the core concepts learned today:</p>

        <Quiz
          id="quiz_0002_1"
          question="1. An engineer deploys a Node.js API with 4 replicas behind an Application Load Balancer. Users report that they are randomly logged out when browsing between pages. What is the root cause?"
          options={[
            {
              text: 'Network gateways experienced severe packet drops.',
              isCorrect: false,
              explanation: 'Packet drops cause connection timeouts or retries, not HTTP 401 unauthenticated session resets.'
            },
            {
              text: 'Database connections exceeded configured pool sizes.',
              isCorrect: false,
              explanation: 'Exhausting pool connections causes database connection timeouts (500/504 errors), not random session loss.'
            },
            {
              text: 'Authentication sessions resided inside process memory.',
              isCorrect: true,
              explanation: 'When sessions live in local RAM, requests routed to any replica other than the one where the user logged in fail to find the session.'
            },
            {
              text: 'Reverse proxies dropped incoming session cookies.',
              isCorrect: false,
              explanation: 'Reverse proxies forward session cookies by default unless explicitly configured otherwise.'
            }
          ]}
        />

        <Quiz
          id="quiz_0002_2"
          question="2. Why can configuring a load balancer to ping the primary database during health checks trigger a catastrophic total system outage?"
          options={[
            {
              text: 'Database slowdowns mark every server dead simultaneously.',
              isCorrect: true,
              explanation: 'If the database experiences a brief slowdown, all replica health checks fail simultaneously. The load balancer terminates traffic to all nodes, turning a minor database delay into a global outage.'
            },
            {
              text: 'Health pings consume excessive network bandwidth.',
              isCorrect: false,
              explanation: 'Health check pings consume tiny amounts of bandwidth (a few bytes per ping).'
            },
            {
              text: 'Proxy servers drop encrypted socket handshakes.',
              isCorrect: false,
              explanation: 'TLS handshakes are completely independent of database health check routing.'
            },
            {
              text: 'Unindexed queries introduce fatal memory leaks.',
              isCorrect: false,
              explanation: 'Shallow health queries do not cause memory leaks in the database engine.'
            }
          ]}
        />

        <LessonNavButtons currentLessonId="0002" />

        <AgentReminder
          title="Your Personal Tutor is Standing By"
          promptText='Did you notice in your own freelance projects any state stored in memory (like JWT blacklists, WebSocket connections, or cron tasks)? Ask: "How do I refactor my Node.js app to be 100% stateless?"'
        />
      </div>
    </div>
  );
};
