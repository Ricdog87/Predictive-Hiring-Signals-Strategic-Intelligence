import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: "Datenschutzerklärung nach DSGVO",
};

export default function DatenschutzPage() {
  const operator = "Recruiting SG";
  const email =
    process.env.NEXT_PUBLIC_LEGAL_EMAIL || "kontakt@recruiting-sg.de";

  return (
    <>
      <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>
      <p className="mt-2 text-text-secondary">
        Stand · {new Date().getFullYear()}
      </p>

      <section className="mt-8 space-y-2">
        <h2 className="text-base font-semibold">1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website ist:
        </p>
        <p>{operator}</p>
        <p>{process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "[Straße und Hausnummer]"}</p>
        <p>{process.env.NEXT_PUBLIC_LEGAL_CITY || "[PLZ und Ort]"}</p>
        <p>
          E-Mail:{" "}
          <a className="text-accent-cyan hover:underline" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      </section>

      <section className="mt-6 space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          2. Zugriffsdaten
        </h2>
        <p>
          Beim Aufruf dieser Website werden automatisch Informationen
          allgemeiner Natur erfasst (Browsertyp/-version, verwendetes
          Betriebssystem, Referrer-URL, Hostname des zugreifenden Rechners,
          Uhrzeit der Serveranfrage, IP-Adresse). Diese Daten werden zur
          Sicherstellung eines störungsfreien Betriebs verarbeitet (Art. 6
          Abs. 1 lit. f DSGVO).
        </p>
      </section>

      <section className="mt-6 space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          3. Verarbeitete Daten im Rahmen des Dienstes
        </h2>
        <p>
          RSG Hiring Radar verarbeitet ausschließlich öffentlich zugängliche
          Unternehmensinformationen aus offiziellen Quellen
          (Stellenausschreibungen, Pressemitteilungen, Wirtschaftsregister,
          Statistikämter). Personenbezogene Daten zu Bewerber:innen oder
          Mitarbeiter:innen werden nicht verarbeitet.
        </p>
      </section>

      <section className="mt-6 space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          4. Cookies und lokaler Speicher
        </h2>
        <p>
          Wir setzen technisch notwendigen lokalen Speicher (LocalStorage)
          ein, um Watchlist-Einträge und Anzeige-Einstellungen geräteseitig
          zu erhalten. Tracking-Cookies oder Marketing-Cookies werden nicht
          verwendet.
        </p>
      </section>

      <section className="mt-6 space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          5. Auftragsverarbeitung / Hosting
        </h2>
        <p>
          Hosting der Plattform erfolgt bei Vercel Inc. (340 S Lemon Ave
          #4133, Walnut, CA 91789, USA). Mit Vercel besteht ein Vertrag zur
          Auftragsverarbeitung gemäß Art. 28 DSGVO. Datenbank-Hosting
          erfolgt bei Supabase (Auftragsverarbeitungsvertrag liegt vor).
        </p>
      </section>

      <section className="mt-6 space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          6. Ihre Rechte
        </h2>
        <p>
          Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung
          (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung
          (Art. 18), Datenübertragbarkeit (Art. 20) sowie Widerspruch
          (Art. 21). Bitte wenden Sie sich an{" "}
          <a className="text-accent-cyan hover:underline" href={`mailto:${email}`}>
            {email}
          </a>
          .
        </p>
        <p>
          Daneben steht Ihnen ein Beschwerderecht bei einer
          Datenschutz-Aufsichtsbehörde zu.
        </p>
      </section>

      <section className="mt-6 space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          7. Aktualität
        </h2>
        <p>
          Diese Datenschutzerklärung wird bei wesentlichen Änderungen der
          Verarbeitung angepasst.
        </p>
      </section>
    </>
  );
}
