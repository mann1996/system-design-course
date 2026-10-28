import React from 'react';
import { LessonStatus } from '../../context/LessonProgressContext';

interface LessonStatusControlProps {
  status: LessonStatus;
  onChange: (newStatus: LessonStatus) => void;
  size?: 'sm' | 'md';
}

export const LessonStatusControl: React.FC<LessonStatusControlProps> = ({
  status,
  onChange,
  size = 'md',
}) => {
  const options: { value: LessonStatus; label: string; icon: string }[] = [
    { value: 'not_started', label: 'Not Started', icon: '○' },
    { value: 'in_progress', label: 'Currently Reading', icon: '📖' },
    { value: 'completed', label: 'Completed', icon: '✓' },
  ];

  return (
    <div
      className="status-segmented-control"
      role="radiogroup"
      aria-label="Set lesson learning state"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--color-surface-soft)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--rounded-md)',
        padding: '3px',
        gap: '3px',
      }}
    >
      {options.map((opt) => {
        const isSelected = status === opt.value;
        let activeBg = '#ffffff';
        let activeColor = 'var(--color-ink)';
        let activeBorder = '1px solid var(--color-hairline)';

        if (isSelected) {
          if (opt.value === 'completed') {
            activeBg = 'var(--color-success-bg)';
            activeColor = 'var(--success-text)';
            activeBorder = '1px solid #c2e2cc';
          } else if (opt.value === 'in_progress') {
            activeBg = 'var(--color-primary)';
            activeColor = '#ffffff';
            activeBorder = '1px solid var(--color-primary)';
          } else {
            activeBg = 'var(--color-surface-cream-strong)';
            activeColor = 'var(--color-body-strong)';
            activeBorder = '1px solid var(--color-hairline)';
          }
        }

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: size === 'sm' ? '4px 10px' : '6px 14px',
              fontSize: size === 'sm' ? '12px' : '13px',
              fontWeight: isSelected ? 600 : 500,
              fontFamily: 'var(--font-sans)',
              color: isSelected ? activeColor : 'var(--color-muted)',
              backgroundColor: isSelected ? activeBg : 'transparent',
              border: isSelected ? activeBorder : '1px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: 'none',
              boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: opt.value === 'completed' ? '13px' : '11px' }}>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
