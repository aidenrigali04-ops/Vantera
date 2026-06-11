import {
  ExploriumProspectData,
  InMemoryProspectData,
  makeCandidate,
  type ProspectDataSource,
} from "@vantera/prospect-data";

/** Dev pool so end-to-end dry runs work without a provider key. */
export function seedPool() {
  const industries = ["saas", "fintech", "logistics", "healthcare", "devtools"];
  const titles = ["CTO", "VP Sales", "Head of Growth", "CEO", "VP Operations"];
  return Array.from({ length: 40 }, (_, i) =>
    makeCandidate({
      externalRef: `seed_${i}`,
      companyName: `Seedco ${i}`,
      industry: industries[i % industries.length],
      title: titles[i % titles.length],
      companySize: i % 2 === 0 ? "11-50" : "51-200",
      location: "united states",
    })
  );
}

/** Live adapter when the key is configured, deterministic seeded fake otherwise. */
export function createProspectData(): ProspectDataSource {
  if (process.env.EXPLORIUM_API_KEY) {
    return new ExploriumProspectData();
  }
  return new InMemoryProspectData(seedPool());
}
