import React from 'react';
import { Link } from 'react-router-dom';
import { getAdjacentLessons } from '../../data/curriculum';
import { useLessonProgress } from '../../context/LessonProgressContext';

interface LessonNavButtonsProps {
  currentLessonId: string;
}

export const LessonNavButtons: React.FC<LessonNavButtonsProps> = ({ currentLessonId }) => {
  const { prev, next } = getAdjacentLessons(currentLessonId);
  const { getStatus, markCompleted, markInProgress } = useLessonProgress();
  const currentStatus = getStatus(currentLessonId);
  const isCompleted = currentStatus === 'completed';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        margin: '48px 0 24px',
        paddingTop: '24px',
        borderTop: '1px solid var(--color-hairline)',
      }}
    >
      <div>
        {prev ? (
          <Link
            to={prev.path || `/lessons/${prev.id}`}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            ← Previous: {prev.navTitle}
          </Link>
        ) : (
          <Link to="/" className="btn btn-secondary">
            ← Course Overview
          </Link>
        )}
      </div>

      <div>
        {isCompleted ? (
          <button
            type="button"
            className="btn"
            onClick={() => markInProgress(currentLessonId)}
            style={{
              backgroundColor: 'var(--color-success-bg)',
              color: 'var(--success-text)',
              border: '1px solid #c2e2cc',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            title="Click to revert status back to In Progress"
          >
            <span>✓ Completed</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>(Click to undo)</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => markCompleted(currentLessonId)}
            style={{
              borderColor: 'var(--color-hairline)',
              color: 'var(--color-body-strong)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            title="Mark this lesson as completed"
          >
            <span>✓ Mark as Completed</span>
          </button>
        )}
      </div>

      <div>
        {next ? (
          <Link
            to={next.path || `/lessons/${next.id}`}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            Next: {next.navTitle} →
          </Link>
        ) : (
          <Link to="/" className="btn btn-primary">
            Complete Curriculum ✓
          </Link>
        )}
      </div>
    </div>
  );
};
