import { arlingtonVaSuggestions } from "../data/citySuggestions/arlington-va";
import { bostonMaSuggestions } from "../data/citySuggestions/boston-ma";
import { chicagoIlSuggestions } from "../data/citySuggestions/chicago-il";
import { deweyBeachDeSuggestions } from "../data/citySuggestions/dewey-beach-de";
import { newYorkNySuggestions } from "../data/citySuggestions/new-york-ny";
import { washingtonDcSuggestions } from "../data/citySuggestions/washington-dc";
import type { SynqSuggestion } from "./synqSuggestions";

import { formatUserLocationLabel } from "./chatAiLocation";

import {
  allParticipantsHaveCachedCitySuggestions as allParticipantsHaveCachedCitySuggestionsCore,
  getCachedCitySuggestions as getCachedCitySuggestionsCore,
  matchesArlingtonVa,
  matchesBostonMa,
  matchesChicagoIl,
  matchesDeweyBeachDe,
  matchesNewYorkCity,
  matchesWashingtonDcMetro,
  resolveCityId,
} from "./citySuggestionsCore";

const cityRegistry = [
  {
    cityId: arlingtonVaSuggestions.cityId,
    match: matchesArlingtonVa,
  },
  {
    cityId: bostonMaSuggestions.cityId,
    match: matchesBostonMa,
  },
  {
    cityId: chicagoIlSuggestions.cityId,
    match: matchesChicagoIl,
  },
  {
    cityId: deweyBeachDeSuggestions.cityId,
    match: matchesDeweyBeachDe,
  },
  {
    cityId: newYorkNySuggestions.cityId,
    match: matchesNewYorkCity,
  },
  {
    cityId: washingtonDcSuggestions.cityId,
    match: matchesWashingtonDcMetro,
  },
];

const cityDataById = {
  [arlingtonVaSuggestions.cityId]: arlingtonVaSuggestions,
  [bostonMaSuggestions.cityId]: bostonMaSuggestions,
  [chicagoIlSuggestions.cityId]: chicagoIlSuggestions,
  [deweyBeachDeSuggestions.cityId]: deweyBeachDeSuggestions,
  [newYorkNySuggestions.cityId]: newYorkNySuggestions,
  [washingtonDcSuggestions.cityId]: washingtonDcSuggestions,
};

export function getCachedCitySuggestions(
  senderLocationLabel: string,
  category: string,
  excludeNames: string[] = []
): SynqSuggestion[] | null {
  return getCachedCitySuggestionsCore(
    senderLocationLabel,
    category,
    cityDataById,
    cityRegistry,
    excludeNames
  );
}

export function hasCachedCitySuggestions(senderLocationLabel: string): boolean {
  return resolveCityId(senderLocationLabel, cityRegistry) !== null;
}

export function allParticipantsHaveCachedCitySuggestions(
  participantData: Record<string, unknown>[]
): boolean {
  const labels = participantData.map((data) => formatUserLocationLabel(data));
  return allParticipantsHaveCachedCitySuggestionsCore(labels, cityRegistry);
}

export async function cachedImageLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}
