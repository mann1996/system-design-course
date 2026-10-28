import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LessonProgressProvider } from './context/LessonProgressContext';
import { Layout } from './components/Layout/Layout';
import { Home } from './pages/Home';
import { LessonDispatcher } from './pages/LessonDispatcher';
import { MilestoneDispatcher } from './pages/MilestoneDispatcher';
import { ReferenceDispatcher } from './pages/ReferenceDispatcher';
import { NotFound } from './pages/NotFound';

export const App: React.FC = () => {
  return (
    <LessonProgressProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/lessons/:id" element={<LessonDispatcher />} />
          <Route path="/milestones/:id" element={<MilestoneDispatcher />} />
          <Route path="/reference/:id" element={<ReferenceDispatcher />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </LessonProgressProvider>
  );
};
