'use client';

import React from 'react';

interface Props {
  active: boolean;
  asc: boolean;
  onClick: () => void;
  align?: 'left' | 'right';
  children: React.ReactNode;
}

export function SortHeader({ active, asc, onClick, align = 'left', children }: Props) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-300 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
      {active && <span className="ml-1">{asc ? '↑' : '↓'}</span>}
    </th>
  );
}
