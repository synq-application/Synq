/**
 * Shared identity for open-plan rows across users (join, sync, delete).
 * planHostUid = canonical creator / host uid for the plan (set on create + join).
 */

export function eventKey(event: any): string {
  return `${String(event?.title || "").trim().toLowerCase()}|${String(event?.date || "").trim()}|${String(
    event?.time || ""
  ).trim().toLowerCase()}|${String(event?.location || "").trim().toLowerCase()}`;
}

export function eventKeyLoose(event: any): string {
  return `${String(event?.title || "").trim().toLowerCase()}|${String(event?.date || "").trim()}`;
}

export function matchesPlanEvent(e: any, target: any, siblingEvents: any[]): boolean {
  if (eventKey(e) === eventKey(target)) return true;

  const hostE = String(e?.planHostUid || "").trim();
  const hostT = String(target?.planHostUid || "").trim();
  if (hostE && hostT && hostE === hostT && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameHostLoose = siblingEvents.filter(
      (x) =>
        String(x?.planHostUid || "").trim() === hostE && eventKeyLoose(x) === eventKeyLoose(e)
    );
    if (sameHostLoose.length === 1) return true;
  }

  // Join template has host id but creator's row predates planHostUid — disambiguate by single unmarked row.
  if (hostT && !hostE && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameLoose = siblingEvents.filter((x) => eventKeyLoose(x) === eventKeyLoose(target));
    const withoutHost = sameLoose.filter((x) => !String(x?.planHostUid || "").trim());
    if (withoutHost.length === 1 && withoutHost[0] === e) return true;
  }

  // Delete: template is host's old row (no planHostUid) but joiner's copy has planHostUid — single row with that host.
  if (!hostT && hostE && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameLoose = siblingEvents.filter((x) => eventKeyLoose(x) === eventKeyLoose(target));
    const withHost = sameLoose.filter((x) => String(x?.planHostUid || "").trim() === hostE);
    if (withHost.length === 1 && withHost[0] === e) return true;
  }

  if (eventKeyLoose(e) !== eventKeyLoose(target)) return false;
  const sameLoose = siblingEvents.filter((x) => eventKeyLoose(x) === eventKeyLoose(target));
  return sameLoose.length === 1;
}

/**
 * When syncing to the plan host's user doc, strict matching can fail (e.g. time/location drift).
 * Match the host's row by title+date + planHostUid (or legacy row with no planHostUid yet).
 */
export function matchesPlanEventForHostSync(
  e: any,
  target: any,
  siblingEvents: any[],
  planHostUid: string
): boolean {
  const host = String(planHostUid || "").trim();
  if (!host) return false;
  if (eventKeyLoose(e) !== eventKeyLoose(target)) return false;
  const rowHost = String(e?.planHostUid || "").trim();
  if (rowHost && rowHost !== host) return false;
  const candidates = siblingEvents.filter(
    (x) =>
      eventKeyLoose(x) === eventKeyLoose(target) &&
      (!String(x?.planHostUid || "").trim() || String(x.planHostUid).trim() === host)
  );
  return candidates.length === 1 && candidates[0] === e;
}

/** Calendar day of `eventDateStr` (YYYY-MM-DD) is strictly before today in local time. */
export function isOpenPlanDatePast(eventDateStr: string, now: Date = new Date()): boolean {
  const raw = String(eventDateStr || "").trim();
  if (!raw) return false;
  const parts = raw.split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return false;
  const [y, m, d] = parts;
  const eventDayStart = new Date(y, m - 1, d);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return todayStart.getTime() > eventDayStart.getTime();
}

/** Drop plans whose calendar date is before today (local). */
export function filterOutPastOpenPlans<T extends { date?: string }>(
  events: T[] | null | undefined
): T[] {
  if (!Array.isArray(events)) return [];
  return events.filter((e) => !isOpenPlanDatePast(String(e?.date || "")));
}
