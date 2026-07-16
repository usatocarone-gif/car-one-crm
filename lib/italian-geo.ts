import { CITIES_ATTRIBUTES } from "comuni-province-regioni/lib/city";
import Province, { provinceToString } from "comuni-province-regioni/lib/province";

type CityAttributes = { name: string; province: string; region: string };

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function simplify(value: string) {
  return normalize(value).replace(/\b(di|del|dello|della|dei|degli|delle|a|in)\b/g, " ").replace(/\s+/g, " ").trim();
}

const cities = Object.values(CITIES_ATTRIBUTES) as CityAttributes[];
const cityByName = new Map(cities.map((city) => [normalize(city.name), city]));
const cityBySimplifiedName = new Map(cities.map((city) => [simplify(city.name), city]));
const cityByCompactName = new Map(cities.map((city) => [normalize(city.name).replace(/\s/g, ""), city]));
const cityByFirstToken = new Map<string, CityAttributes[]>();
const regionByProvinceCode = new Map<string, string>();
const provinceNameByCode = new Map<string, string>();

cities.forEach((city) => {
  const key = normalize(city.name).split(" ")[0];
  cityByFirstToken.set(key, [...(cityByFirstToken.get(key) ?? []), city]);
  regionByProvinceCode.set(String(city.province).toLowerCase(), String(city.region));
});

Object.values(Province).forEach((code) => {
  provinceNameByCode.set(String(code).toLowerCase(), provinceToString(code));
});

function matchCity(raw: string) {
  const normalized = normalize(raw);
  if (!normalized || /^\d+$/.test(normalized)) return null;
  const direct = cityByName.get(normalized);
  if (direct) return direct;
  const simplifiedDirect = cityBySimplifiedName.get(simplify(raw));
  if (simplifiedDirect) return simplifiedDirect;
  const compactDirect = cityByCompactName.get(normalized.replace(/\s/g, ""));
  if (compactDirect) return compactDirect;

  const variants = [
    normalized.split("/")[0],
    normalized.replace(/\b(provincia|prov|comune|citta|di)\b/g, " ").replace(/\s+/g, " ").trim(),
  ];
  for (const variant of variants) {
    const exact = cityByName.get(variant);
    if (exact) return exact;
    const simplified = simplify(variant);
    const simplifiedExact = cityBySimplifiedName.get(simplified);
    if (simplifiedExact) return simplifiedExact;
    const first = variant.split(" ")[0];
    const candidates = cityByFirstToken.get(first) ?? [];
    const contained = candidates
      .filter((city) => variant.includes(normalize(city.name)) || simplified.includes(simplify(city.name)))
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (contained) return contained;
  }
  return null;
}

export function resolveItalianGeo(rawCity: string) {
  const city = matchCity(rawCity);
  if (city) {
    return {
      city: city.name,
      province: provinceNameByCode.get(String(city.province).toLowerCase()) ?? String(city.province),
      region: String(city.region),
    };
  }

  const normalized = normalize(rawCity);
  const provinceCode = normalized.match(/^(?:provincia )?([a-z]{2})$/)?.[1];
  if (provinceCode && regionByProvinceCode.has(provinceCode)) {
    return {
      city: rawCity.trim() || "Non indicata",
      province: provinceNameByCode.get(provinceCode) ?? provinceCode.toUpperCase(),
      region: regionByProvinceCode.get(provinceCode)!,
    };
  }

  return {
    city: rawCity.trim() || "Non indicata",
    province: "Da classificare",
    region: "Da classificare",
  };
}
