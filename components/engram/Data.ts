// Sample LingCarbon project data — Traditional Chinese domain terms

export type ProjStatus = "empty" | "uploaded" | "processing" | "processed";

export interface Lead {
  name: string;
  initials: string;
  color: string;
}

interface ProjectSeed {
  id: string;
  name: string;
  company: string;
  year: number;
  projStatus: ProjStatus;
  lead: number;
  uploadedDocs: number;
  processedDocs: number;
  tco2e: number;
  records: number;
  updated: string;
}

export interface Project extends ProjectSeed {
  completion: number;
  spark: number[];
}

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

const rand = (seed: number) => {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
};

const genSpark = (seed: number, base = 50): number[] => {
  const r = rand(seed);
  return MONTHS.map(() => Math.round(base + r() * base * 1.5));
};

export const LEADS: Lead[] = [
  { name: "陳郁文", initials: "陳", color: "#DE7356" },
  { name: "林思妤", initials: "林", color: "#6FA4C9" },
  { name: "吳秉諺", initials: "吳", color: "#C6A882" },
  { name: "蔡雅筑", initials: "蔡", color: "#9FC5E8" },
  { name: "黃志勳", initials: "黃", color: "#E9B84E" },
  { name: "周明澤", initials: "周", color: "#7FA886" },
];

// projStatus: 'empty' | 'uploaded' | 'processing' | 'processed'
// completion = Math.round(processedDocs / uploadedDocs * 100) — what % of uploaded data has been processed.
const PROJECT_SEEDS: ProjectSeed[] = [
  { id: "p1", name: "溫室氣體盤查 Agent",         company: "LingCarbon",       year: 2025, projStatus: "processing", lead: 0, uploadedDocs: 128, processedDocs: 54,  tco2e: 18420, records: 842,  updated: "2h ago" },
  { id: "p2", name: "零碳科技日常營運管理自動化",  company: "零碳科技",         year: 2025, projStatus: "processing", lead: 1, uploadedDocs: 94,  processedDocs: 36,  tco2e: 12110, records: 612,  updated: "5h ago" },
  { id: "p3", name: "和欣客運組織溫室氣體盤查",    company: "和欣汽車客運",     year: 2025, projStatus: "empty",      lead: 2, uploadedDocs: 0,   processedDocs: 0,   tco2e: 0,     records: 0,    updated: "1d ago" },
  { id: "p4", name: "大都會客運262路線服務碳足跡盤查", company: "大都會客運",   year: 2025, projStatus: "processing", lead: 3, uploadedDocs: 37,  processedDocs: 9,   tco2e: 4320,  records: 148,  updated: "2d ago" },
  { id: "p5", name: "方沃國際組織溫室氣體盤查",    company: "方沃國際",         year: 2024, projStatus: "uploaded",   lead: 4, uploadedDocs: 4,   processedDocs: 0,   tco2e: 0,     records: 0,    updated: "3d ago" },
  { id: "p6", name: "易威生態組織溫室氣體盤查",    company: "易威生態",         year: 2025, projStatus: "uploaded",   lead: 5, uploadedDocs: 12,  processedDocs: 0,   tco2e: 0,     records: 0,    updated: "3d ago" },
  { id: "p7", name: "首都客運集團組織溫室氣體盤查",company: "首都客運",         year: 2025, projStatus: "processing", lead: 0, uploadedDocs: 212, processedDocs: 155, tco2e: 28650, records: 1284, updated: "6h ago" },
  { id: "p8", name: "LingCarbon Playbook",         company: "LingCarbon",       year: 2024, projStatus: "empty",      lead: 2, uploadedDocs: 0,   processedDocs: 0,   tco2e: 0,     records: 0,    updated: "1w ago" },
  { id: "p9", name: "營建機器人與自動化低碳營建解決方案計畫", company: "內政部建築研究所", year: 2025, projStatus: "uploaded",  lead: 3, uploadedDocs: 18,  processedDocs: 0,  tco2e: 0,    records: 0,    updated: "4d ago" },
  { id: "p10", name: "SHIFT-政大永續創新人才基地", company: "政治大學",         year: 2024, projStatus: "processed",  lead: 5, uploadedDocs: 86,  processedDocs: 86,  tco2e: 9240,  records: 394,  updated: "2w ago" },
];

export const PROJECTS: Project[] = PROJECT_SEEDS.map((p, i) => {
  const completion = p.uploadedDocs === 0 ? 0 : Math.round((p.processedDocs / p.uploadedDocs) * 100);
  return {
    ...p,
    completion,
    spark: genSpark(i + 1, 20 + completion * 2),
  };
});
