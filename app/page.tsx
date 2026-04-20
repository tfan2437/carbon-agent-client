'use client';

import dynamic from 'next/dynamic';

// Dynamically import the graph component to avoid SSR issues with canvas
const GHGGraph = dynamic(() => import('@/components/ghg-graph'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0E14' }}>
      <div className="text-gray-400 text-sm">Loading graph...</div>
    </div>
  ),
});

export default function Page() {
  return <GHGGraph />;
}
