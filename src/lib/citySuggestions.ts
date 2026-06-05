import { washingtonDcSuggestions } from "../data/citySuggestions/washington-dc";
import type { SynqSuggestion } from "./synqSuggestions";

import {
  getCachedCitySuggestions as getCachedCitySuggestionsCore,
  matchesWashingtonDcMetro,
  resolveCityId,
} from "./citySuggestionsCore";

const cityRegistry = [
  {
    cityId: washingtonDcSuggestions.cityId,
    match: matchesWashingtonDcMetro,
  },
];

const cityDataById = {
  [washingtonDcSuggestions.cityId]: washingtonDcSuggestions,
};

export function getCachedCitySuggestions(
  locationPrompt: string,
  category: string,
  excludeNames: string[] = []
): SynqSuggestion[] | null {
  return getCachedCitySuggestionsCore(
    locationPrompt,
    category,
    cityDataById,
    cityRegistry,
    excludeNames
  );
}

export function hasCachedCitySuggestions(locationPrompt: string): boolean {
  return resolveCityId(locationPrompt, cityRegistry) !== null;
}

export async function cachedImageLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}
