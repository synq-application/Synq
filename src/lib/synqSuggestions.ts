import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app } from "./firebase";

const functions = getFunctions(app, "us-central1");

export type SynqSuggestion = {
  name: string;
  rating?: string;
  imageUrl?: string | null;
  location?: string;
  address?: string;
};

export function locationLabelFromUser(
  data: Record<string, unknown> | undefined
): string {
  if (!data) return "";
  const city = typeof data.city === "string" ? data.city.trim() : "";
  const state = typeof data.state === "string" ? data.state.trim() : "";
  return [city, state].filter(Boolean).join(" ").trim();
}

export function callableErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    const msg = err.message?.trim();
    if (msg && !/^internal$/i.test(msg)) return msg;
    return "Could not load suggestions. Please try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Could not load suggestions. Please try again.";
}

function normalizeSuggestion(raw: unknown): SynqSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const name = String(row.name || row.title || "").trim();
  if (!name) return null;
  const location =
    typeof row.location === "string" ? row.location.trim() : "";
  const address = typeof row.address === "string" ? row.address.trim() : "";
  const imageUrl =
    typeof row.imageUrl === "string"
      ? row.imageUrl
      : typeof row.imageurl === "string"
        ? row.imageurl
        : null;
  return {
    name,
    rating: row.rating != null ? String(row.rating) : "4.0",
    imageUrl,
    location: location || address,
    address: address || location,
  };
}

export async function fetchSynqSuggestions(payload: {
  category: string;
  shared: string[];
  location: string;
}): Promise<SynqSuggestion[]> {
  const fn = httpsCallable(functions, "getSynqSuggestions", {
    timeout: 120000,
  });
  const result = await fn(payload);
  const data = result.data as {
    suggestions?: unknown[];
    suggestion?: string;
  } | null;

  if (Array.isArray(data?.suggestions)) {
    return data.suggestions
      .map(normalizeSuggestion)
      .filter((item): item is SynqSuggestion => item != null);
  }

  if (typeof data?.suggestion === "string" && data.suggestion.trim()) {
    return [];
  }

  return [];
}
