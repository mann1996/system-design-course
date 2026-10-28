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
    <div
      className="lesson-header-status-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '12px 16px',
        marginBottom: 'var(--space-lg)',
        background: 'var(--color-surface-soft)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--rounded-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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

      <LessonStatusControl
        status={currentStatus}
        onChange={(newStatus) => setStatus(lessonId, newStatus)}
        size="sm"
      />
    </div>
  );
};
