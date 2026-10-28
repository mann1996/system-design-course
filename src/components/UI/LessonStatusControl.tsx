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
  const options: { value: LessonStatus; label: string; shortLabel: string; icon: string }[] = [
    { value: 'not_started', label: 'Not Started', shortLabel: 'Not Started', icon: '○' },
    { value: 'in_progress', label: 'Currently Reading', shortLabel: 'Reading', icon: '📖' },
    { value: 'completed', label: 'Completed', shortLabel: 'Done', icon: '✓' },
  ];

  return (
    <div
      className="status-segmented-control"
      role="radiogroup"
      aria-label="Set lesson learning state"
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
            className={`status-segment-btn ${isSelected ? 'is-selected' : ''} ${size === 'sm' ? 'btn-size-sm' : 'btn-size-md'}`}
            style={{
              color: isSelected ? activeColor : 'var(--color-muted)',
              backgroundColor: isSelected ? activeBg : 'transparent',
              borderColor: isSelected ? activeBorder.split(' ')[2] : 'transparent',
            }}
          >
            <span className="status-segment-icon">{opt.icon}</span>
            <span className="status-label-full">{opt.label}</span>
            <span className="status-label-short">{opt.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
};
