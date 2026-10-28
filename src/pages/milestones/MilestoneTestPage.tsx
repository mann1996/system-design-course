import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MilestoneInfo, getAdjacentCourseItem } from '../../data/curriculum';
import { useLessonProgress } from '../../context/LessonProgressContext';
import { AgentReminder } from '../../components/UI/AgentReminder';

interface MilestoneTestPageProps {
  milestone: MilestoneInfo;
}

export const MilestoneTestPage: React.FC<MilestoneTestPageProps> = ({ milestone }) => {
  const { getMilestoneStatus, toggleMilestoneStatus, markMilestoneCompleted } = useLessonProgress();
  const currentStatus = getMilestoneStatus(milestone.id);
  const isCompleted = currentStatus === 'completed';

  // Local storage key for drafting solution
  const draftStorageKey = `teach_me_solution_draft_${milestone.id}`;
  const [solutionDraft, setSolutionDraft] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(draftStorageKey) || '';
    } catch {
      return '';
    }
  });

  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'solution' | 'blank' | null>(null);

  // Auto-save draft to local storage
  useEffect(() => {
    try {
      localStorage.setItem(draftStorageKey, solutionDraft);
      if (solutionDraft.trim()) {
        const now = new Date();
        setLastSaved(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.error('Failed to save solution draft', e);
    }
  }, [solutionDraft, draftStorageKey]);

  // Construct complete review prompt including student's solution
  const fullReviewPrompt = `[Milestone Practical Test Submission]
Milestone: ${milestone.title}
Module: ${milestone.moduleBadge || 'System Design Curriculum'}

Scenario Context:
${milestone.question.scenario}

System Requirements & Scale:
${milestone.question.trafficAndScale.map((s) => `• ${s}`).join('\n')}

Student Solution:
---
${solutionDraft.trim() ? solutionDraft : '[No solution draft entered yet - please write your architectural design here before sending, or paste it directly into chat]'}
---

Please provide an authoritative, senior-architect-grade evaluation of my solution structured as:
1. 🎯 Executive Verdict & Grade (Senior Architect Grade / Pass / Revisions Needed)
2. ✅ What is Good (Identify accurate sizing calculations, sound architectural decisions, and proper distributed failure boundaries)
3. ❌ What is Wrong / Risky (Identify any math errors, single points of failure, missing backpressure, cache stampede risks, race conditions, or unhandled partition modes)
4. 💡 What Can Be Improved (Concrete architectural optimizations, enterprise-grade production patterns, monitoring metrics like p99 latency & saturation thresholds, and scalability headroom)`;

  const blankPromptTemplate = milestone.customPrompt;

  const handleCopy = async (text: string, type: 'solution' | 'blank') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 3000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const { prev, next } = getAdjacentCourseItem(milestone.id, 'milestone');

  return (
    <div className="page-wrapper">
      <main className="container">
        {/* Header Breadcrumb & Badges */}
        <header style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="badge-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-coral">{milestone.badge}</span>
            <span className="badge">{milestone.time}</span>
            <span className="badge badge-teal">{milestone.tag}</span>
            {milestone.moduleBadge && <span className="badge">{milestone.moduleBadge}</span>}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '13px',
                fontWeight: 600,
                color: isCompleted ? '#2e7d32' : 'var(--color-muted)',
                backgroundColor: isCompleted ? 'var(--color-success-bg)' : 'var(--color-surface-soft)',
                border: `1px solid ${isCompleted ? '#a3cfbb' : 'var(--color-hairline)'}`,
                padding: '4px 12px',
                borderRadius: 'var(--rounded-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isCompleted ? '✓ Milestone Passed' : '○ Practical Test Pending'}
            </span>
          </div>

          <h1 style={{ marginTop: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
            {milestone.title}
          </h1>

          <p className="lead-text" style={{ color: 'var(--color-body)' }}>
            {milestone.summary}
          </p>
        </header>

        {/* Milestone Scenario Card */}
        <section
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: 'var(--space-xl)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          <div className="badge-row" style={{ marginBottom: 'var(--space-sm)' }}>
            <span className="badge badge-coral">Practical Scenario</span>
            <span className="badge">Real-World Case Study</span>
          </div>

          <h2 style={{ marginTop: 0, marginBottom: 'var(--space-sm)' }}>The Architectural Scenario</h2>
          <p style={{ fontSize: '16px', lineHeight: 1.65, color: 'var(--color-body-strong)' }}>
            {milestone.question.scenario}
          </p>

          <h3 style={{ marginTop: 'var(--space-lg)', marginBottom: 'var(--space-xs)' }}>
            Scale &amp; System Constraints
          </h3>
          <ul style={{ margin: '0 0 var(--space-md) 20px', lineHeight: 1.6 }}>
            {milestone.question.trafficAndScale.map((scaleItem, idx) => (
              <li key={idx} style={{ marginBottom: '6px', color: 'var(--color-body)' }}>
                <strong>{scaleItem.split(':')[0]}:</strong>
                {scaleItem.includes(':') ? scaleItem.substring(scaleItem.indexOf(':') + 1) : ''}
              </li>
            ))}
          </ul>

          <h3 style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-xs)' }}>
            Architectural Guardrails
          </h3>
          <div
            style={{
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline-soft)',
              borderRadius: 'var(--rounded-md)',
              padding: 'var(--space-md)',
            }}
          >
            <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
              {milestone.question.requirements.map((req, idx) => (
                <li key={idx} style={{ marginBottom: '4px', color: 'var(--color-body)' }}>
                  {req}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Deliverables & Tasks */}
        <section style={{ marginBottom: 'var(--space-xxl)' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Test Deliverables &amp; Design Challenges</h2>
          <p style={{ color: 'var(--color-muted)', marginBottom: 'var(--space-lg)' }}>
            Draft your answers for each section below. Be quantitative where requested, specify concrete failure defenses, and justify your design trade-offs.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {milestone.question.deliverables.map((deliv, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--color-canvas)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--rounded-lg)',
                  padding: 'var(--space-lg)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span
                    style={{
                      background: 'var(--color-primary)',
                      color: '#fff',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{deliv.section}</h3>
                </div>
                <p style={{ color: 'var(--color-muted)', margin: '0 0 var(--space-md) 36px', fontSize: '14px' }}>
                  {deliv.description}
                </p>

                <div style={{ marginLeft: '36px' }}>
                  <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.65 }}>
                    {deliv.tasks.map((task, tIdx) => (
                      <li key={tIdx} style={{ marginBottom: '10px', color: 'var(--color-body)' }}>
                        {task}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Workspace & Custom AI Prompt Generator */}
        <section
          style={{
            background: 'var(--color-surface-soft)',
            border: '2px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: 'var(--space-xl)',
            marginBottom: 'var(--space-xxl)',
          }}
        >
          <div className="badge-row" style={{ marginBottom: 'var(--space-xs)' }}>
            <span className="badge badge-coral">Solution Workspace &amp; Review Submission</span>
            <span className="badge">AI Assisted Review</span>
          </div>

          <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Draft Your Solution &amp; Submit for Review</h2>
          <p style={{ color: 'var(--color-body)', fontSize: '15px', marginBottom: 'var(--space-lg)' }}>
            Type or paste your architectural design below. When ready, click <strong>"Copy Review Prompt with Solution"</strong> and submit it directly in this chat. Your personal AI tutor will evaluate your submission with an authoritative structured critique.
          </p>

          {/* Solution Editor Textarea */}
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
              <label htmlFor="solution-draft" style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-body-strong)' }}>
                Your Architectural Solution Draft:
              </label>
              {lastSaved && (
                <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  ✓ Autosaved at {lastSaved}
                </span>
              )}
            </div>

            <textarea
              id="solution-draft"
              rows={14}
              value={solutionDraft}
              onChange={(e) => setSolutionDraft(e.target.value)}
              placeholder={`# 1. Back-of-the-Envelope Capacity Sizing\n- Peak bandwidth calculation:\n- Compute instance count:\n- Redis cluster memory:\n\n# 2. Architecture & Topology\n- Network flow diagram/description:\n- L4 vs L7 load balancing defense:\n- Token authentication strategy:\n\n# 3. Failure Modes & Resilience\n- Cascading health check defense:\n- Graceful shutdown sequence:`}
              className="milestone-solution-textarea"
            />
          </div>

          {/* Action Buttons for Copying Custom Prompt */}
          <div className="milestone-copy-actions">
            <button
              type="button"
              className="btn btn-primary milestone-copy-btn"
              onClick={() => handleCopy(fullReviewPrompt, 'solution')}
            >
              <span>📋</span>
              <span>
                {copiedType === 'solution'
                  ? '✓ Copied to Clipboard!'
                  : 'Copy Review Prompt with Solution'}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-secondary milestone-copy-btn"
              onClick={() => handleCopy(blankPromptTemplate, 'blank')}
            >
              <span>📄</span>
              <span>
                {copiedType === 'blank' ? '✓ Template Copied!' : 'Copy Blank Template'}
              </span>
            </button>

            {solutionDraft.trim().length > 0 && (
              <span className="milestone-word-count" style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                {solutionDraft.trim().split(/\s+/).length} words drafted
              </span>
            )}
          </div>

          {/* Toast Notice */}
          {copiedType && (
            <div
              style={{
                background: 'var(--color-success-bg)',
                border: '1px solid #c2e2cc',
                color: 'var(--success-text)',
                padding: '12px 16px',
                borderRadius: 'var(--rounded-md)',
                marginBottom: 'var(--space-lg)',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>✓</span>
              <span>
                Prompt copied to clipboard! Paste it into the assistant chat to get your structured review.
              </span>
            </div>
          )}

          {/* What to Expect Callout */}
          <div
            style={{
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--rounded-md)',
              padding: 'var(--space-md)',
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '15px' }}>What happens when you submit in chat?</h4>
            <p style={{ margin: '0 0 8px', fontSize: '13.5px', color: 'var(--color-body)' }}>
              Your assistant will examine your solution against senior staff architect criteria and provide an objective, 3-pillar structured review:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <div style={{ padding: '8px 12px', background: 'var(--color-success-bg)', borderRadius: 'var(--rounded-sm)', border: '1px solid #c2e2cc' }}>
                <strong style={{ color: '#1d6030', fontSize: '13px' }}>✅ What is Good</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#2d4b35' }}>
                  Accurate sizing calculations, sound component boundaries, and proper failure isolation.
                </p>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--color-error-bg)', borderRadius: 'var(--rounded-sm)', border: '1px solid #f0c9c9' }}>
                <strong style={{ color: '#a32b2b', fontSize: '13px' }}>❌ What is Wrong / Risky</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#572222' }}>
                  Math sizing errors, single points of failure, missing backpressure, or unhandled lag anomalies.
                </p>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--color-warning-bg)', borderRadius: 'var(--rounded-sm)', border: '1px solid #ebd9a2' }}>
                <strong style={{ color: '#805d00', fontSize: '13px' }}>💡 What Can Be Improved</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#544211' }}>
                  Enterprise production optimizations, tuning p99 metrics, and concrete hardening steps.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Evaluation Rubric Card */}
        <section
          style={{
            background: 'var(--color-canvas)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: 'var(--space-xl)',
            marginBottom: 'var(--space-xxl)',
          }}
        >
          <div className="badge-row" style={{ marginBottom: 'var(--space-xs)' }}>
            <span className="badge">Assessment Standards</span>
            <span className="badge">Architectural Rubric</span>
          </div>

          <h2 style={{ marginTop: 0, marginBottom: 'var(--space-sm)' }}>Evaluation Rubric</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '14.5px', marginBottom: 'var(--space-md)' }}>
            Solutions are judged using the same standards expected at Staff/Principal System Architecture interviews at tier-1 technology companies:
          </p>

          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.7 }}>
            {milestone.question.evaluationCriteria.map((crit, idx) => (
              <li key={idx} style={{ color: 'var(--color-body)', marginBottom: '8px' }}>
                <strong>{crit.split(':')[0]}:</strong>
                {crit.includes(':') ? crit.substring(crit.indexOf(':') + 1) : ''}
              </li>
            ))}
          </ul>
        </section>

        {/* Milestone Completion & Bottom Navigation */}
        <div className="lesson-nav-bar">
          <div className="lesson-nav-status">
            {isCompleted ? (
              <button
                type="button"
                className="btn lesson-status-btn-completed"
                onClick={() => toggleMilestoneStatus(milestone.id)}
                title="Click to toggle status back to In Progress"
              >
                <span>✓ Milestone Completed</span>
                <span style={{ fontSize: '11px', opacity: 0.7 }}>(Undo)</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => markMilestoneCompleted(milestone.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  width: '100%',
                  justifyContent: 'center',
                }}
                title="Mark this milestone practical test as completed"
              >
                <span>✓ Mark Milestone as Passed</span>
              </button>
            )}
          </div>

          <div className="lesson-nav-links-row">
            <div className="lesson-nav-prev">
              {prev ? (
                <Link
                  to={prev.path}
                  className="btn btn-secondary"
                >
                  <span className="nav-arrow">←</span>
                  <span className="nav-text-full">Previous: {prev.navTitle}</span>
                  <span className="nav-text-short">Prev: {prev.badge}</span>
                </Link>
              ) : (
                <Link to="/" className="btn btn-secondary">
                  <span className="nav-arrow">←</span>
                  <span>Course Overview</span>
                </Link>
              )}
            </div>

            <div className="lesson-nav-next">
              {next ? (
                <Link
                  to={next.path}
                  className="btn btn-primary"
                >
                  <span className="nav-text-full">Next: {next.navTitle}</span>
                  <span className="nav-text-short">Next: {next.badge}</span>
                  <span className="nav-arrow">→</span>
                </Link>
              ) : (
                <Link to="/" className="btn btn-primary">
                  <span>Curriculum Completed ✓</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        <AgentReminder
          title="Interactive Tutor Feedback"
          promptText={`Finished your draft? Paste the prompt in chat: "Here is my solution for ${milestone.badge}..." and I will give you a comprehensive architectural review!`}
        />
      </main>
    </div>
  );
};
