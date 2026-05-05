import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Anbieterkennzeichnung gem. § 5 TMG",
};

export default function ImpressumPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Impressum</h1>
      <p className="mt-2 text-text-secondary">Angaben gemäß § 5 TMG</p>

      <section className="mt-8 space-y-1">
        <h2 className="text-base font-semibold">Anbieter</h2>
        <p>Recruiting SG</p>
        <p>{process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "[Straße und Hausnummer]"}</p>
        <p>{process.env.NEXT_PUBLIC_LEGAL_CITY || "[PLZ und Ort]"}</p>
        <p>Deutschland</p>
      </section>

      <section className="mt-6 space-y-1">
        <h2 className="text-base font-semibold">Kontakt</h2>
        <p>
          E-Mail:{" "}
          <a
            className="text-accent-cyan hover:underline"
            href={`mailto:${
              process.env.NEXT_PUBLIC_LEGAL_EMAIL || "kontakt@recruiting-sg.de"
            }`}
          >
            {process.env.NEXT_PUBLIC_LEGAL_EMAIL || "kontakt@recruiting-sg.de"}
          </a>
        </p>
        {process.env.NEXT_PUBLIC_LEGAL_PHONE && (
          <p>Telefon: {process.env.NEXT_PUBLIC_LEGAL_PHONE}</p>
        )}
      </section>

      <section className="mt-6 space-y-1">
        <h2 className="text-base font-semibold">
          Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
        </h2>
        <p>{process.env.NEXT_PUBLIC_LEGAL_RESPONSIBLE || "Ricardo [Nachname]"}</p>
        <p>(Anschrift wie oben)</p>
      </section>

      {process.env.NEXT_PUBLIC_LEGAL_VAT_ID && (
        <section className="mt-6 space-y-1">
          <h2 className="text-base font-semibold">Umsatzsteuer-ID</h2>
          <p>{process.env.NEXT_PUBLIC_LEGAL_VAT_ID}</p>
        </section>
      )}

      <section className="mt-8 space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          Haftung für Inhalte
        </h2>
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte
          auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
          §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
          verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
          überwachen oder nach Umständen zu forschen, die auf eine
          rechtswidrige Tätigkeit hinweisen.
        </p>
      </section>

      <section className="mt-6 space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          Haftung für Links
        </h2>
        <p>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren
          Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
          fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
          verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
          der Seiten verantwortlich.
        </p>
      </section>

      <section className="mt-6 space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          Urheberrecht
        </h2>
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
          diesen Seiten unterliegen dem deutschen Urheberrecht.
          Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
          Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
          schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
        </p>
      </section>
    </>
  );
}
