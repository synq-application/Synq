import { router } from "expo-router";
import { useEffect, useState } from "react";
import { getPreAuthTermsAccepted } from "./communityTerms";

/** Redirects to community-terms if pre-auth acceptance is missing. */
export function usePreAuthTermsGate(next: "phone" | "login" | "email") {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const accepted = await getPreAuthTermsAccepted();
      if (cancelled) return;
      if (!accepted) {
        router.replace(`/(auth)/community-terms?next=${next}`);
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [next]);

  return ready;
}
