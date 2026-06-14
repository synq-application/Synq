
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
  if (hostE && hostT && hostE !== hostT) return false;

  if (hostE && hostT && hostE === hostT && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameHostLoose = siblingEvents.filter(
      (x) =>
        String(x?.planHostUid || "").trim() === hostE && eventKeyLoose(x) === eventKeyLoose(e)
    );
    if (sameHostLoose.length === 1) return true;
  }

  if (hostT && !hostE && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameLoose = siblingEvents.filter((x) => eventKeyLoose(x) === eventKeyLoose(target));
    const withoutHost = sameLoose.filter((x) => !String(x?.planHostUid || "").trim());
    if (withoutHost.length === 1 && withoutHost[0] === e) return true;
  }

  if (!hostT && hostE && eventKeyLoose(e) === eventKeyLoose(target)) {
    const sameLoose = siblingEvents.filter((x) => eventKeyLoose(x) === eventKeyLoose(target));
    const withHost = sameLoose.filter((x) => String(x?.planHostUid || "").trim() === hostE);
    if (withHost.length === 1 && withHost[0] === e) return true;
  }

  return false;
}

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

export function filterOutPastOpenPlans<T extends { date?: string }>(
  events: T[] | null | undefined
): T[] {
  if (!Array.isArray(events)) return [];
  return events.filter((e) => !isOpenPlanDatePast(String(e?.date || "")));
}

export function parseOpenPlanDateTime(dateStr: string, timeStr?: string): Date {
  const raw = String(dateStr || "").trim();
  const parts = raw.split("-").map(Number);
  const y = parts[0] || 1970;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  const date = new Date(y, m - 1, d);

  if (!timeStr) {
    date.setHours(12, 0, 0, 0);
    return date;
  }

  const [t, period] = String(timeStr).split(" ");
  let [hours, minutes] = t.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  date.setHours(hours, minutes || 0, 0, 0);
  return date;
}

/** Sort key for when a plan happens (earliest first). */
export function openPlanSortValue(event: { date?: string; time?: string }): number {
  return parseOpenPlanDateTime(String(event?.date || ""), event?.time).getTime();
}

/** Order open plans by event date/time, not when they were added. */
export function sortOpenPlansByDateTime<T extends { date?: string; time?: string }>(
  events: T[]
): T[] {
  return [...events].sort((a, b) => openPlanSortValue(a) - openPlanSortValue(b));
}

/** Friend UIDs who expressed interest on the host's plan (excludes the host). */
export function collectPlanInterestedFriendIds(
  event: any,
  hostUid?: string
): string[] {
  const host = String(hostUid || event?.planHostUid || "").trim();
  const ids = new Set<string>();
  if (Array.isArray(event?.joinedFromIds)) {
    event.joinedFromIds.forEach((id: unknown) => {
      const s = String(id || "").trim();
      if (s && s !== host) ids.add(s);
    });
  }
  const joinedFromId = String(event?.joinedFromId || "").trim();
  if (joinedFromId && joinedFromId !== host) ids.add(joinedFromId);
  return [...ids];
}

/** True when the viewer created this plan (not a copy joined from a friend). */
export function canEditOpenPlan(event: any, viewerUid: string): boolean {
  const viewer = String(viewerUid || "").trim();
  if (!viewer) return false;
  const host = String(event?.planHostUid || "").trim();
  if (host) return host === viewer;
  const joinedFromFriend = String(event?.joinedFromFriendUid || "").trim();
  if (joinedFromFriend && joinedFromFriend !== viewer) return false;
  return true;
}
