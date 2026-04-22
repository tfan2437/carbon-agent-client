'use client';

import { useMemo, useState } from 'react';
import {
  ActivityDataNode,
  GHGGraphData,
  GHGNode,
  ProcessingStatus,
  SourceDocumentNode,
  SourceType,
} from '@/lib/types';

interface Props {
  graph: GHGGraphData;
  node: GHGNode | null;
  activity: ActivityDataNode | null;
}

const SOURCE_TYPE_GLYPH: Record<SourceType, string> = {
  fuel: '⛽',
  electricity: '⚡',
  refrigerant: '❄',
  work_hours: '👷',
};

const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  fuel: '燃料',
  electricity: '電力',
  refrigerant: '冷媒',
  work_hours: '人時',
};

const STATUS_BADGE: Record<ProcessingStatus, { bg: string; fg: string; label: string }> = {
  success: { bg: 'bg-emerald-500/15', fg: 'text-emerald-400', label: '成功' },
  partial: { bg: 'bg-amber-500/15', fg: 'text-amber-400', label: '部分' },
  failed: { bg: 'bg-rose-500/15', fg: 'text-rose-400', label: '失敗' },
  duplicate: { bg: 'bg-gray-500/15', fg: 'text-gray-400', label: '重複' },
};

export function EvidenceTab({ graph, node, activity }: Props) {
  // Resolve the "evidence subject" — either the drilled activity, or a source_document node.
  const subject = useMemo(() => {
    if (activity) {
      return {
        source_file: activity.source_file,
        source_type: activity.source_type,
        file_hash: activity.file_hash,
        status: activity.status,
        warnings: activity.warnings,
        processing_ms: activity.file_processing_time_ms,
        evidence_url: activity.evidence_url,
        siblings: graph.nodes.filter(
          (n) =>
            n.type === 'activity_data' &&
            n.source_file === activity.source_file &&
            n.id !== activity.id,
        ) as ActivityDataNode[],
      };
    }
    if (node?.type === 'source_document') {
      const doc = node as SourceDocumentNode;
      const acts = graph.nodes.filter(
        (n) => n.type === 'activity_data' && n.source_file === doc.source_file,
      ) as ActivityDataNode[];
      const first = acts[0];
      const allWarnings = Array.from(new Set(acts.flatMap((a) => a.warnings)));
      return {
        source_file: doc.source_file,
        source_type: doc.source_type,
        file_hash: doc.file_hash,
        status: doc.status,
        warnings: allWarnings,
        processing_ms: first?.file_processing_time_ms ?? null,
        evidence_url: first?.evidence_url ?? null,
        siblings: acts,
      };
    }
    return null;
  }, [graph, node, activity]);

  if (!subject) {
    return <div className="px-5 py-8 text-center text-sm text-gray-500">無原始檔案資訊</div>;
  }

  const status = STATUS_BADGE[subject.status];
  const glyph = SOURCE_TYPE_GLYPH[subject.source_type];
  const typeLabel = SOURCE_TYPE_LABEL[subject.source_type];
  const procText = formatDuration(subject.processing_ms);

  return (
    <div>
      {/* Header */}
      <section className="px-5 py-4 border-b border-white/5">
        <div className="flex items-start gap-3">
          <div className="text-3xl leading-none">{glyph}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">檔名</div>
            <div className="text-sm text-white font-mono break-all">{subject.source_file}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300">
                {typeLabel} · {subject.source_type}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.bg} ${status.fg}`}>
                {status.label}
              </span>
              {procText && (
                <span className="text-[10px] text-gray-500">處理時間 {procText}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Hash */}
      {subject.file_hash && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">檔案雜湊</h3>
          <CopyableHash value={subject.file_hash} />
          <p className="text-[10px] text-gray-600 mt-2">
            SHA-256 摘要,可用於重複檔偵測與證據比對。
          </p>
        </section>
      )}

      {/* Warnings */}
      {subject.warnings.length > 0 && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-amber-400 mb-2">⚠ 警告 ({subject.warnings.length})</h3>
          <ul className="space-y-1">
            {subject.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-300/90 leading-relaxed pl-3 -indent-3">
                · {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Phase 4: Forensic cards — only when an activity is drilled in */}
      {activity && <FactorCard activity={activity} />}
      {activity && <GasMiniTable activity={activity} />}
      {activity && <ExtractionConfidenceCard activity={activity} />}

      {/* Sibling activity nodes (when one file produced multiple records, e.g., refrigerant per equipment or cross-year electricity) */}
      {subject.siblings.length > 0 && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">
            {activity ? '同檔案其他紀錄' : '檔案內紀錄'} ({subject.siblings.length + (activity ? 1 : 0)})
          </h3>
          <div className="space-y-1">
            {subject.siblings.slice(0, 20).map((s) => (
              <div key={s.id} className="flex justify-between gap-2 text-xs">
                <span className="text-gray-300 truncate">{s.period_label}</span>
                <span className="text-gray-400 tabular-nums whitespace-nowrap">
                  {s.activity_value.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                  {s.activity_unit} · {s.emissions_tco2e.toLocaleString(undefined, { maximumFractionDigits: 4 })} tCO₂e
                </span>
              </div>
            ))}
            {subject.siblings.length > 20 && (
              <p className="text-[10px] text-gray-600 mt-1">… 共 {subject.siblings.length} 筆</p>
            )}
          </div>
        </section>
      )}

      {/* Preview placeholder */}
      <section className="px-5 py-4">
        <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">預覽</h3>
        <div className="border border-dashed border-white/10 rounded-lg p-6 text-center bg-white/[0.02]">
          <div className="text-4xl mb-2 opacity-40">📄</div>
          <p className="text-sm text-gray-400">原始檔案預覽尚未開放</p>
          <p className="text-[10px] text-gray-600 mt-1">
            {subject.source_type === 'electricity'
              ? '電費 PDF 將於後續版本嵌入預覽'
              : 'XLSX 試算表將於後續版本以表格呈現'}
          </p>
          <button
            disabled
            className="mt-4 px-3 py-1.5 text-xs rounded bg-white/5 text-gray-500 cursor-not-allowed"
            title={subject.evidence_url ? '下載原始檔案' : '證據檔案尚未發佈'}
          >
            下載原始檔案
          </button>
        </div>
      </section>
    </div>
  );
}

function CopyableHash({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const truncated = value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable in some browsers — silently ignore
    }
  };

  return (
    <button
      onClick={onCopy}
      className="font-mono text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded px-2 py-1 transition-colors"
      title={value}
    >
      {copied ? '✓ 已複製' : truncated}
    </button>
  );
}

function formatDuration(ms: number | null): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// ─── Phase 4 forensic cards ─────────────────────────────────────────

const GAS_COLOR: Record<string, string> = {
  CO2: '#A3A3A3',
  CH4: '#10B981',
  N2O: '#F59E0B',
  HFCs: '#3B82F6',
  PFCs: '#8B5CF6',
  SF6: '#EC4899',
  NF3: '#F97316',
};

function FactorCard({ activity }: { activity: ActivityDataNode }) {
  const f = activity.emission_factor;
  if (!f) return null;
  return (
    <section className="px-5 py-4 border-b border-white/5">
      <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">排放係數</h3>
      <Field label="係數" value={`${f.value} ${f.unit}`} />
      <Field label="出處" value={<span className="text-[11px]">{f.source}</span>} />
      <Field label="係數年度" value={String(f.year)} />
    </section>
  );
}

function GasMiniTable({ activity }: { activity: ActivityDataNode }) {
  const gases = activity.gas_breakdown ?? [];
  if (gases.length === 0) return null;
  return (
    <section className="px-5 py-4 border-b border-white/5">
      <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">氣體拆解</h3>
      <table className="w-full text-[11px]">
        <thead className="border-b border-white/5">
          <tr>
            <th className="px-1 py-1 text-left text-[10px] uppercase tracking-wider text-gray-500">氣體</th>
            <th className="px-1 py-1 text-right text-[10px] uppercase tracking-wider text-gray-500">係數</th>
            <th className="px-1 py-1 text-right text-[10px] uppercase tracking-wider text-gray-500">GWP</th>
            <th className="px-1 py-1 text-right text-[10px] uppercase tracking-wider text-gray-500">kg</th>
            <th className="px-1 py-1 text-right text-[10px] uppercase tracking-wider text-gray-500">tCO₂e</th>
          </tr>
        </thead>
        <tbody>
          {gases.map((g) => (
            <tr key={g.gas} className="border-b border-white/5">
              <td className="px-1 py-1">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor: `${GAS_COLOR[g.gas] ?? '#6B7280'}25`,
                    color: GAS_COLOR[g.gas] ?? '#9CA3AF',
                  }}
                >
                  {g.gas}
                </span>
              </td>
              <td className="px-1 py-1 text-right text-gray-400 tabular-nums">{g.factor_per_unit}</td>
              <td className="px-1 py-1 text-right text-gray-400 tabular-nums">{g.gwp}</td>
              <td className="px-1 py-1 text-right text-gray-300 tabular-nums">
                {g.emission_kg.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </td>
              <td className="px-1 py-1 text-right text-gray-200 tabular-nums">
                {g.emission_tco2e.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ExtractionConfidenceCard({ activity }: { activity: ActivityDataNode }) {
  const s = activity.extraction_summary as Record<string, unknown> | null;
  const conf = s && typeof s.extraction_confidence === 'number' ? s.extraction_confidence : null;
  if (conf == null) return null;
  const pct = conf * 100;
  const tier =
    pct >= 95
      ? { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: '高' }
      : pct >= 80
        ? { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: '中' }
        : { color: 'bg-rose-500/15 text-rose-400 border-rose-500/30', label: '低' };
  return (
    <section className="px-5 py-4 border-b border-white/5">
      <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">萃取信心</h3>
      <div className="flex items-baseline justify-between">
        <span className={`text-2xl font-light tabular-nums ${tier.color.split(' ')[1]}`}>
          {pct.toFixed(2)}%
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded border font-medium ${tier.color}`}
          title="由 OCR / 規則 推算的萃取準確度"
        >
          {tier.label}
        </span>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1">
      <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>
      <span className="text-sm text-gray-200 text-right">{value}</span>
    </div>
  );
}
