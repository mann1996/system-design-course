import React from 'react';
import { useLessonProgress } from '../../context/LessonProgressContext';
import { LessonStatusControl } from './LessonStatusControl';

interface LessonHeaderStatusProps {
  lessonId: string;
}

export const LessonHeaderStatus: React.FC<LessonHeaderStatusProps> = ({ lessonId }) => {
  const { getStatus, setStatus } = useLessonProgress();
  const currentStatus = getStatus(lessonId);

  return (
    <div className="lesson-header-status-bar">
      <div className="lesson-header-status-info">
        <span className="lesson-header-status-label">
          Learning State:
        </span>
        {currentStatus === 'completed' && (
          <span style={{ fontSize: '13px', color: '#2e7d32', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>✓ Completed</span>
          </span>
        )}
        {currentStatus === 'in_progress' && (
          <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>📖 Currently Reading</span>
          </span>
        )}
        {currentStatus === 'not_started' && (
          <span style={{ fontSize: '13px', color: 'var(--color-muted)', fontWeight: 500 }}>
            Not Started
          </span>
        )}
      </div>

      <div className="lesson-header-status-controls">
        <LessonStatusControl
          status={currentStatus}
          onChange={(newStatus) => setStatus(lessonId, newStatus)}
          size="sm"
        />
      </div>
    </div>
  );
};
