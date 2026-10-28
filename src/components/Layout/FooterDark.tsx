import React from 'react';
import { Link } from 'react-router-dom';
import { allModules, allReferences } from '../../data/curriculum';

export const FooterDark: React.FC = () => {
  return (
    <footer className="footer-dark">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-brand-title">
              <svg
                className="brand-spike"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                style={{ color: 'var(--color-on-dark)' }}
              >
                <path d="M12 0c.5 6.6 5.4 11.5 12 12-6.6.5-11.5 5.4-12 12-.5-6.6-5.4-11.5-12-12 6.6-.5 11.5-5.4 12-12z" />
              </svg>
              <span>Teach Me: System Design</span>
            </div>
            <p className="footer-desc">
              An interactive, pedagogical progressive web curriculum designed to turn developers into authoritative software architects who make sound distributed system decisions.
            </p>
          </div>

          <div className="footer-col footer-col-curriculum">
            <h5>Curriculum</h5>
            <ul className="footer-links footer-overview-links">
              <li>
                <Link to="/" className="footer-overview-link">
                  Course Overview &rarr;
                </Link>
              </li>
            </ul>
            <div className="footer-modules-list">
              {allModules.map((mod) => (
                <div key={mod.id} className="footer-module-group">
                  <div className="footer-module-title">{mod.badge}</div>
                  <ul className="footer-links">
                    {mod.lessons.map((l) => (
                      <li key={l.id}>
                        <Link to={`/lessons/${l.id}`}>
                          <span className="footer-lesson-num">{l.id}</span>
                          <span className="footer-lesson-title">{l.navTitle}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="footer-col">
            <h5>Reference</h5>
            <ul className="footer-links">
              {allReferences.map((r) => (
                <li key={r.id}>
                  <Link to={`/reference/${r.id}`}>{r.title}</Link>
                </li>
              ))}
              <li>
                <a href="https://github.com/donnemartin/system-design-primer" target="_blank" rel="noreferrer">
                  Primary Sources &amp; Papers
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>Advanced System Design &bull; Progressive Web App (Offline Ready)</div>
          <div>Ground truth based on Martin Kleppmann &amp; Alex Xu</div>
        </div>
      </div>
    </footer>
  );
};
