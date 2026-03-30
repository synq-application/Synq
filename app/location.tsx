import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  onboardingContentTopPadding,
  ONBOARDING_DIVIDER_MARGIN_TOP,
  ONBOARDING_DIVIDER_WIDTH,
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
  ONBOARDING_SUBTITLE_MARGIN_TOP,
  ONBOARDING_SUBTITLE_SIZE,
  ONBOARDING_TITLE_LINE_HEIGHT,
  ONBOARDING_TITLE_SIZE,
} from "../constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  MUTED,
  TEXT,
  fonts,
} from "../constants/Variables";
import { stateAbbreviations } from "../assets/Mocks";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../src/lib/firebase";
import AlertModal from "./alert-modal";
import { useAuthRefresh } from "./_layout";

const US_STATE_ABBREV: Record<string, string> = stateAbbreviations;

const VALID_US_STATE_ABBREVS = new Set(Object.values(stateAbbreviations));

function isValidStateAbbrev(abbrev: string): boolean {
  return VALID_US_STATE_ABBREVS.has(abbrev.trim().toUpperCase());
}

export default function LocationDetails() {
  const router = useRouter();
  const { refreshAuth } = useAuthRefresh();
  const insets = useSafeAreaInsets();

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationUsed, setLocationUsed] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const canContinue = useMemo(() => {
    const s = state.trim().toUpperCase();
    return (
      !!city.trim() &&
      s.length === 2 &&
      isValidStateAbbrev(s) &&
      !loading &&
      !locating
    );
  }, [city, state, loading, locating]);

  const fillFromCurrentLocation = async () => {
    try {
      setLocationUsed(true); // hide the row immediately
      setLocating(true);

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        showAlert(
          "Enable location access to auto-fill your city and state.",
          "Location permission needed"
        );
        setLocationUsed(false);
        setLocating(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCoords({ lat, lng });

      const results = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      const best = results?.[0];

      const detectedCity =
        (best?.city ||
          best?.subregion ||
          best?.district ||
          "").trim();

      const detectedRegion = (best?.region || "").trim();

      if (!detectedCity || !detectedRegion) {
        showAlert("Please enter it manually.", "Couldn’t detect city/state");
        setLocationUsed(false);
        setLocating(false);
        return;
      }

      const abbrev =
        US_STATE_ABBREV[detectedRegion] ??
        detectedRegion.toUpperCase().slice(0, 2);

      setCity(detectedCity);
      setState(abbrev);
      setLocating(false);
    } catch (e: any) {
      console.error(e);
      setLocationUsed(false);
      setLocating(false);
      showAlert("Could not get your current location.", "Error");
    }
  };

  const saveLocation = async () => {
    if (!auth.currentUser) return;

    const c = city.trim();
    const s = state.trim().toUpperCase();

    if (s.length !== 2 || !isValidStateAbbrev(s)) {
      showAlert(
        "Enter a valid 2-letter US state or DC abbreviation (for example WA, CA, or DC).",
        "Invalid state abbreviation"
      );
      return;
    }

    try {
      setLoading(true);

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          city: c,
          state: s,
          locationDisplay: `${c}, ${s}`,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          locationUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      refreshAuth();
      router.push("/add-interests");
    } catch (e: any) {
      console.error(e);
      showAlert("Could not save location.", "Error");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    refreshAuth();
    router.push("/add-interests");
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(
                onboardingContentTopPadding(),
                insets.top + 24
              ),
              paddingBottom: ONBOARDING_SCROLL_BOTTOM + 12 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
        <Text style={styles.title}>Where do you live?</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>
          This helps friends see who is nearby for a quick Synq.
        </Text>

        <View style={{ marginTop: 24 }}>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="City (e.g. Seattle)"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
          />

          <TextInput
            value={state}
            onChangeText={setState}
            placeholder="State (e.g. WA)"
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoCapitalize="characters"
            maxLength={2}
            style={[styles.input, { marginTop: 12 }]}
          />

          {!locationUsed && (
            <TouchableOpacity
              onPress={fillFromCurrentLocation}
              disabled={loading || locating}
              activeOpacity={0.85}
              style={styles.locationRow}
            >
              <View style={styles.locationLeft}>
                <Text style={styles.locationIcon}>📍</Text>
                <View>
                  <Text style={styles.locationPrimary}>
                    Use current location
                  </Text>
                  <Text style={styles.locationSecondary}>
                    Auto-fill your city & state
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          disabled={!canContinue}
          onPress={saveLocation}
          style={[
            styles.button,
            !canContinue && { opacity: 0.5 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
        <AlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          onClose={() => setAlertVisible(false)}
        />
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: ONBOARDING_H_PADDING,
  },
  scrollContent: {
    flexGrow: 1,
  },
  title: {
    color: TEXT,
    fontSize: ONBOARDING_TITLE_SIZE,
    lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  divider: {
    marginTop: ONBOARDING_DIVIDER_MARGIN_TOP,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  subtitle: {
    color: MUTED,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    marginTop: ONBOARDING_SUBTITLE_MARGIN_TOP,
    fontFamily: fonts.book,
    lineHeight: 22,
  },

  input: {
    color: "white",
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 52,
    borderRadius: BUTTON_RADIUS,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  locationRow: {
    marginTop: 12,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationIcon: { fontSize: 16 },
  locationPrimary: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },
  locationSecondary: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "600",
  },
  locationChevron: {
    color: ACCENT,
    fontSize: 22,
    fontWeight: "900",
  },

  button: {
    marginTop: 24,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "black", fontSize: 16, fontWeight: "800" },

  skipButton: { marginTop: 20, alignSelf: "center" },
  skipText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
  },
});
