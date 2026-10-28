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
    <div className="lesson-nav-bar">
      <div className="lesson-nav-status">
        {isCompleted ? (
          <button
            type="button"
            className="btn lesson-status-btn-completed"
            onClick={() => markInProgress(currentLessonId)}
            title="Click to revert status back to In Progress"
          >
            <span>✓ Completed</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>(Click to undo)</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary lesson-status-btn-pending"
            onClick={() => markCompleted(currentLessonId)}
            title="Mark this lesson as completed"
          >
            <span>✓ Mark Lesson as Completed</span>
          </button>
        )}
      </div>

      <div className="lesson-nav-links-row">
        <div className="lesson-nav-prev">
          {prev ? (
            <Link
              to={prev.path || `/lessons/${prev.id}`}
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
              to={next.path || `/lessons/${next.id}`}
              className="btn btn-primary"
            >
              <span className="nav-text-full">Next: {next.navTitle}</span>
              <span className="nav-text-short">Next: {next.badge}</span>
              <span className="nav-arrow">→</span>
            </Link>
          ) : (
            <Link to="/" className="btn btn-primary">
              <span>Complete Curriculum ✓</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
