import React from 'react';
import { useParams } from 'react-router-dom';
import { LatencyRef } from './reference/LatencyRef';
import { LoadBalancingRef } from './reference/LoadBalancingRef';
import { CachingRef } from './reference/CachingRef';
import { ReplicationRef } from './reference/ReplicationRef';
import { ShardingRef } from './reference/ShardingRef';
import { QueuesRef } from './reference/QueuesRef';
import { NotFound } from './NotFound';

export const ReferenceDispatcher: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) return <NotFound />;

  const clean = id.replace('.html', '').toLowerCase();

  if (clean === 'ref-latency' || clean === 'latency' || clean.includes('latency')) {
    return <LatencyRef />;
  }
  if (clean === 'ref-lb' || clean === 'load-balancing' || clean.includes('load-balancing')) {
    return <LoadBalancingRef />;
  }
  if (clean === 'ref-caching' || clean === 'caching' || clean.includes('caching')) {
    return <CachingRef />;
  }
  if (clean === 'ref-replication' || clean === 'replication' || clean.includes('replication')) {
    return <ReplicationRef />;
  }
  if (clean === 'ref-sharding' || clean === 'sharding' || clean.includes('sharding')) {
    return <ShardingRef />;
  }
  if (clean === 'ref-queues' || clean === 'queues' || clean.includes('message-queues') || clean.includes('queues')) {
    return <QueuesRef />;
  }

  return <NotFound />;
};
