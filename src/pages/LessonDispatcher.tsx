import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Lesson0001 } from './lessons/Lesson0001';
import { Lesson0002 } from './lessons/Lesson0002';
import { Lesson0003 } from './lessons/Lesson0003';
import { Lesson0004 } from './lessons/Lesson0004';
import { Lesson0005 } from './lessons/Lesson0005';
import { Lesson0006 } from './lessons/Lesson0006';
import { Lesson0007 } from './lessons/Lesson0007';
import { Lesson0008 } from './lessons/Lesson0008';
import { NotFound } from './NotFound';
import { useLessonProgress } from '../context/LessonProgressContext';

function resolveCanonicalLessonId(rawId: string): string | null {
  const clean = rawId.replace('.html', '');
  if (clean === '0001' || clean === '1' || clean.startsWith('0001-')) return '0001';
  if (clean === '0002' || clean === '2' || clean.startsWith('0002-')) return '0002';
  if (clean === '0003' || clean === '3' || clean.startsWith('0003-')) return '0003';
  if (clean === '0004' || clean === '4' || clean.startsWith('0004-')) return '0004';
  if (clean === '0005' || clean === '5' || clean.startsWith('0005-')) return '0005';
  if (clean === '0006' || clean === '6' || clean.startsWith('0006-')) return '0006';
  if (clean === '0007' || clean === '7' || clean.startsWith('0007-')) return '0007';
  if (clean === '0008' || clean === '8' || clean.startsWith('0008-')) return '0008';
  return null;
}

export const LessonDispatcher: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getStatus, markInProgress } = useLessonProgress();

  const canonicalId = id ? resolveCanonicalLessonId(id) : null;

  // Auto-mark as in_progress when opened if it's currently not_started
  useEffect(() => {
    if (canonicalId) {
      const current = getStatus(canonicalId);
      if (current === 'not_started') {
        markInProgress(canonicalId);
      }
    }
  }, [canonicalId, getStatus, markInProgress]);

  if (!id || !canonicalId) return <NotFound />;

  if (canonicalId === '0001') return <Lesson0001 />;
  if (canonicalId === '0002') return <Lesson0002 />;
  if (canonicalId === '0003') return <Lesson0003 />;
  if (canonicalId === '0004') return <Lesson0004 />;
  if (canonicalId === '0005') return <Lesson0005 />;
  if (canonicalId === '0006') return <Lesson0006 />;
  if (canonicalId === '0007') return <Lesson0007 />;
  if (canonicalId === '0008') return <Lesson0008 />;

  return <NotFound />;
};
