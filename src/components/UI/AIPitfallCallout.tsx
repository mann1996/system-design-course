import React from 'react';

interface AIPitfallCalloutProps {
  title?: string;
  children: React.ReactNode;
}

export const AIPitfallCallout: React.FC<AIPitfallCalloutProps> = ({
  title = 'AI Pitfall: Common Naive Assumption',
  children,
}) => {
  return (
    <div className="callout callout-ai">
      <div className="callout-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
        <span>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
};
