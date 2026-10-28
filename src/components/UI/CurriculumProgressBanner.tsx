import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLessonProgress, LessonStatus } from '../../context/LessonProgressContext';

export type FilterStatus = 'all' | LessonStatus;

interface CurriculumProgressBannerProps {
  currentFilter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
}

export const CurriculumProgressBanner: React.FC<CurriculumProgressBannerProps> = ({
  currentFilter,
  onFilterChange,
}) => {
  const { stats, nextSuggestedLesson, currentlyReadingLessons, resetProgress } = useLessonProgress();
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleReset = () => {
    resetProgress();
    setShowConfirmReset(false);
  };

  return (
    <section
      className="progress-summary-card"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--rounded-lg)',
        padding: 'var(--space-lg)',
        marginBottom: 'var(--space-xl)',
        marginTop: 'var(--space-md)',
      }}
      aria-label="Your Learning Progress"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: 'var(--space-md)',
        }}
      >
        <div>
          <span
            className="badge badge-coral-subtle"
            style={{ marginBottom: '8px', display: 'inline-flex', fontSize: '11px', fontWeight: 600 }}
          >
            Learning Tracker
          </span>
          <h2 style={{ margin: '4px 0 6px', fontSize: '22px' }}>Curriculum Progress</h2>
          <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '14.5px' }}>
            {stats.completedCount} of {stats.totalLessons} lessons completed ({stats.percentCompleted}%)
            {stats.totalMilestones > 0 && ` • ${stats.completedMilestones} of ${stats.totalMilestones} milestones passed`}
            {stats.inProgressCount > 0 && ` • ${stats.inProgressCount} currently reading`}
            {stats.notStartedCount > 0 && ` • ${stats.notStartedCount} not started`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {nextSuggestedLesson && (
            <Link
              to={`/lessons/${nextSuggestedLesson.id}`}
              className="btn btn-primary"
              style={{ fontSize: '13px', padding: '8px 16px', height: '36px' }}
            >
              {currentlyReadingLessons.length > 0 ? (
                <>
                  <span>Resume: {nextSuggestedLesson.badge}</span>
                  <span>&rarr;</span>
                </>
              ) : stats.completedCount === stats.totalLessons ? (
                <span>Review Lessons &rarr;</span>
              ) : (
                <>
                  <span>Next: {nextSuggestedLesson.badge}</span>
                  <span>&rarr;</span>
                </>
              )}
            </Link>
          )}

          {!showConfirmReset ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowConfirmReset(true)}
              style={{ fontSize: '12px', padding: '6px 12px', height: '36px', color: 'var(--color-muted)' }}
              title="Reset all lesson progress states to Not Started"
            >
              Reset
            </button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-error)' }}>Reset all?</span>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleReset}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  height: '28px',
                  backgroundColor: 'var(--color-error)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--rounded-sm)',
                  cursor: 'pointer',
                }}
              >
                Yes
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirmReset(false)}
                style={{ fontSize: '11px', padding: '4px 8px', height: '28px' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar Track */}
      <div
        style={{
          width: '100%',
          height: '10px',
          backgroundColor: 'var(--color-surface-cream-strong)',
          borderRadius: 'var(--rounded-pill)',
          overflow: 'hidden',
          marginBottom: 'var(--space-md)',
          border: '1px solid var(--color-hairline-soft)',
        }}
        role="progressbar"
        aria-valuenow={stats.percentCompleted}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Curriculum completion percentage"
      >
        <div
          style={{
            width: `${stats.percentCompleted}%`,
            height: '100%',
            backgroundColor: stats.percentCompleted === 100 ? '#48a463' : 'var(--color-primary)',
            borderRadius: 'var(--rounded-pill)',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {/* Filter Tabs by State */}
      <div className="progress-filter-track">
        <span style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500, marginRight: '4px' }}>
          Filter View:
        </span>

        <button
          type="button"
          onClick={() => onFilterChange('all')}
          style={{
            border: currentFilter === 'all' ? '1px solid var(--color-ink)' : '1px solid var(--color-hairline)',
            background: currentFilter === 'all' ? 'var(--color-ink)' : 'var(--color-canvas)',
            color: currentFilter === 'all' ? 'var(--color-on-dark)' : 'var(--color-body)',
            padding: '4px 12px',
            borderRadius: 'var(--rounded-pill)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          All ({stats.totalLessons})
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('in_progress')}
          style={{
            border:
              currentFilter === 'in_progress'
                ? '1px solid var(--color-primary)'
                : '1px solid var(--color-hairline)',
            background:
              currentFilter === 'in_progress' ? 'var(--color-primary)' : 'var(--color-canvas)',
            color: currentFilter === 'in_progress' ? '#ffffff' : 'var(--color-primary)',
            padding: '4px 12px',
            borderRadius: 'var(--rounded-pill)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>Currently Reading ({stats.inProgressCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('completed')}
          style={{
            border:
              currentFilter === 'completed' ? '1px solid #2e7d32' : '1px solid var(--color-hairline)',
            background: currentFilter === 'completed' ? '#2e7d32' : 'var(--color-canvas)',
            color: currentFilter === 'completed' ? '#ffffff' : '#2e7d32',
            padding: '4px 12px',
            borderRadius: 'var(--rounded-pill)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>Completed ({stats.completedCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('not_started')}
          style={{
            border:
              currentFilter === 'not_started'
                ? '1px solid var(--color-muted)'
                : '1px solid var(--color-hairline)',
            background: currentFilter === 'not_started' ? 'var(--color-muted)' : 'var(--color-canvas)',
            color: currentFilter === 'not_started' ? '#ffffff' : 'var(--color-muted)',
            padding: '4px 12px',
            borderRadius: 'var(--rounded-pill)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Not Started ({stats.notStartedCount})
        </button>
      </div>
    </section>
  );
};
