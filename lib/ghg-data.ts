// GHG Inventory Graph Data - Mock data for demonstration
// Node types: company, facility, emission_source, activity_data, source_document

export type NodeType = 'company' | 'facility' | 'emission_source' | 'activity_data' | 'source_document';
export type Scope = 1 | 2 | null;

export interface GHGNode {
  id: string;
  name: string;
  nameEn?: string;
  type: NodeType;
  scope: Scope;
  emissions?: number; // kgCO₂e
  activityValue?: number;
  activityUnit?: string;
  emissionFactor?: {
    value: number;
    unit: string;
    source: string;
  };
  facility?: string;
  year: number;
}

export interface GHGLink {
  source: string;
  target: string;
}

export interface GHGGraphData {
  nodes: GHGNode[];
  links: GHGLink[];
}

// Color mapping for node types and scopes
export const NODE_COLORS = {
  scope1: '#F59E0B', // Orange for Scope 1
  scope2: '#3B82F6', // Blue for Scope 2
  neutral: '#6B7280', // Gray for structural nodes
};

export const getNodeColor = (node: GHGNode): string => {
  if (node.scope === 1) return NODE_COLORS.scope1;
  if (node.scope === 2) return NODE_COLORS.scope2;
  return NODE_COLORS.neutral;
};

export const NODE_TYPE_LABELS: Record<NodeType, { zh: string; en: string }> = {
  company: { zh: '公司', en: 'Company' },
  facility: { zh: '場站', en: 'Facility' },
  emission_source: { zh: '排放源', en: 'Emission Source' },
  activity_data: { zh: '活動數據', en: 'Activity Data' },
  source_document: { zh: '來源文件', en: 'Source Document' },
};

