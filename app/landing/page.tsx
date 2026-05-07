import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Hiring-Signale für den DACH-Markt',
  description:
    'Wer stellt jetzt ein, wer als nächstes, wer baut ab. Live-Intelligence aus deutschen, österreichischen und schweizer Wirtschaftsnachrichten — für Headhunter, Personaldienstleister und Recruiting-Agenturen.',
  robots: { index: false, follow: false }, // pre-launch
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg-base text-text-primary">
      {/* ─── HEADER ───────────────────────────────────────────────── */}
      <header className="border-b border-border-base">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-text-secondary">RSG</span>
            <span className="text-sm font-mono">·</span>
            <span className="text-sm font-mono uppercase tracking-wider">
              Predictive Hiring Radar
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="#features" className="text-text-secondary hover:text-text-primary">
              Features
            </Link>
            <Link href="#how" className="text-text-secondary hover:text-text-primary">
              So funktioniert&apos;s
            </Link>
            <Link href="#pricing" className="text-text-secondary hover:text-text-primary">
              Preise
            </Link>
            <Link
              href="/"
              className="rounded-md bg-text-primary text-bg-base px-4 py-1.5 font-medium hover:opacity-90 transition"
            >
              Live-Demo →
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-3xl">
          <div className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-6">
            ▸ DACH-Wirtschaftsforum · Live-Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            Wer stellt morgen ein.
            <br />
            <span className="text-accent">Bevor es im StepStone steht.</span>
          </h1>
          <p className="text-xl text-text-secondary leading-relaxed mb-10 max-w-2xl">
            Live-Hiring-Signale aus 18 deutschen, österreichischen und schweizer
            Wirtschafts-Quellen. M&amp;A, Insolvenzen, Restrukturierungen,
            Standort-News, Führungswechsel — alle 10 Minuten neu klassifiziert.
            Für Headhunter, Personaldienstleister, Recruiting-Agenturen.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="rounded-md bg-accent text-white px-6 py-3 font-semibold hover:opacity-90 transition"
            >
              Live-Dashboard ansehen →
            </Link>
            <Link
              href="#pricing"
              className="text-text-secondary hover:text-text-primary px-4 py-3"
            >
              Preise ab €29/Seat ↓
            </Link>
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-20 pt-10 border-t border-border-base">
          <div className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-6">
            Quellen, die wir live klassifizieren:
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-text-secondary">
            <span>Tagesschau Wirtschaft</span>
            <span>FAZ</span>
            <span>Handelsblatt</span>
            <span>Manager Magazin</span>
            <span>Spiegel Wirtschaft</span>
            <span>WirtschaftsWoche</span>
            <span>Süddeutsche Zeitung</span>
            <span>Tagesspiegel</span>
            <span>NZZ</span>
            <span>Zeit Online</span>
            <span>Gründerszene</span>
            <span>Deutsche-Startups</span>
            <span>t3n</span>
            <span>Bundesanzeiger</span>
          </div>
        </div>
      </section>

      {/* ─── PROBLEM-AGITATE ──────────────────────────────────────── */}
      <section className="bg-bg-elevated border-y border-border-base py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-red-600 mb-4">
                ▼ DAS PROBLEM
              </div>
              <h2 className="text-3xl font-bold mb-6 leading-tight">
                Bis ein Stellenausschreibung im StepStone landet, ist das
                Recruiting-Rennen schon halb gelaufen.
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Die echten Signale für Personalbedarf passieren Wochen vorher:
                M&amp;A-Deals, neue CEOs, Werks-Erweiterungen, Funding-Runden,
                Restrukturierungen. Wer das früh sieht, gewinnt das Mandat.
                Wer drauf wartet, mailt Lebensläufe ins Leere.
              </p>
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-accent mb-4">
                ▲ UNSERE LÖSUNG
              </div>
              <h2 className="text-3xl font-bold mb-6 leading-tight">
                Predictive Hiring Intelligence — vom Signal bis zur Mandatschance,
                live und auf einen Blick.
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Wir klassifizieren 18 DACH-Wirtschaftsquellen in Echtzeit, scoren
                jede Firma auf einer 0-100-Hiring-Wahrscheinlichkeit, mappen
                Sektor + Bundesland + Forecast-Window. Du siehst auf einen Blick:
                wer bewegt sich, wo wird Talent frei, wo entstehen Bedarfe.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-4">
          ▸ FEATURES
        </div>
        <h2 className="text-4xl font-bold mb-16 max-w-2xl leading-tight">
          Sechs Kernfunktionen für deinen Recruiting-Vorsprung.
        </h2>

        <div className="grid md:grid-cols-2 gap-x-12 gap-y-12">
          <Feature
            number="01"
            title="Live-Discovery via OpenRouter"
            body="Alle 10 Minuten scannt der Radar das DACH-Web aktiv nach Hiring-Signalen. Erkennt 13 Signal-Typen: M&A, Insolvenz, Restrukturierung, Funding, Standortexpansion, Führungswechsel, Patente, Job-Spikes, Headcount-Wachstum, Produktlaunch, neue Geschäftsbereiche."
          />
          <Feature
            number="02"
            title="Wire-Feed mit Klassifier"
            body="Live-RSS-Stream aus 18 Top-Quellen. Jeder Eintrag wird automatisch nach Firma, Sektor, Bundesland, Signal-Typ, Impact (-100..+100), Confidence (0..1) klassifiziert. Eilmeldungen in rot, mit +N weitere Quellen."
          />
          <Feature
            number="03"
            title="Sector Intelligence"
            body="13 Sektoren mit Hiring-Score, Confidence, Momentum, Top-Signalen. Industrial AI ▲ +49% · Mobility ▼ -75% · Retail ▲ +87%. Klick auf Sektor → alle Firmen mit Signalen."
          />
          <Feature
            number="04"
            title="Bundesländer-Heat"
            body="Hiring-Karte über alle 16 Bundesländer mit Live-Macro-Overlay (Arbeitslosenquote pro Land). Quadranten-View Nord/Ost/Süd/West. Klick auf Bundesland → Top-Firmen + dominante Signale."
          />
          <Feature
            number="05"
            title="Morning Brief"
            body="Täglich um 06:00 frische Live-Recherche aus dem Web: Wer baut Stellen ab, wer schafft Stellen, welche Deals laufen. Mit Quellenangaben (Handelsblatt, manager-magazin, FAZ etc.) und Watch-Today-Liste."
          />
          <Feature
            number="06"
            title="Forecast-Engine"
            body="Pro Firma: Hiring-Probability (0-100%), Forecast-Window (Tage bis Bedarf), Top-Driver, erwartete Role-Cluster. Score &gt; 70 = High-Probability, Score &gt; 90 = Critical."
          />
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="how" className="bg-bg-elevated border-y border-border-base py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-4">
            ▸ SO FUNKTIONIERT&apos;S
          </div>
          <h2 className="text-4xl font-bold mb-16 max-w-2xl leading-tight">
            Vom Signal bis zur Mandatschance — in vier Schritten.
          </h2>

          <div className="grid md:grid-cols-4 gap-8">
            <Step
              num="01"
              title="Aggregation"
              body="18 RSS-Feeds + Live-Web-Discovery sammeln durchgehend News aus DACH-Wirtschaftsquellen."
            />
            <Step
              num="02"
              title="Klassifizierung"
              body="3-Layer-Engine ordnet jeden Eintrag einer Firma + Signal-Typ zu, mit Confidence-Score."
            />
            <Step
              num="03"
              title="Scoring"
              body="Forecast-Engine berechnet Hiring-Wahrscheinlichkeit, Window, Top-Driver, Role-Cluster."
            />
            <Step
              num="04"
              title="Intelligence"
              body="Dashboard zeigt KPIs, Sektor-Hotspots, Bundesländer-Heat, Forecast pro Firma — live."
            />
          </div>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-4">
          ▸ PREISE
        </div>
        <h2 className="text-4xl font-bold mb-4 max-w-2xl leading-tight">
          Per-Seat. Mit Volume-Discount für Agenturen.
        </h2>
        <p className="text-text-secondary mb-16 max-w-2xl">
          Jeder Seat = ein Recruiter mit eigenem Login, Watchlist, Notes.
          Volumen-Rabatte automatisch beim Upgrade.
        </p>

        <div className="grid md:grid-cols-4 gap-6">
          <PricingTier
            label="Trial"
            price="0"
            period="14 Tage gratis"
            highlight={false}
            features={[
              '1 Seat',
              'Voller Funktions-Zugang',
              'Live-Daten · alle Sektoren',
              'Keine Kreditkarte nötig',
            ]}
            cta="Kostenlos starten"
          />
          <PricingTier
            label="Standard"
            price="49"
            period="pro Seat / Monat"
            highlight={false}
            features={[
              '1–4 Seats',
              'Alle Funktionen',
              'Watchlist + Notes pro User',
              'Daily-Digest E-Mail',
            ]}
            cta="14 Tage testen"
          />
          <PricingTier
            label="Volume"
            price="35"
            period="pro Seat / Monat"
            highlight={true}
            features={[
              '5–24 Seats',
              '5–9 Seats: €39 · -20%',
              '10–24 Seats: €35 · -29%',
              'Auto-Discount im Checkout',
            ]}
            cta="Team-Plan starten"
          />
          <PricingTier
            label="Enterprise"
            price="29"
            period="pro Seat / Monat"
            highlight={false}
            features={[
              'Ab 25 Seats',
              '25+ Seats: €29 · -41%',
              'Custom-Subdomain',
              'Custom-Branding (Logo)',
              'API-Access (kommt Phase 6)',
              'AVV nach Wunsch',
            ]}
            cta="Verkauf kontaktieren"
          />
        </div>

        <div className="mt-12 text-sm text-text-secondary text-center">
          Alle Preise zzgl. USt. · Monatlich kündbar · Bezahlung über Stripe ·
          Daten liegen DSGVO-konform in der EU
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────── */}
      <section className="bg-bg-elevated border-t border-border-base py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-4">
            ▸ FRAGEN
          </div>
          <h2 className="text-4xl font-bold mb-12">Häufig gestellte Fragen.</h2>
          <div className="space-y-8">
            <Faq
              q="Woher kommen die Daten?"
              a="18 öffentlich zugängliche DACH-Wirtschaftsquellen (Tagesschau, FAZ, Handelsblatt, Spiegel, manager-magazin, NZZ, etc.) plus Live-Web-Discovery via OpenRouter / GPT-4o-mini mit Web-Search-Plugin. Keine Scraping von Paywall-Inhalten, keine Auswertung privater Daten."
            />
            <Faq
              q="DSGVO-konform?"
              a="Ja. Alle Datenquellen sind öffentliche Wirtschaftsnachrichten oder Pressemitteilungen. Kein Scraping personenbezogener Daten, keine LinkedIn-Profile, keine illegalen Quellen. Hosting in der EU (Vercel Frankfurt + Hostinger Frankfurt). AVV auf Wunsch."
            />
            <Faq
              q="Wie aktuell sind die Daten?"
              a="Wire-Feed: live (RSS-Polling alle 5 Min). Live-Discovery: alle 10 Min frische Web-Recherche. Macro-Indikatoren: alle 6 h von ECB / Eurostat. Morning Brief: täglich 06:00."
            />
            <Faq
              q="Kann ich eigene Quellen / Branchen einspeisen?"
              a="Im Enterprise-Tier: ja, via /api/ingest. n8n-Workflows oder eigene Scraper können Signale einspeisen, die dann durch die Klassifier laufen und ins Dashboard fließen."
            />
            <Faq
              q="Was passiert bei Vertragsende?"
              a="Watchlist-Export als CSV, dann werden alle deine Daten innerhalb von 30 Tagen gelöscht. Kein Vendor-Lock-In."
            />
            <Faq
              q="Bietet ihr White-Label an?"
              a="Ja — im Enterprise-Tier (ab 25 Seats). Custom-Subdomain (radar.deine-firma.de), Logo, Akzent-Farbe. Daily-Digest-Mails kommen aus deiner Domain."
            />
          </div>
        </div>
      </section>

      {/* ─── CTA-FOOTER ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20 text-center">
        <h2 className="text-4xl font-bold mb-6 leading-tight">
          Sehen, wie das morgen aussieht?
        </h2>
        <p className="text-xl text-text-secondary mb-10 max-w-2xl mx-auto">
          Live-Demo dauert 60 Sekunden. Keine Anmeldung, kein Lead-Form.
          Du kommst direkt rein und siehst echte Live-Daten.
        </p>
        <Link
          href="/"
          className="inline-block rounded-md bg-accent text-white px-8 py-4 font-semibold hover:opacity-90 transition"
        >
          Live-Dashboard öffnen →
        </Link>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-border-base py-10 mt-10">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap justify-between items-start gap-8 text-sm text-text-secondary">
          <div>
            <div className="font-mono uppercase tracking-wider text-text-primary mb-2">
              RSG · Predictive Hiring Radar
            </div>
            <div>Recruiting SG</div>
          </div>
          <div className="flex gap-8">
            <Link href="/impressum" className="hover:text-text-primary">
              Impressum
            </Link>
            <Link href="/datenschutz" className="hover:text-text-primary">
              Datenschutz
            </Link>
            <Link href="/agb" className="hover:text-text-primary">
              AGB
            </Link>
          </div>
          <div className="text-xs">
            © 2026 Recruiting SG · Alle Rechte vorbehalten
          </div>
        </div>
      </footer>
    </main>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────

function Feature({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="text-xs font-mono text-text-secondary mb-2">{number}</div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

function Step({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="text-xs font-mono text-accent mb-3">{num}</div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

function PricingTier({
  label,
  price,
  period,
  features,
  cta,
  highlight,
}: {
  label: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-6 flex flex-col ${
        highlight
          ? 'border-accent bg-accent/5'
          : 'border-border-base bg-bg-elevated'
      }`}
    >
      {highlight ? (
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">
          ★ Beliebt
        </div>
      ) : null}
      <div className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl font-bold">€{price}</span>
      </div>
      <div className="text-sm text-text-secondary mb-6">{period}</div>
      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f) => (
          <li key={f} className="text-sm flex items-start gap-2">
            <span className="text-accent mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/"
        className={`block text-center rounded-md px-4 py-2.5 font-medium transition ${
          highlight
            ? 'bg-accent text-white hover:opacity-90'
            : 'border border-border-base hover:bg-bg-base'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-border-base pb-6">
      <summary className="cursor-pointer flex items-center justify-between text-lg font-semibold py-2">
        {q}
        <span className="text-accent group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="text-text-secondary leading-relaxed pt-3">{a}</p>
    </details>
  );
}
