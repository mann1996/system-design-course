import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { curriculum } from '../data/curriculum';
import { AgentReminder } from '../components/UI/AgentReminder';
import { useLessonProgress } from '../context/LessonProgressContext';
import { CurriculumProgressBanner, FilterStatus } from '../components/UI/CurriculumProgressBanner';
import { LessonStatusBadge } from '../components/UI/LessonStatusBadge';

export const Home: React.FC = () => {
  const { getStatus, cycleStatus, nextSuggestedLesson, getMilestoneStatus } = useLessonProgress();
  const [filter, setFilter] = useState<FilterStatus>('all');

  return (
    <div className="page-wrapper">
      <main className="container">
        <header className="hero-split">
          <div>
            <div className="badge-row">
              <span className="badge badge-coral">Curriculum</span>
              <span className="badge">TypeScript &amp; Node.js Native</span>
              <span className="badge">Progressive Web App</span>
            </div>
            <h1>{curriculum.curriculumTitle}</h1>
            <p className="lead-text">
              Transition from an AI prompt-committer into an authoritative technical architect who evaluates trade-offs with mathematical precision, anticipates distributed failure modes, and designs resilient production systems.
            </p>
            <div className="hero-actions">
              {nextSuggestedLesson ? (
                <Link to={`/lessons/${nextSuggestedLesson.id}`} className="btn btn-primary">
                  {getStatus(nextSuggestedLesson.id) === 'in_progress'
                    ? `Resume: ${nextSuggestedLesson.title.split(':')[0]} →`
                    : `Start ${nextSuggestedLesson.badge} →`}
                </Link>
              ) : (
                <Link to="/lessons/0001" className="btn btn-primary">
                  Start Lesson 0001 &rarr;
                </Link>
              )}
              <Link to="/reference/ref-latency" className="btn btn-secondary">
                Explore Reference Sheets
              </Link>
            </div>
          </div>
        </header>

        {/* Progress Tracker & Filter Banner */}
        <CurriculumProgressBanner currentFilter={filter} onFilterChange={setFilter} />

        {/* Curriculum Modules */}
        {curriculum.modules.map((mod) => {
          const displayedLessons = mod.lessons.filter((les) => {
            if (filter === 'all') return true;
            return getStatus(les.id) === filter;
          });

          if (displayedLessons.length === 0) return null;

          return (
            <React.Fragment key={mod.id}>
              <h2>{mod.title}</h2>
              <p style={{ color: 'var(--color-body)', fontSize: '16px', lineHeight: 1.6, marginBottom: 'var(--space-lg)' }}>
                {mod.description}
              </p>

              <div className="curriculum-grid">
                {displayedLessons.map((les) => {
                  const status = getStatus(les.id);
                  let cardClass = 'lesson-card';
                  if (status === 'completed') cardClass += ' is-completed';
                  if (status === 'in_progress') cardClass += ' is-in-progress';

                  let actionText = 'Read Lesson';
                  if (status === 'completed') actionText = 'Review Lesson';
                  else if (status === 'in_progress') actionText = 'Continue Reading';

                  return (
                    <Link key={les.id} to={`/lessons/${les.id}`} className={cardClass}>
                      <div>
                        <div
                          className="badge-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="badge badge-coral">{les.badge}</span>
                            <span className="badge">{les.time}</span>
                            <span className="badge badge-teal">{les.tag}</span>
                          </div>

                          <LessonStatusBadge
                            status={status}
                            size="sm"
                            interactive
                            onClick={(e) => {
                              e.preventDefault();
                              cycleStatus(les.id);
                            }}
                            title="Click to toggle status: Not Started → Reading → Completed"
                          />
                        </div>
                        <h3>{les.title}</h3>
                        <p>{les.summary}</p>
                      </div>
                      <div className="lesson-meta">
                        <span style={{ fontWeight: status === 'in_progress' ? 600 : 500 }}>
                          {actionText}
                        </span>
                        <span>&rarr;</span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Concluding Milestone Practical Test */}
              {mod.milestone && (filter === 'all' || (filter === 'completed' && getMilestoneStatus(mod.milestone.id) === 'completed')) && (
                <div
                  style={{
                    marginTop: 'var(--space-md)',
                    marginBottom: 'var(--space-xl)',
                    background: 'var(--color-surface-soft)',
                    border: '1.5px solid var(--color-hairline)',
                    borderRadius: 'var(--rounded-lg)',
                    padding: 'var(--space-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-coral">{mod.milestone.badge}</span>
                      <span className="badge">{mod.milestone.time}</span>
                      <span className="badge badge-teal">{mod.milestone.tag}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>
                        End of {mod.badge}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: getMilestoneStatus(mod.milestone.id) === 'completed' ? '#2e7d32' : 'var(--color-muted)',
                        backgroundColor: getMilestoneStatus(mod.milestone.id) === 'completed' ? 'var(--color-success-bg)' : 'transparent',
                        border: `1px solid ${getMilestoneStatus(mod.milestone.id) === 'completed' ? '#a3cfbb' : 'var(--color-hairline)'}`,
                        padding: '2px 10px',
                        borderRadius: 'var(--rounded-pill)',
                      }}
                    >
                      {getMilestoneStatus(mod.milestone.id) === 'completed' ? '✓ Milestone Passed' : 'Practical Test Pending'}
                    </span>
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '18px' }}>{mod.milestone.title}</h3>
                    <p style={{ margin: 0, color: 'var(--color-body)', fontSize: '14.5px', lineHeight: 1.55 }}>
                      {mod.milestone.summary}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <Link
                      to={`/milestones/${mod.milestone.id}`}
                      className="btn btn-primary"
                      style={{ fontSize: '13px', padding: '6px 16px' }}
                    >
                      <span>
                        {getMilestoneStatus(mod.milestone.id) === 'completed'
                          ? 'Review Practical Test Solution →'
                          : 'Take Milestone Practical Test →'}
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Empty state if current filter has zero matching lessons */}
        {curriculum.modules.every((mod) => mod.lessons.every((les) => getStatus(les.id) !== filter)) &&
          filter !== 'all' && (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--space-xxl) var(--space-md)',
                background: 'var(--color-surface-soft)',
                border: '1px dashed var(--color-hairline)',
                borderRadius: 'var(--rounded-lg)',
                margin: 'var(--space-lg) 0',
              }}
            >
              <h3 style={{ margin: '0 0 8px' }}>No lessons matching "{filter.replace('_', ' ')}"</h3>
              <p style={{ color: 'var(--color-muted)', margin: '0 0 16px' }}>
                You have no lessons marked as {filter === 'in_progress' ? 'currently reading' : filter}.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setFilter('all')}
              >
                View All Lessons
              </button>
            </div>
          )}

        <h2>Permanent Reference Sheets</h2>
        <p style={{ color: 'var(--color-body)', fontSize: '16px', lineHeight: 1.6, marginBottom: 'var(--space-lg)' }}>
          High-density, print-ready cheat sheets and architectural laws designed for quick lookups during system design interviews and client projects.
        </p>

        <div className="reference-grid">
          {curriculum.references.map((ref) => (
            <Link key={ref.id} to={`/reference/${ref.id}`} className="lesson-card">
              <div>
                <div className="badge-row">
                  <span className="badge">{ref.badge}</span>
                  <span className="badge">{ref.category}</span>
                </div>
                <h3>{ref.title}</h3>
                <p>{ref.summary}</p>
              </div>
              <div className="lesson-meta">
                <span>Open Reference</span>
                <span>&rarr;</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="callout callout-coral">
          <h3>Architectural Philosophy</h3>
          <p>
            "A senior system architect never evaluates an architecture based on how cool the buzzwords sound. Sizing calculations and failure boundary analysis always come first."
          </p>
        </div>

        <AgentReminder
          title="Interactive Learning Mode"
          promptText={`Every lesson and reference sheet includes guided prompts. Ask an AI chat of your choice: "Let's review the trade-offs in Lesson 0001!"`}
        />
      </main>
    </div>
  );
};
