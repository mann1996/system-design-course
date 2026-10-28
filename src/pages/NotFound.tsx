import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound: React.FC = () => {
  return (
    <div className="page-wrapper">
      <div className="container" style={{ textAlign: 'center', padding: '64px 0' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>404</h1>
        <p className="lead-text" style={{ margin: '0 auto 24px', maxWidth: '480px' }}>
          The requested system design lesson or reference sheet could not be found.
        </p>
        <Link to="/" className="btn btn-primary">
          ← Return to Curriculum Overview
        </Link>
      </div>
    </div>
  );
};
