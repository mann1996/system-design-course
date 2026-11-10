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
import { Lesson0009 } from './lessons/Lesson0009';
import { Lesson0010 } from './lessons/Lesson0010';
import { Lesson0011 } from './lessons/Lesson0011';
import { Lesson0012 } from './lessons/Lesson0012';
import { Lesson0013 } from './lessons/Lesson0013';
import { Lesson0014 } from './lessons/Lesson0014';
import { Lesson0015 } from './lessons/Lesson0015';
import { Lesson0016 } from './lessons/Lesson0016';
import { Lesson0017 } from './lessons/Lesson0017';
import { Lesson0018 } from './lessons/Lesson0018';
import { Lesson0019 } from './lessons/Lesson0019';
import { Lesson0020 } from './lessons/Lesson0020';
import { Lesson0021 } from './lessons/Lesson0021';
import { Lesson0022 } from './lessons/Lesson0022';
import { Lesson0023 } from './lessons/Lesson0023';
import { Lesson0024 } from './lessons/Lesson0024';
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
  if (clean === '0009' || clean === '9' || clean.startsWith('0009-')) return '0009';
  if (clean === '0010' || clean === '10' || clean.startsWith('0010-')) return '0010';
  if (clean === '0011' || clean === '11' || clean.startsWith('0011-')) return '0011';
  if (clean === '0012' || clean === '12' || clean.startsWith('0012-')) return '0012';
  if (clean === '0013' || clean === '13' || clean.startsWith('0013-')) return '0013';
  if (clean === '0014' || clean === '14' || clean.startsWith('0014-')) return '0014';
  if (clean === '0015' || clean === '15' || clean.startsWith('0015-')) return '0015';
  if (clean === '0016' || clean === '16' || clean.startsWith('0016-')) return '0016';
  if (clean === '0017' || clean === '17' || clean.startsWith('0017-')) return '0017';
  if (clean === '0018' || clean === '18' || clean.startsWith('0018-')) return '0018';
  if (clean === '0019' || clean === '19' || clean.startsWith('0019-')) return '0019';
  if (clean === '0020' || clean === '20' || clean.startsWith('0020-')) return '0020';
  if (clean === '0021' || clean === '21' || clean.startsWith('0021-')) return '0021';
  if (clean === '0022' || clean === '22' || clean.startsWith('0022-')) return '0022';
  if (clean === '0023' || clean === '23' || clean.startsWith('0023-')) return '0023';
  if (clean === '0024' || clean === '24' || clean.startsWith('0024-')) return '0024';
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
  if (canonicalId === '0009') return <Lesson0009 />;
  if (canonicalId === '0010') return <Lesson0010 />;
  if (canonicalId === '0011') return <Lesson0011 />;
  if (canonicalId === '0012') return <Lesson0012 />;
  if (canonicalId === '0013') return <Lesson0013 />;
  if (canonicalId === '0014') return <Lesson0014 />;
  if (canonicalId === '0015') return <Lesson0015 />;
  if (canonicalId === '0016') return <Lesson0016 />;
  if (canonicalId === '0017') return <Lesson0017 />;
  if (canonicalId === '0018') return <Lesson0018 />;
  if (canonicalId === '0019') return <Lesson0019 />;
  if (canonicalId === '0020') return <Lesson0020 />;
  if (canonicalId === '0021') return <Lesson0021 />;
  if (canonicalId === '0022') return <Lesson0022 />;
  if (canonicalId === '0023') return <Lesson0023 />;
  if (canonicalId === '0024') return <Lesson0024 />;

  return <NotFound />;
};
