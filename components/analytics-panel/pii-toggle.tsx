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

  // Tones: locked → muted disabled, locked-but-masked → neutral pill,
  // unmasked → cream warm-warning to flag PII is visible.
  let style: React.CSSProperties;
  if (disabled) {
    style = {
      background: 'rgba(255,255,255,0.03)',
      color: 'var(--fg-4)',
      border: '1px solid var(--border)',
      cursor: 'not-allowed',
    };
  } else if (unmasked) {
    style = {
      background: 'var(--cream-soft)',
      color: 'var(--cream)',
      border: '1px solid oklch(0.95 0.04 85 / 0.30)',
      cursor: 'pointer',
    };
  } else {
    style = {
      background: 'rgba(255,255,255,0.04)',
      color: 'var(--fg-2)',
      border: '1px solid var(--border-2)',
      cursor: 'pointer',
    };
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!unmasked)}
      title={tooltip}
      style={{
        ...style,
        height: 24,
        padding: '0 8px',
        borderRadius: 'var(--r-pill)',
        fontSize: 10.5,
        fontWeight: 500,
        fontFamily: 'inherit',
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        transition:
          'background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out',
      }}
    >
      {label}
    </button>
  );
}
