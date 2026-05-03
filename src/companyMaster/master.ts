/**
 * Company Intelligence Master v1
 *
 * Canonical reference dataset for companies tracked by the platform.
 * Adapters surface raw company names; the master record anchors each
 * canonical company with stable identifiers and the dimensional
 * attributes (sector, region, cluster, headcount) used by the market
 * intelligence engine. When ingestion sees a new name, fuzzy matching
 * resolves it to one of these records so derived sector / region /
 * cluster labels stop falling back to "unknown".
 */

export interface CompanyMasterRecord {
  id: string;
  name: string;
  aliases: string[];
  sector: string;
  region: string;
  cluster: string;
  headquarters: string;
  employeeCount: number;
  website?: string;
}

export const COMPANY_MASTER: CompanyMasterRecord[] = [
  {
    id: 'comp_001',
    name: 'Apex Dynamics',
    aliases: ['apex', 'apex dynamics gmbh', 'apex dynamics ag', 'apex dynamic'],
    sector: 'Industrial AI',
    region: 'DACH · North',
    cluster: 'Industrial AI · DACH-North',
    headquarters: 'Hamburg, DE',
    employeeCount: 820,
    website: 'apex-dynamics.example',
  },
  {
    id: 'comp_002',
    name: 'NorthGrid Energy',
    aliases: ['northgrid', 'northgrid energy se', 'north grid energy', 'north-grid'],
    sector: 'Energy & Utilities',
    region: 'DACH · North',
    cluster: 'Energy · DACH-North',
    headquarters: 'Bremen, DE',
    employeeCount: 1450,
    website: 'northgrid.example',
  },
  {
    id: 'comp_003',
    name: 'Helios Mobility',
    aliases: ['helios', 'helios mobility gmbh', 'helios mobility ag', 'helios-mobility'],
    sector: 'Mobility & Automotive',
    region: 'DACH · South',
    cluster: 'Mobility · DACH-South',
    headquarters: 'Stuttgart, DE',
    employeeCount: 2100,
    website: 'helios-mobility.example',
  },
];

export const UNKNOWN_SECTOR = 'Unclassified Industry';
export const UNKNOWN_REGION = 'Unclassified Region';
export const UNKNOWN_CLUSTER = 'Unclassified · Unclassified';

export function fallbackCluster(sector: string, region: string): string {
  return `${sector} · ${region}`;
}
