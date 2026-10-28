import React from 'react';
import { useParams } from 'react-router-dom';
import { getMilestoneById } from '../data/curriculum';
import { MilestoneTestPage } from './milestones/MilestoneTestPage';
import { NotFound } from './NotFound';

export const MilestoneDispatcher: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) return <NotFound />;

  const milestone = getMilestoneById(id);

  if (!milestone) {
    return <NotFound />;
  }

  return <MilestoneTestPage milestone={milestone} />;
};
