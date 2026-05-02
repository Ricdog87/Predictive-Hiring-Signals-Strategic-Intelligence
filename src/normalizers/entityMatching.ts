const COMPANY_MAP: Record<string, { id: string; name: string }> = {
  'apex dynamics': { id: 'comp_001', name: 'Apex Dynamics' },
  'northgrid energy': { id: 'comp_002', name: 'NorthGrid Energy' },
  'helios mobility': { id: 'comp_003', name: 'Helios Mobility' },
};

export function matchCompany(name: string): { companyId: string; companyName: string } {
  const normalized = name.trim().toLowerCase();
  const match = COMPANY_MAP[normalized];
  if (match) return { companyId: match.id, companyName: match.name };
  return { companyId: `comp_${normalized.replace(/[^a-z0-9]+/g, '_')}`, companyName: name.trim() };
}
