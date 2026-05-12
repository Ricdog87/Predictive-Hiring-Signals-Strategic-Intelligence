import { describe, it, expect } from "vitest";
import {
  isPersonaldienstleister,
  filterB2BEmployers,
  isCorporateInhouseSubsidiary,
  normaliseEmployerName,
} from "./employerFilters";

describe("isPersonaldienstleister · PDL drops", () => {
  const pdlNames = [
    "Randstad Deutschland",
    "DIS AG Germany",
    "ARWA Personaldienstleistungen GmbH",
    "TimePartner Personalmanagement GmbH",
    "Hays AG",
    "Michael Page GmbH",
    "LicaVital GmbH",
    "rocket match powered by notificAI GmbH",
  ];
  it.each(pdlNames)("returns true for %s", (name) => {
    expect(isPersonaldienstleister(name)).toBe(true);
  });
});

describe("isPersonaldienstleister · Endkunden pass", () => {
  const endkunden = [
    "Takko Fashion",
    "TEDi Warenhandels GmbH",
    "XXXL-Zentralverwaltungs- GmbH & Co. KG",
    "GOLDBECK GmbH",
    "Lidl Dienstleistung GmbH & Co. KG",
    "ALDI SÜD Dienstleistungs- SE & Co. oHG",
    "REWE International Dienstleistungsgesellschaft mbH",
  ];
  it.each(endkunden)("returns false for %s", (name) => {
    expect(isPersonaldienstleister(name)).toBe(false);
  });
});

describe("isCorporateInhouseSubsidiary", () => {
  it("matches Lidl Dienstleistung", () => {
    expect(isCorporateInhouseSubsidiary("Lidl Dienstleistung GmbH & Co. KG")).toBe(
      true,
    );
  });
  it("matches ALDI SÜD prefix despite Dienstleistungs suffix", () => {
    expect(
      isCorporateInhouseSubsidiary("ALDI SÜD Dienstleistungs- SE & Co. oHG"),
    ).toBe(true);
  });
  it("matches REWE inhouse dienstleistung", () => {
    expect(
      isCorporateInhouseSubsidiary(
        "REWE International Dienstleistungsgesellschaft mbH",
      ),
    ).toBe(true);
  });
  it("does not match non-corporate-prefix names", () => {
    expect(isCorporateInhouseSubsidiary("Lidlomatic GmbH")).toBe(false);
    expect(isCorporateInhouseSubsidiary("Randstad Deutschland")).toBe(false);
  });
});

describe("filterB2BEmployers", () => {
  it("splits a realistic mixed list correctly", () => {
    const input = [
      { name: "Randstad Deutschland", postings: 120 },
      { name: "Takko Fashion", postings: 80 },
      { name: "Hays AG", postings: 60 },
      { name: "Lidl Dienstleistung GmbH & Co. KG", postings: 45 },
      { name: "DIS AG Germany", postings: 40 },
      { name: "GOLDBECK GmbH", postings: 38 },
      { name: "Michael Page GmbH", postings: 24 },
      { name: "REWE International Dienstleistungsgesellschaft mbH", postings: 21 },
      { name: "ARWA Personaldienstleistungen GmbH", postings: 18 },
      { name: "ALDI SÜD Dienstleistungs- SE & Co. oHG", postings: 15 },
    ];

    const { keep, dropped } = filterB2BEmployers(input);

    expect(keep.map((k) => k.name)).toEqual([
      "Takko Fashion",
      "Lidl Dienstleistung GmbH & Co. KG",
      "GOLDBECK GmbH",
      "REWE International Dienstleistungsgesellschaft mbH",
      "ALDI SÜD Dienstleistungs- SE & Co. oHG",
    ]);

    expect(dropped.map((d) => d.name)).toEqual([
      "Randstad Deutschland",
      "Hays AG",
      "DIS AG Germany",
      "Michael Page GmbH",
      "ARWA Personaldienstleistungen GmbH",
    ]);
  });

  it("is stable: keep order preserves input order", () => {
    const input = [
      { name: "Alpha GmbH" },
      { name: "Randstad" },
      { name: "Beta KG" },
      { name: "Hays" },
      { name: "Gamma SE" },
    ];
    const { keep } = filterB2BEmployers(input);
    expect(keep.map((k) => k.name)).toEqual(["Alpha GmbH", "Beta KG", "Gamma SE"]);
  });
});

describe("normaliseEmployerName · edge cases", () => {
  it("strips trailing GmbH & Co. KG cleanly", () => {
    expect(normaliseEmployerName("XXXL-Zentralverwaltungs- GmbH & Co. KG")).toBe(
      "xxxl-zentralverwaltungs",
    );
  });
  it("collapses whitespace and lowercases", () => {
    expect(normaliseEmployerName("  Hays    AG  ")).toBe("hays");
  });
  it("strips SE & Co. oHG", () => {
    expect(normaliseEmployerName("ALDI SÜD Dienstleistungs- SE & Co. oHG")).toBe(
      "aldi süd dienstleistungs",
    );
  });
});
