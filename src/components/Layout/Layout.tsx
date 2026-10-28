import React from 'react';
import { TopNav } from './TopNav';
import { FooterDark } from './FooterDark';
import { ScrollToTop } from './ScrollToTop';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ScrollToTop />
      <TopNav />
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      <FooterDark />
    </div>
  );
};
