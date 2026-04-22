'use client';

import { usePii } from './pii-context';

interface Props {
  unmasked: boolean;
  onChange: (next: boolean) => void;
}

export function PiiToggle({ unmasked, onChange }: Props) {
  const { unlocked } = usePii();
  const disabled = !unlocked;
  const label = unmasked ? '隱藏 PII' : '顯示 PII';
  const tooltip = disabled
    ? '需要 ?pii=1 URL 參數方可解鎖'
    : unmasked
      ? '點擊隱藏個資 (車牌 / 員工姓名 / 駕駛資料)'
      : '點擊顯示個資 (僅授權檢視)';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!unmasked)}
      title={tooltip}
      className={[
        'text-[10px] px-2 py-1 rounded-md border transition-colors',
        disabled
          ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
          : unmasked
            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
