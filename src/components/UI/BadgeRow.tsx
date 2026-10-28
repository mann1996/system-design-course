import React from 'react';
import { useLessonProgress } from '../../context/LessonProgressContext';
import { LessonStatusBadge } from './LessonStatusBadge';

interface BadgeRowProps {
  lessonBadge?: string;
  moduleBadge?: string;
  time?: string;
  tag?: string;
  lessonId?: string;
  showStatus?: boolean;
}

export const BadgeRow: React.FC<BadgeRowProps> = ({
  lessonBadge,
  moduleBadge,
  time,
  tag,
  lessonId,
  showStatus = true,
}) => {
  const progressContext = useLessonProgress();

  const currentStatus = lessonId ? progressContext.getStatus(lessonId) : null;

  return (
    <div
      className="badge-row"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
      }}
    >
      {lessonBadge && <span className="badge badge-coral">{lessonBadge}</span>}
      {moduleBadge && <span className="badge">{moduleBadge}</span>}
      {time && <span className="badge">Est. Time: {time}</span>}
      {tag && <span className="badge badge-teal">{tag}</span>}
      {lessonId && showStatus && currentStatus && (
        <LessonStatusBadge
          status={currentStatus}
          interactive
          onClick={() => progressContext.cycleStatus(lessonId)}
          title="Click to change learning state"
        />
      )}
    </div>
  );
};
