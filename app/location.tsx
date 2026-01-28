import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../src/lib/firebase";
import { useAuthRefresh } from "./_layout";

const ACCENT = "#7DFFA6";

const US_STATE_ABBREV: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

export default function LocationDetails() {
  const router = useRouter();
  const { refreshAuth } = useAuthRefresh();

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationUsed, setLocationUsed] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const canContinue = useMemo(() => {
    return !!city.trim() && !!state.trim() && !loading && !locating;
  }, [city, state, loading, locating]);

  const fillFromCurrentLocation = async () => {
    try {
      setLocationUsed(true); // hide the row immediately
      setLocating(true);

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Enable location access to auto-fill your city and state."
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
        Alert.alert(
          "Couldn’t detect city/state",
          "Please enter it manually."
        );
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
      Alert.alert("Error", "Could not get your current location.");
    }
  };

  const saveLocation = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);

      const c = city.trim();
      const s = state.trim().toUpperCase();

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
      Alert.alert("Error", "Could not save location.");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    refreshAuth();
    router.push("/add-interests");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Where do you live?</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    padding: 24,
    justifyContent: "center",
  },
  title: { color: "white", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 16, marginTop: 8 },

  input: {
    color: "white",
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  locationRow: {
    marginTop: 12,
    borderRadius: 14,
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
    backgroundColor: ACCENT,
    height: 52,
    borderRadius: 14,
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
