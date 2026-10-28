import React from 'react';

interface AgentReminderProps {
  title?: string;
  promptText?: string;
}

export const AgentReminder: React.FC<AgentReminderProps> = ({
  title = 'Learning Progress Checkpoint',
  promptText = 'Ask an AI chat of your choice: "I have finished this lesson! Please grill me on edge cases and failure modes."'
}) => {
  return (
    <div className="agent-reminder">
      <h4>{title}</h4>
      <p style={{ margin: '8px 0 0' }}>
        <strong>Action:</strong> Copy and send this prompt to an AI chat of your choice:
      </p>
      <div
        style={{
          marginTop: '8px',
          padding: '12px 16px',
          background: 'var(--color-surface-soft)',
          borderRadius: 'var(--rounded-md)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          color: 'var(--color-ink)',
          borderLeft: '3px solid var(--color-primary)'
        }}
      >
        {promptText}
      </div>
    </div>
  );
};
