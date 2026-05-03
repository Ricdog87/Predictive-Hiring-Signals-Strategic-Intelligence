/**
 * Hiring Signal Alpha Engine v2 — Opportunity Feed
 *
 * Ranks the day's most actionable recruiting opportunities and pairs
 * each with a why-now explanation, the best outreach angle, and a
 * suggested contact persona to approach.
 */

import { CompanyAggregate, CompanySignal, HiringSignalType } from '../../lib/types';
import { getMasterRecordById } from '../companyMaster/match';
import { CompanyMasterRecord } from '../companyMaster/master';
import { projectHiringWindows } from './predictive';

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

interface AnglePlaybook {
  angle: string;
  persona: string;
  channel: string;
}

const PLAYBOOKS: Record<HiringSignalType, AnglePlaybook> = {
  job_spike: {
    angle: 'Highlight bench of pre-vetted candidates ready for active roles.',
    persona: 'Head of Talent Acquisition',
    channel: 'Direct email + LinkedIn InMail',
  },
  employee_growth: {
    angle: 'Scale conversation: pipeline reliability and time-to-hire benchmarks.',
    persona: 'VP People / Chief People Officer',
    channel: 'LinkedIn + warm intro',
  },
  location_expansion: {
    angle: 'Regional sourcing playbook for the new site.',
    persona: 'Regional Operations Lead',
    channel: 'Email + local events',
  },
  new_business_unit: {
    angle: 'Stand-up team blueprint for the new business unit.',
    persona: 'Business Unit GM',
    channel: 'Executive intro',
  },
  funding_grant: {
    angle: 'Fast hiring after the round — engineering and GTM acceleration.',
    persona: 'CEO or COO',
    channel: 'Email + investor warm intro',
  },
  product_launch: {
    angle: 'Launch staffing: product, engineering, and customer success.',
    persona: 'VP Product',
    channel: 'LinkedIn + product community',
  },
  patent_filing: {
    angle: 'Specialist R&D talent map aligned to the patent area.',
    persona: 'CTO / Head of R&D',
    channel: 'LinkedIn + research community',
  },
  press_release: {
    angle: 'Visibility moment — capture momentum with employer branding.',
    persona: 'Head of Communications',
    channel: 'Email',
  },
  gf_change: {
    angle: 'New leadership — staff their first 90-day plan.',
    persona: 'New executive hire',
    channel: 'Direct email',
  },
  mna_buy: {
    angle: 'Integration hiring: finance, ops, and people leaders.',
    persona: 'Chief Integration Officer',
    channel: 'Executive intro',
  },
  mna_sell: {
    angle: 'Retention support during transition.',
    persona: 'HR business partner',
    channel: 'LinkedIn',
  },
  restructuring: {
    angle: 'Targeted backfill for critical retained roles.',
    persona: 'Transformation Lead',
    channel: 'Email',
  },
  insolvency: {
    angle: 'Defer outreach until proceedings stabilise.',
    persona: 'Restructuring advisor',
    channel: 'Hold',
  },
};

export interface OpportunityCandidate {
  rank: number;
  companyId: string;
  companyName: string;
  sector: string;
  region: string;
  hiringScore: number;
  hiringProbability: number;
  opportunityScore: number;
  whyNow: string;
  outreachAngle: string;
  contactPersona: string;
  channel: string;
  primarySignal: HiringSignalType;
  windowDays: number;
  recentSignals: Array<{
    signalType: HiringSignalType;
    observedAt: string;
    impact: number;
    confidence: number;
    source: string;
  }>;
}

export interface OpportunityFeed {
  generatedAt: string;
  windowDays: 1;
  opportunities: OpportunityCandidate[];
}

const POSITIVE_TYPES = new Set<HiringSignalType>([
  'job_spike',
  'employee_growth',
  'location_expansion',
  'new_business_unit',
  'funding_grant',
  'product_launch',
  'patent_filing',
  'mna_buy',
]);

function freshnessFactor(signal: CompanySignal): number {
  const ageHours = Math.max(0, (Date.now() - +new Date(signal.observedAt)) / 3600000);
  if (ageHours <= 24) return 1;
  if (ageHours <= 72) return 0.85;
  if (ageHours <= 168) return 0.7;
  if (ageHours <= 720) return 0.5;
  return 0.3;
}

function pickPrimarySignal(signals: CompanySignal[]): CompanySignal | undefined {
  return [...signals]
    .filter((s) => POSITIVE_TYPES.has(s.signalType))
    .sort((a, b) => freshnessFactor(b) * b.confidence * Math.abs(b.impact)
      - freshnessFactor(a) * a.confidence * Math.abs(a.impact))[0];
}

function whyNow(signal: CompanySignal | undefined, master: CompanyMasterRecord | undefined): string {
  if (!signal) return 'Composite signal stack indicates elevated hiring momentum.';
  const days = Math.max(0, Math.round((Date.now() - +new Date(signal.observedAt)) / 86400000));
  const sector = master?.sector ? ` (${master.sector})` : '';
  return `${days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days + ' days ago'}: ${signal.signalType.replace(/_/g, ' ')} via ${signal.provider}${sector}.`;
}

export function computeOpportunityFeed(aggregates: CompanyAggregate[], limit = 20): OpportunityFeed {
  const scored = aggregates
    .map((a) => {
      const primary = pickPrimarySignal(a.signals);
      if (!primary) return undefined;
      const baseScore = a.latestScore?.hiringScore ?? 0;
      const probability = a.latestPrediction?.hiringProbability ?? baseScore / 100;
      const windows = projectHiringWindows(a.signals, baseScore);
      const opportunityScore = round2(
        baseScore * 0.4
          + probability * 100 * 0.25
          + freshnessFactor(primary) * Math.abs(primary.impact) * primary.confidence * 1.5
          + windows.p30 * 50,
      );
      const playbook = PLAYBOOKS[primary.signalType];
      const master = getMasterRecordById(a.company.id);
      const recent = [...a.signals]
        .sort((a2, b2) => +new Date(b2.observedAt) - +new Date(a2.observedAt))
        .slice(0, 5)
        .map((s) => ({
          signalType: s.signalType,
          observedAt: s.observedAt,
          impact: s.impact,
          confidence: round3(s.confidence),
          source: s.provider,
        }));
      return {
        companyId: a.company.id,
        companyName: a.company.name,
        sector: a.company.industry,
        region: a.company.headquarters,
        hiringScore: baseScore,
        hiringProbability: round3(probability),
        opportunityScore,
        whyNow: whyNow(primary, master),
        outreachAngle: playbook.angle,
        contactPersona: playbook.persona,
        channel: playbook.channel,
        primarySignal: primary.signalType,
        windowDays: windows.expectedPeakDay,
        recentSignals: recent,
      };
    })
    .filter((x): x is Omit<OpportunityCandidate, 'rank'> => Boolean(x))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, limit)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));

  return {
    generatedAt: new Date().toISOString(),
    windowDays: 1,
    opportunities: scored,
  };
}
