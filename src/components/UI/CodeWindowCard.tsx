import React, { useState, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';

interface CodeWindowCardProps {
  title: string;
  code: string;
  language?: string;
}

export const CodeWindowCard: React.FC<CodeWindowCardProps> = ({ title, code, language }) => {
  const [copied, setCopied] = useState(false);

  const targetLang = useMemo(() => {
    if (language) return language.toLowerCase();
    const ext = title.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'sql':
        return 'sql';
      case 'sh':
      case 'bash':
        return 'bash';
      case 'json':
        return 'json';
      case 'txt':
        return 'text';
      default:
        return code.includes('import ') || code.includes('export ') || code.includes('class ') || code.includes('const ')
          ? 'typescript'
          : 'text';
    }
  }, [title, language, code]);

  const highlightedHtml = useMemo(() => {
    if (targetLang === 'text' || !Prism.languages[targetLang]) {
      return null;
    }
    try {
      return Prism.highlight(code, Prism.languages[targetLang], targetLang);
    } catch {
      return null;
    }
  }, [code, targetLang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="code-window-card" style={{ position: 'relative' }}>
      <div className="code-window-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <div className="code-window-dots">
            <span style={{ background: '#ff5f56' }} />
            <span style={{ background: '#ffbd2e' }} />
            <span style={{ background: '#27c93f' }} />
          </div>
          <div className="code-window-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {targetLang !== 'text' && (
            <span className="code-window-lang" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-on-dark-soft)', letterSpacing: '0.5px' }}>
              {targetLang}
            </span>
          )}
          <button
            onClick={handleCopy}
            aria-label="Copy code"
            style={{
              background: 'transparent',
              border: 'none',
              color: copied ? 'var(--color-accent-teal)' : 'var(--color-on-dark-soft)',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              minHeight: '28px',
              borderRadius: '4px',
              transition: 'color 0.15s ease'
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre>
        {highlightedHtml ? (
          <code
            className={`language-${targetLang}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
};
