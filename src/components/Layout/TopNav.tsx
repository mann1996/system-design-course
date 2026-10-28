import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { allLessons, allReferences, allMilestones, getLessonById, getMilestoneById, getAdjacentLessons, getAdjacentCourseItem } from '../../data/curriculum';
import { usePWA } from '../../hooks/usePWA';
import { useLessonProgress } from '../../context/LessonProgressContext';

export const TopNav: React.FC = () => {
  const location = useLocation();
  const { isInstallable, installApp, isOffline } = usePWA();
  const { getStatus, getMilestoneStatus, stats, nextSuggestedLesson } = useLessonProgress();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine current context for breadcrumb
  let contextLabel = 'Curriculum';
  let activeLessonId: string | null = null;
  let activeRefId: string | null = null;
  let activeMilestoneId: string | null = null;

  if (location.pathname.startsWith('/lessons/')) {
    const rawId = location.pathname.replace('/lessons/', '').replace('.html', '');
    const found = getLessonById(rawId);
    if (found) {
      contextLabel = found.badge;
      activeLessonId = found.id;
    } else {
      contextLabel = 'Lesson';
    }
  } else if (location.pathname.startsWith('/milestones/')) {
    const rawId = location.pathname.replace('/milestones/', '').replace('.html', '');
    const found = getMilestoneById(rawId);
    if (found) {
      contextLabel = found.badge;
      activeMilestoneId = found.id;
    } else {
      contextLabel = 'Milestone Test';
    }
  } else if (location.pathname.startsWith('/reference/')) {
    contextLabel = 'Reference Sheet';
    activeRefId = location.pathname.replace('/reference/', '').replace('.html', '');
  }

  // Next lesson calculation for CTA
  const nextTarget = activeLessonId
    ? getAdjacentLessons(activeLessonId).next
    : activeMilestoneId
    ? getAdjacentCourseItem(activeMilestoneId, 'milestone').next
    : nextSuggestedLesson
    ? { id: nextSuggestedLesson.id, badge: nextSuggestedLesson.badge, path: `/lessons/${nextSuggestedLesson.id}`, navTitle: nextSuggestedLesson.navTitle }
    : allLessons[0]
    ? { id: allLessons[0].id, badge: allLessons[0].badge, path: `/lessons/${allLessons[0].id}`, navTitle: allLessons[0].navTitle }
    : null;

  const renderStatusIcon = (lessonId: string) => {
    const status = getStatus(lessonId);
    if (status === 'completed') {
      return (
        <span
          title="Completed"
          style={{
            color: '#2e7d32',
            fontSize: '13px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          ✓
        </span>
      );
    }
    if (status === 'in_progress') {
      return (
        <span
          title="Currently Reading"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary)',
            display: 'inline-block',
            boxShadow: '0 0 0 2px rgba(204, 120, 92, 0.2)',
          }}
        />
      );
    }
    return (
      <span
        title="Not Started"
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          border: '1.5px solid var(--color-muted-soft)',
          display: 'inline-block',
          opacity: 0.6,
        }}
      />
    );
  };

  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <Link to="/" className="brand-group" onClick={() => setMobileMenuOpen(false)}>
          <svg className="brand-spike" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0c.5 6.6 5.4 11.5 12 12-6.6.5-11.5 5.4-12 12-.5-6.6-5.4-11.5-12-12 6.6-.5 11.5-5.4 12-12z" />
          </svg>
          <span>System Design</span>
          <span className="brand-divider">/</span>
          <span className="brand-sub">{contextLabel}</span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="top-nav-links">
          <Link
            to="/"
            className={location.pathname === '/' ? 'active' : ''}
            style={{ fontWeight: location.pathname === '/' ? 600 : 500 }}
          >
            Curriculum
          </Link>

          {/* Lessons Dropdown */}
          <div className={`nav-dropdown ${location.pathname.startsWith('/lessons') ? 'active' : ''}`}>
            <button className="nav-dropdown-trigger" type="button" aria-expanded="false">
              <span>Lessons</span>
              {stats.completedCount > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 'var(--rounded-pill)',
                    backgroundColor: 'var(--color-surface-soft)',
                    border: '1px solid var(--color-hairline)',
                    color: 'var(--color-body-strong)',
                  }}
                >
                  {stats.completedCount}/{stats.totalLessons}
                </span>
              )}
              <svg className="nav-dropdown-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
            <ul className="nav-dropdown-menu">
              {allLessons.map((l) => {
                const isActive = activeLessonId === l.id;
                return (
                  <li key={l.id} className="nav-dropdown-item">
                    <Link
                      to={`/lessons/${l.id}`}
                      className={isActive ? 'active' : ''}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="nav-item-num">{l.badge}</span>
                        <span className="nav-item-title">{l.navTitle}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                        {renderStatusIcon(l.id)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Milestones Dropdown */}
          <div className={`nav-dropdown ${location.pathname.startsWith('/milestones') ? 'active' : ''}`}>
            <button className="nav-dropdown-trigger" type="button" aria-expanded="false">
              <span>Milestones</span>
              {stats.completedMilestones > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 'var(--rounded-pill)',
                    backgroundColor: 'var(--color-surface-soft)',
                    border: '1px solid var(--color-hairline)',
                    color: 'var(--color-body-strong)',
                  }}
                >
                  {stats.completedMilestones}/{stats.totalMilestones}
                </span>
              )}
              <svg className="nav-dropdown-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
            <ul className="nav-dropdown-menu">
              {allMilestones.map((m) => {
                const isActive = activeMilestoneId === m.id;
                const isPassed = getMilestoneStatus(m.id) === 'completed';
                return (
                  <li key={m.id} className="nav-dropdown-item">
                    <Link
                      to={`/milestones/${m.id}`}
                      className={isActive ? 'active' : ''}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="nav-item-num">{m.badge}</span>
                        <span className="nav-item-title">{m.navTitle}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                        {isPassed ? (
                          <span title="Passed" style={{ color: '#2e7d32', fontSize: '13px', fontWeight: 700 }}>✓</span>
                        ) : (
                          <span
                            title="Pending"
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              border: '1.5px solid var(--color-muted-soft)',
                              display: 'inline-block',
                              opacity: 0.6,
                            }}
                          />
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Reference Sheets Dropdown */}
          <div className={`nav-dropdown ${location.pathname.startsWith('/reference') ? 'active' : ''}`}>
            <button className="nav-dropdown-trigger" type="button" aria-expanded="false">
              <span>Reference</span>
              <svg className="nav-dropdown-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
            <ul className="nav-dropdown-menu">
              {allReferences.map((r) => {
                const isActive = activeRefId === r.id || activeRefId === r.filename.replace('.html', '');
                return (
                  <li key={r.id} className="nav-dropdown-item">
                    <Link
                      to={`/reference/${r.id}`}
                      className={isActive ? 'active' : ''}
                    >
                      <span className="nav-item-num">{r.badge}</span>
                      <span className="nav-item-title">{r.navTitle}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isOffline && (
            <span
              className="badge"
              style={{
                background: 'var(--color-surface-cream-strong)',
                color: 'var(--color-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                padding: '4px 8px',
              }}
            >
              Offline Ready
            </span>
          )}

          {isInstallable && (
            <button
              onClick={installApp}
              className="btn btn-secondary"
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                height: '32px',
                borderColor: 'var(--color-hairline)',
              }}
            >
              Install App
            </button>
          )}

          {nextTarget ? (
            <Link
              to={nextTarget.path}
              className="btn btn-primary"
              style={{
                fontSize: '13px',
                padding: '7px 14px',
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {activeLessonId
                ? 'Next Lesson →'
                : activeMilestoneId
                ? 'Next →'
                : getStatus(nextTarget.id) === 'in_progress'
                ? `Resume: ${nextTarget.badge} →`
                : `Start ${nextTarget.badge} →`}
            </Link>
          ) : (
            <Link
              to="/"
              className="btn btn-primary"
              style={{
                fontSize: '13px',
                padding: '7px 14px',
                height: '34px',
              }}
            >
              Curriculum Overview
            </Link>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{
              display: 'none',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              color: 'var(--color-ink)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-drawer"
          style={{
            background: 'var(--color-surface-soft)',
            borderBottom: '1px solid var(--color-hairline)',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-muted)' }}>
              CURRICULUM LESSONS
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              {stats.completedCount}/{stats.totalLessons} Completed
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allLessons.map((l) => (
              <Link
                key={l.id}
                to={`/lessons/${l.id}`}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  color: activeLessonId === l.id ? 'var(--color-primary)' : 'var(--color-ink)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: activeLessonId === l.id ? 600 : 400,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {renderStatusIcon(l.id)}
                  <span>{l.navTitle}</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{l.badge}</span>
              </Link>
            ))}
          </div>

          <div style={{ height: '1px', background: 'var(--color-hairline)', margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-muted)' }}>
              MILESTONE PRACTICAL TESTS
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              {stats.completedMilestones}/{stats.totalMilestones} Passed
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allMilestones.map((m) => (
              <Link
                key={m.id}
                to={`/milestones/${m.id}`}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  color: activeMilestoneId === m.id ? 'var(--color-primary)' : 'var(--color-ink)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: activeMilestoneId === m.id ? 600 : 400,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{getMilestoneStatus(m.id) === 'completed' ? '✓' : '○'}</span>
                  <span>{m.navTitle}</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{m.badge}</span>
              </Link>
            ))}
          </div>

          <div style={{ height: '1px', background: 'var(--color-hairline)', margin: '8px 0' }} />

          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-muted)' }}>
            REFERENCE CHEAT SHEETS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allReferences.map((r) => (
              <Link
                key={r.id}
                to={`/reference/${r.id}`}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  color: activeRefId === r.id ? 'var(--color-primary)' : 'var(--color-ink)',
                  textDecoration: 'none',
                  fontSize: '14px',
                }}
              >
                <span>{r.navTitle}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{r.badge}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};
