import { resolveCompany } from '../companyMaster/match';

export function matchCompany(name: string): { companyId: string; companyName: string } {
  const { companyId, companyName } = resolveCompany(name);
  return { companyId, companyName };
}
