import type { Metadata } from "next";
import { StrategyLabPanel } from "@/components/strategy-lab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Strategy Lab · RSG Hiring Radar",
  description:
    "Multi-Agent Strategie-Lab für DACH-Recruiting. Konsolidierte Hiring-Predictions und priorisierte Vertriebs-Actions auf Knopfdruck.",
};

export default function StrategyLabPage() {
  return (
    <main className="min-h-screen bg-bg-base">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <header className="mb-6">
          <div className="font-mono text-2xs uppercase tracking-terminal text-accent-cyan">
            Strategy Lab
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">
            Multi-Agent Hiring Strategy für DACH
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Sieben Rollen aus einem virtuellen Vorstandsgremium analysieren
            gemeinsam einen Sektor-/Regions-Scope und liefern dir
            Hiring-Predictions, priorisierte Vertriebs-Actions und einen
            konkreten Wochen-Plan. Auf Modell-Basis, mit transparenten
            Annahmen.
          </p>
        </header>
        <StrategyLabPanel />
      </div>
    </main>
  );
}
