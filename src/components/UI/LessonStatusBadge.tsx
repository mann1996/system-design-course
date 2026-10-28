import React from 'react';
import { LessonStatus } from '../../context/LessonProgressContext';

interface LessonStatusBadgeProps {
  status: LessonStatus;
  size?: 'sm' | 'md';
  interactive?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export const LessonStatusBadge: React.FC<LessonStatusBadgeProps> = ({
  status,
  size = 'md',
  interactive = false,
  onClick,
  title,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          label: 'Completed',
          icon: (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'inline-block' }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ),
          className: 'badge-status-completed',
          tooltip: 'Lesson completed',
        };
      case 'in_progress':
        return {
          label: 'Currently Reading',
          icon: (
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary)',
                display: 'inline-block',
                boxShadow: '0 0 0 2px rgba(204, 120, 92, 0.25)',
              }}
            />
          ),
          className: 'badge-status-reading',
          tooltip: 'Currently in progress',
        };
      case 'not_started':
      default:
        return {
          label: 'Not Started',
          icon: (
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                border: '1.5px solid var(--color-muted-soft)',
                display: 'inline-block',
              }}
            />
          ),
          className: 'badge-status-notstarted',
          tooltip: 'Not started yet',
        };
    }
  };

  const config = getStatusConfig();
  const padding = size === 'sm' ? '3px 8px' : '5px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      className={`badge ${config.className} ${interactive ? 'badge-interactive' : ''}`}
      style={{
        padding,
        fontSize,
        cursor: interactive ? 'pointer' : 'default',
        userSelect: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: status === 'completed' || status === 'in_progress' ? 600 : 500,
        transition: 'all 0.15s ease',
      }}
      onClick={onClick}
      title={title || config.tooltip}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.(e as any);
              }
            }
          : undefined
      }
    >
      {config.icon}
      <span>{config.label}</span>
      {interactive && (
        <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '2px' }}>⇄</span>
      )}
    </span>
  );
};
