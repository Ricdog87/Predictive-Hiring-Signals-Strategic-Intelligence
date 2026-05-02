import { RawSignal, SourceAdapter } from '../ingestion/types';
import { parseFeedRows } from '../parsers/simpleParsers';

class StaticAdapter implements SourceAdapter {
  constructor(public source: string, private rows: Array<Record<string, unknown>>) {}
  async fetch(): Promise<RawSignal[]> {
    return parseFeedRows(this.source, this.rows);
  }
}

export const sourceAdapters: SourceAdapter[] = [
  new StaticAdapter('bundesanzeiger', [{ id: 'ba1', companyName: 'Apex Dynamics', title: 'Neue Niederlassung', description: 'Expansion in Hamburg' }]),
  new StaticAdapter('handelsregister', [{ id: 'hr1', companyName: 'NorthGrid Energy', title: 'Kapitalmaßnahme', description: 'Reorganisation der Unternehmensstruktur' }]),
  new StaticAdapter('pressebox', [{ id: 'pb1', companyName: 'Apex Dynamics', title: 'Produktlaunch angekündigt', description: 'Neue KI-Produktlinie' }]),
  new StaticAdapter('company_newsroom', [{ id: 'cn1', companyName: 'Helios Mobility', title: 'Neuer Geschäftsbereich', description: 'Aufbau Batterie-Software Unit' }]),
  new StaticAdapter('linkedin_company', [{ id: 'li1', companyName: 'Apex Dynamics', title: 'Wir wachsen stark', description: 'Viele offene Stellen im Engineering' }]),
  new StaticAdapter('job_posting_trend', [{ id: 'jp1', companyName: 'Helios Mobility', title: 'Job Spike Q2', description: 'Deutlicher Anstieg Stellenanzeigen' }]),
  new StaticAdapter('patent_signals', [{ id: 'pa1', companyName: 'Apex Dynamics', title: 'Patent filing', description: 'Neue ML-Inferenzarchitektur' }]),
  new StaticAdapter('funding_signals', [{ id: 'fs1', companyName: 'NorthGrid Energy', title: 'Fördermittel erhalten', description: 'Bundesförderung für Wasserstoffprojekt' }]),
];