// Mock GHG inventory data for a transportation company
export const GHG_DATA: GHGGraphData = {
  nodes: [
    // Company (Root)
    {
      id: 'company-1',
      name: '嶺碳運輸股份有限公司',
      nameEn: 'LingCarbon Transport Co., Ltd.',
      type: 'company',
      scope: null,
      emissions: 856420,
      year: 2024,
    },

    // Facilities
    {
      id: 'facility-taipei',
      name: '台北車廠',
      nameEn: 'Taipei Depot',
      type: 'facility',
      scope: null,
      emissions: 342800,
      year: 2024,
    },
    {
      id: 'facility-taoyuan',
      name: '桃園車廠',
      nameEn: 'Taoyuan Depot',
      type: 'facility',
      scope: null,
      emissions: 298620,
      year: 2024,
    },
    {
      id: 'facility-kaohsiung',
      name: '高雄車廠',
      nameEn: 'Kaohsiung Depot',
      type: 'facility',
      scope: null,
      emissions: 215000,
      year: 2024,
    },

    // Emission Sources - Taipei
    {
      id: 'source-taipei-diesel',
      name: '柴油車隊',
      nameEn: 'Diesel Fleet',
      type: 'emission_source',
      scope: 1,
      emissions: 198450,
      facility: 'facility-taipei',
      year: 2024,
    },
    {
      id: 'source-taipei-def',
      name: '尿素 DEF',
      nameEn: 'Diesel Exhaust Fluid',
      type: 'emission_source',
      scope: 1,
      emissions: 12350,
      facility: 'facility-taipei',
      year: 2024,
    },
    {
      id: 'source-taipei-electricity',
      name: '外購電力',
      nameEn: 'Purchased Electricity',
      type: 'emission_source',
      scope: 2,
      emissions: 132000,
      facility: 'facility-taipei',
      year: 2024,
    },

    // Emission Sources - Taoyuan
    {
      id: 'source-taoyuan-diesel',
      name: '柴油車隊',
      nameEn: 'Diesel Fleet',
      type: 'emission_source',
      scope: 1,
      emissions: 178920,
      facility: 'facility-taoyuan',
      year: 2024,
    },
    {
      id: 'source-taoyuan-lpg',
      name: 'LPG 堆高機',
      nameEn: 'LPG Forklifts',
      type: 'emission_source',
      scope: 1,
      emissions: 8700,
      facility: 'facility-taoyuan',
      year: 2024,
    },
    {
      id: 'source-taoyuan-electricity',
      name: '外購電力',
      nameEn: 'Purchased Electricity',
      type: 'emission_source',
      scope: 2,
      emissions: 111000,
      facility: 'facility-taoyuan',
      year: 2024,
    },

    // Emission Sources - Kaohsiung
    {
      id: 'source-kaohsiung-diesel',
      name: '柴油車隊',
      nameEn: 'Diesel Fleet',
      type: 'emission_source',
      scope: 1,
      emissions: 145000,
      facility: 'facility-kaohsiung',
      year: 2024,
    },
    {
      id: 'source-kaohsiung-electricity',
      name: '外購電力',
      nameEn: 'Purchased Electricity',
      type: 'emission_source',
      scope: 2,
      emissions: 70000,
      facility: 'facility-kaohsiung',
      year: 2024,
    },

    // Activity Data - Taipei Diesel
    {
      id: 'activity-taipei-diesel-1',
      name: 'Diesel 柴油',
      nameEn: 'Diesel Fuel',
      type: 'activity_data',
      scope: 1,
      emissions: 198450,
      activityValue: 74500,
      activityUnit: 'L',
      emissionFactor: {
        value: 2.664,
        unit: 'kgCO₂e/L',
        source: '環境部 113年公告',
      },
      year: 2024,
    },

    // Activity Data - Taipei DEF
    {
      id: 'activity-taipei-def-1',
      name: 'DEF 尿素溶液',
      nameEn: 'DEF Solution',
      type: 'activity_data',
      scope: 1,
      emissions: 12350,
      activityValue: 8200,
      activityUnit: 'L',
      emissionFactor: {
        value: 1.506,
        unit: 'kgCO₂e/L',
        source: 'IPCC 2006',
      },
      year: 2024,
    },

    // Activity Data - Taipei Electricity
    {
      id: 'activity-taipei-elec-1',
      name: 'Electricity 電力',
      nameEn: 'Grid Electricity',
      type: 'activity_data',
      scope: 2,
      emissions: 132000,
      activityValue: 264000,
      activityUnit: 'kWh',
      emissionFactor: {
        value: 0.5,
        unit: 'kgCO₂e/kWh',
        source: '台電 112年度電力係數',
      },
      year: 2024,
    },

    // Activity Data - Taoyuan Diesel
    {
      id: 'activity-taoyuan-diesel-1',
      name: 'Diesel 柴油',
      nameEn: 'Diesel Fuel',
      type: 'activity_data',
      scope: 1,
      emissions: 178920,
      activityValue: 67200,
      activityUnit: 'L',
      emissionFactor: {
        value: 2.664,
        unit: 'kgCO₂e/L',
        source: '環境部 113年公告',
      },
      year: 2024,
    },

    // Activity Data - Taoyuan LPG
    {
      id: 'activity-taoyuan-lpg-1',
      name: 'LPG 液化石油氣',
      nameEn: 'Liquefied Petroleum Gas',
      type: 'activity_data',
      scope: 1,
      emissions: 8700,
      activityValue: 2900,
      activityUnit: 'kg',
      emissionFactor: {
        value: 3.0,
        unit: 'kgCO₂e/kg',
        source: '環境部 113年公告',
      },
      year: 2024,
    },

    // Activity Data - Taoyuan Electricity
    {
      id: 'activity-taoyuan-elec-1',
      name: 'Electricity 電力',
      nameEn: 'Grid Electricity',
      type: 'activity_data',
      scope: 2,
      emissions: 111000,
      activityValue: 222000,
      activityUnit: 'kWh',
      emissionFactor: {
        value: 0.5,
        unit: 'kgCO₂e/kWh',
        source: '台電 112年度電力係數',
      },
      year: 2024,
    },

    // Activity Data - Kaohsiung Diesel
    {
      id: 'activity-kaohsiung-diesel-1',
      name: 'Diesel 柴油',
      nameEn: 'Diesel Fuel',
      type: 'activity_data',
      scope: 1,
      emissions: 145000,
      activityValue: 54450,
      activityUnit: 'L',
      emissionFactor: {
        value: 2.664,
        unit: 'kgCO₂e/L',
        source: '環境部 113年公告',
      },
      year: 2024,
    },

    // Activity Data - Kaohsiung Electricity
    {
      id: 'activity-kaohsiung-elec-1',
      name: 'Electricity 電力',
      nameEn: 'Grid Electricity',
      type: 'activity_data',
      scope: 2,
      emissions: 70000,
      activityValue: 140000,
      activityUnit: 'kWh',
      emissionFactor: {
        value: 0.5,
        unit: 'kgCO₂e/kWh',
        source: '台電 112年度電力係數',
      },
      year: 2024,
    },

    // Source Documents - Taipei
    {
      id: 'doc-taipei-fuel-q1',
      name: '加油紀錄 2024-Q1.xlsx',
      nameEn: 'Fuel Records Q1 2024',
      type: 'source_document',
      scope: null,
      year: 2024,
    },
    {
      id: 'doc-taipei-fuel-q2',
      name: '加油紀錄 2024-Q2.xlsx',
      nameEn: 'Fuel Records Q2 2024',
      type: 'source_document',
      scope: null,
      year: 2024,
    },
    {
      id: 'doc-taipei-def',
      name: 'DEF採購單據.pdf',
      nameEn: 'DEF Purchase Records',
      type: 'source_document',
      scope: null,
      year: 2024,
    },
    {
      id: 'doc-taipei-elec-06',
      name: '台電帳單 2024-06',
      nameEn: 'Taipower Bill Jun 2024',
      type: 'source_document',
      scope: null,
      year: 2024,
    },
    {
      id: 'doc-taipei-elec-07',
      name: '台電帳單 2024-07',
      nameEn: 'Taipower Bill Jul 2024',
      type: 'source_document',
      scope: null,
      year: 2024,
    },

    // Source Documents - Taoyuan
    {
      id: 'doc-taoyuan-fuel-q2',
      name: '加油紀錄 2024-Q2.xlsx',
      nameEn: 'Fuel Records Q2 2024',
      type: 'source_document',
      scope: null,
      year: 2024,
    },
    {
      id: 'doc-taoyuan-lpg',
      name: 'LPG 採購發票.pdf',
      nameEn: 'LPG Purchase Invoice',
      type: 'source_document',
      scope: null,
      year: 2024,
    },
    {
      id: 'doc-taoyuan-elec',
      name: '台電帳單 2024-06',
      nameEn: 'Taipower Bill Jun 2024',
      type: 'source_document',
      scope: null,
      year: 2024,
    },

    // Source Documents - Kaohsiung
    {
      id: 'doc-kaohsiung-fuel',
      name: '加油紀錄 2024-H1.xlsx',
      nameEn: 'Fuel Records H1 2024',
      type: 'source_document',
      scope: null,
      year: 2024,
    },
    {
      id: 'doc-kaohsiung-elec',
      name: '台電帳單 2024-Q2',
      nameEn: 'Taipower Bill Q2 2024',
      type: 'source_document',
      scope: null,
      year: 2024,
    },
  ],

  links: [
    // Company to Facilities
    { source: 'company-1', target: 'facility-taipei' },
    { source: 'company-1', target: 'facility-taoyuan' },
    { source: 'company-1', target: 'facility-kaohsiung' },

    // Taipei Facility to Sources
    { source: 'facility-taipei', target: 'source-taipei-diesel' },
    { source: 'facility-taipei', target: 'source-taipei-def' },
    { source: 'facility-taipei', target: 'source-taipei-electricity' },

    // Taoyuan Facility to Sources
    { source: 'facility-taoyuan', target: 'source-taoyuan-diesel' },
    { source: 'facility-taoyuan', target: 'source-taoyuan-lpg' },
    { source: 'facility-taoyuan', target: 'source-taoyuan-electricity' },

    // Kaohsiung Facility to Sources
    { source: 'facility-kaohsiung', target: 'source-kaohsiung-diesel' },
    { source: 'facility-kaohsiung', target: 'source-kaohsiung-electricity' },

    // Taipei Sources to Activity Data
    { source: 'source-taipei-diesel', target: 'activity-taipei-diesel-1' },
    { source: 'source-taipei-def', target: 'activity-taipei-def-1' },
    { source: 'source-taipei-electricity', target: 'activity-taipei-elec-1' },

    // Taoyuan Sources to Activity Data
    { source: 'source-taoyuan-diesel', target: 'activity-taoyuan-diesel-1' },
    { source: 'source-taoyuan-lpg', target: 'activity-taoyuan-lpg-1' },
    { source: 'source-taoyuan-electricity', target: 'activity-taoyuan-elec-1' },

    // Kaohsiung Sources to Activity Data
    { source: 'source-kaohsiung-diesel', target: 'activity-kaohsiung-diesel-1' },
    { source: 'source-kaohsiung-electricity', target: 'activity-kaohsiung-elec-1' },

    // Taipei Activity Data to Documents
    { source: 'activity-taipei-diesel-1', target: 'doc-taipei-fuel-q1' },
    { source: 'activity-taipei-diesel-1', target: 'doc-taipei-fuel-q2' },
    { source: 'activity-taipei-def-1', target: 'doc-taipei-def' },
    { source: 'activity-taipei-elec-1', target: 'doc-taipei-elec-06' },
    { source: 'activity-taipei-elec-1', target: 'doc-taipei-elec-07' },

    // Taoyuan Activity Data to Documents
    { source: 'activity-taoyuan-diesel-1', target: 'doc-taoyuan-fuel-q2' },
    { source: 'activity-taoyuan-lpg-1', target: 'doc-taoyuan-lpg' },
    { source: 'activity-taoyuan-elec-1', target: 'doc-taoyuan-elec' },

    // Kaohsiung Activity Data to Documents
    { source: 'activity-kaohsiung-diesel-1', target: 'doc-kaohsiung-fuel' },
    { source: 'activity-kaohsiung-elec-1', target: 'doc-kaohsiung-elec' },
  ],
};

// Helper to calculate total emissions by scope
export function calculateScopeEmissions(nodes: GHGNode[]) {
  const emissionSources = nodes.filter(n => n.type === 'emission_source');
  const scope1 = emissionSources
    .filter(n => n.scope === 1)
    .reduce((sum, n) => sum + (n.emissions || 0), 0);
  const scope2 = emissionSources
    .filter(n => n.scope === 2)
    .reduce((sum, n) => sum + (n.emissions || 0), 0);
  return { scope1, scope2, total: scope1 + scope2 };
}

// Get unique facilities
export function getFacilities(nodes: GHGNode[]) {
  return nodes.filter(n => n.type === 'facility');
}
