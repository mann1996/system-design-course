import React, { useState, useEffect } from 'react';

export interface QuizOptionData {
  text: string;
  isCorrect: boolean;
  explanation: string;
}

interface QuizProps {
  id?: string;
  question: string;
  options: QuizOptionData[];
  title?: string;
}

export const Quiz: React.FC<QuizProps> = ({
  id,
  question,
  options,
  title = 'Active Retrieval: Test Your Understanding'
}) => {
  const storageKey = id ? `quiz_progress_${id}` : null;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        setSelectedIndex(parseInt(saved, 10));
      }
    }
  }, [storageKey]);

  const handleSelect = (idx: number) => {
    if (selectedIndex !== null) return; // Answered
    setSelectedIndex(idx);
    if (storageKey) {
      localStorage.setItem(storageKey, idx.toString());
    }
  };

  const handleReset = () => {
    setSelectedIndex(null);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  };

  const answered = selectedIndex !== null;
  const isCorrect = answered && options[selectedIndex]?.isCorrect;

  return (
    <div className="quiz-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {answered && (
          <button
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-muted)',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Reset
          </button>
        )}
      </div>

      <p className="quiz-question">{question}</p>

      <div className="quiz-options">
        {options.map((opt, idx) => {
          let extraClass = '';
          if (answered) {
            if (idx === selectedIndex) {
              extraClass = opt.isCorrect ? 'correct' : 'incorrect';
            } else if (opt.isCorrect) {
              extraClass = 'correct';
            }
          }

          return (
            <div
              key={idx}
              className={`quiz-option ${extraClass}`}
              onClick={() => handleSelect(idx)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelect(idx);
                }
              }}
            >
              {opt.text}
            </div>
          );
        })}
      </div>

      {answered && (
        <div className={`quiz-feedback show ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
          <strong>{isCorrect ? 'Correct:' : 'Incorrect:'}</strong> {options[selectedIndex]?.explanation}
        </div>
      )}
    </div>
  );
};
