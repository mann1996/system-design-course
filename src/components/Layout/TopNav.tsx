import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { allLessons, allReferences, allMilestones, getLessonById, getMilestoneById, getAdjacentLessons, getAdjacentCourseItem } from '../../data/curriculum';
import { usePWA } from '../../hooks/usePWA';
import { useLessonProgress } from '../../context/LessonProgressContext';

export const TopNav: React.FC = () => {
  const location = useLocation();
  const { isInstallable, installApp, isOffline } = usePWA();
  const { getStatus, getMilestoneStatus, stats, nextSuggestedLesson } = useLessonProgress();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'lessons' | 'milestones' | 'reference'>('lessons');

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

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

  const getCtaLabel = (isMobileShort: boolean = false) => {
    if (activeLessonId) {
      return isMobileShort ? 'Next →' : 'Next Lesson →';
    }
    if (activeMilestoneId) {
      return 'Next →';
    }
    if (!nextTarget) {
      return isMobileShort ? 'Curriculum' : 'Curriculum Overview';
    }
    const isReading = getStatus(nextTarget.id) === 'in_progress';
    if (isMobileShort) {
      return isReading ? 'Resume →' : 'Start →';
    }
    return isReading ? `Resume: ${nextTarget.badge} →` : `Start ${nextTarget.badge} →`;
  };

  return (
    <>
      <nav className="top-nav">
        <div className="top-nav-inner">
          <Link to="/" className="brand-group" onClick={() => setMobileMenuOpen(false)}>
            <svg className="brand-spike" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0c.5 6.6 5.4 11.5 12 12-6.6.5-11.5 5.4-12 12-.5-6.6-5.4-11.5-12-12 6.6-.5 11.5-5.4 12-12z" />
            </svg>
            <span className="brand-title">System Design</span>
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
          <div className="top-nav-actions">
            {isOffline && (
              <span className="badge badge-offline-desktop">
                Offline Ready
              </span>
            )}

            {isInstallable && (
              <button
                onClick={installApp}
                className="btn btn-secondary install-app-btn-desktop"
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
                className="btn btn-primary top-nav-cta-btn"
              >
                <span className="cta-text-full">{getCtaLabel(false)}</span>
                <span className="cta-text-short">{getCtaLabel(true)}</span>
              </Link>
            ) : (
              <Link
                to="/"
                className="btn btn-primary top-nav-cta-btn"
              >
                <span className="cta-text-full">Curriculum Overview</span>
                <span className="cta-text-short">Curriculum</span>
              </Link>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Backdrop & Drawer (Rendered outside the 64px nav flexbox) */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {mobileMenuOpen && (
        <aside
          className="mobile-menu-drawer"
          aria-label="Mobile Navigation"
        >
          {/* Mobile Top Summary Card */}
          <div className="mobile-drawer-header-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-coral" style={{ fontSize: '11px' }}>Your Progress</span>
                {isOffline && (
                  <span className="badge" style={{ fontSize: '10.5px', background: 'var(--color-surface-soft)' }}>
                    Offline Ready
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)' }}>
                {stats.percentCompleted}% Completed
              </span>
            </div>

            <div
              style={{
                width: '100%',
                height: '6px',
                background: 'var(--color-surface-cream-strong)',
                borderRadius: 'var(--rounded-pill)',
                overflow: 'hidden',
                marginBottom: '10px',
              }}
            >
              <div
                style={{
                  width: `${stats.percentCompleted}%`,
                  height: '100%',
                  background: stats.percentCompleted === 100 ? '#48a463' : 'var(--color-primary)',
                  borderRadius: 'var(--rounded-pill)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '12px', padding: '6px 10px', textAlign: 'center', justifyContent: 'center' }}
              >
                Curriculum Overview
              </Link>
              {isInstallable && (
                <button
                  onClick={() => {
                    installApp();
                    setMobileMenuOpen(false);
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '12px', padding: '6px 10px', justifyContent: 'center' }}
                >
                  Install PWA App
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation for Drawer */}
          <div className="mobile-drawer-tabs">
            <button
              type="button"
              className={`mobile-drawer-tab ${mobileActiveTab === 'lessons' ? 'active' : ''}`}
              onClick={() => setMobileActiveTab('lessons')}
            >
              <span>Lessons ({stats.completedCount}/{stats.totalLessons})</span>
            </button>
            <button
              type="button"
              className={`mobile-drawer-tab ${mobileActiveTab === 'milestones' ? 'active' : ''}`}
              onClick={() => setMobileActiveTab('milestones')}
            >
              <span>Milestones ({stats.completedMilestones}/{stats.totalMilestones})</span>
            </button>
            <button
              type="button"
              className={`mobile-drawer-tab ${mobileActiveTab === 'reference' ? 'active' : ''}`}
              onClick={() => setMobileActiveTab('reference')}
            >
              <span>Reference</span>
            </button>
          </div>

          {/* Tab 1: Lessons */}
          {mobileActiveTab === 'lessons' && (
            <div className="mobile-drawer-list">
              {allLessons.map((l) => {
                const isActive = activeLessonId === l.id;
                return (
                  <Link
                    key={l.id}
                    to={`/lessons/${l.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`mobile-drawer-item ${isActive ? 'is-active' : ''}`}
                  >
                    <div className="mobile-drawer-item-left">
                      <span className="mobile-drawer-status-bullet">
                        {renderStatusIcon(l.id)}
                      </span>
                      <div className="mobile-drawer-item-text">
                        <span className="mobile-drawer-item-title">{l.navTitle}</span>
                        <span className="mobile-drawer-item-badge">{l.badge} &bull; {l.time}</span>
                      </div>
                    </div>
                    <span className="mobile-drawer-arrow">&rarr;</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Tab 2: Milestones */}
          {mobileActiveTab === 'milestones' && (
            <div className="mobile-drawer-list">
              {allMilestones.map((m) => {
                const isActive = activeMilestoneId === m.id;
                const isPassed = getMilestoneStatus(m.id) === 'completed';
                return (
                  <Link
                    key={m.id}
                    to={`/milestones/${m.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`mobile-drawer-item ${isActive ? 'is-active' : ''}`}
                  >
                    <div className="mobile-drawer-item-left">
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isPassed ? 'var(--color-success-bg)' : 'var(--color-surface-soft)',
                          color: isPassed ? '#2e7d32' : 'var(--color-muted)',
                          border: `1px solid ${isPassed ? '#a3cfbb' : 'var(--color-hairline)'}`,
                          flexShrink: 0,
                        }}
                      >
                        {isPassed ? '✓' : '○'}
                      </span>
                      <div className="mobile-drawer-item-text">
                        <span className="mobile-drawer-item-title">{m.navTitle}</span>
                        <span className="mobile-drawer-item-badge">{m.badge} &bull; {m.time}</span>
                      </div>
                    </div>
                    <span className="mobile-drawer-arrow">&rarr;</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Tab 3: Reference */}
          {mobileActiveTab === 'reference' && (
            <div className="mobile-drawer-list">
              {allReferences.map((r) => {
                const isActive = activeRefId === r.id || activeRefId === r.filename.replace('.html', '');
                return (
                  <Link
                    key={r.id}
                    to={`/reference/${r.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`mobile-drawer-item ${isActive ? 'is-active' : ''}`}
                  >
                    <div className="mobile-drawer-item-left">
                      <span className="badge" style={{ fontSize: '11px', padding: '2px 6px', flexShrink: 0 }}>
                        {r.badge}
                      </span>
                      <div className="mobile-drawer-item-text">
                        <span className="mobile-drawer-item-title">{r.navTitle}</span>
                        <span className="mobile-drawer-item-badge">{r.category}</span>
                      </div>
                    </div>
                    <span className="mobile-drawer-arrow">&rarr;</span>
                  </Link>
                );
              })}
            </div>
          )}
        </aside>
      )}
    </>
  );
};
