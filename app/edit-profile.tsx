import { Ionicons } from '@expo/vector-icons';
import * as Location from "expo-location";
import { router } from 'expo-router';
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { ACCENT, BG, BUTTON_RADIUS } from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import AlertModal from "./alert-modal";

const fonts = {
  black: 'Avenir-Black',
  heavy: 'Avenir-Heavy',
  medium: 'Avenir-Medium',
};

/**
 * US-only state name -> abbreviation mapping
 */
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

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [locating, setLocating] = useState(false);
  const [locationUsed, setLocationUsed] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");
  const [goBackOnClose, setGoBackOnClose] = useState(false);

  const showAlert = (message: string, title?: string, closeAndGoBack = false) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setGoBackOnClose(closeAndGoBack);
    setAlertVisible(true);
  };

  useEffect(() => {
    const loadUserData = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setDisplayName(data.displayName || '');
        setCity(data.city || '');
        setState(data.state || '');
        const lat = typeof data.lat === "number" ? data.lat : null;
        const lng = typeof data.lng === "number" ? data.lng : null;
        if (lat !== null && lng !== null) {
          setCoords({ lat, lng });
        }
      }
      setLoading(false);
    };
    loadUserData();
  }, []);

  const fillFromCurrentLocation = async () => {
    try {
      setLocationUsed(true);
      setLocating(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showAlert(
          "Enable location access to update your city and state.",
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
        (best?.city || best?.subregion || best?.district || "").trim();
      const detectedRegion = (best?.region || "").trim();

      if (!detectedCity || !detectedRegion) {
        showAlert("Please enter it manually.", "Couldn’t detect city/state");
        setLocationUsed(false);
        setLocating(false);
        return;
      }

      const abbrev =
        US_STATE_ABBREV[detectedRegion] ?? detectedRegion.toUpperCase().slice(0, 2);

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

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);

    try {
      const c = city.trim();
      const s = state.trim().toUpperCase();

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName: displayName.trim(),
        city: c,
        state: s,
        locationDisplay: c && s ? `${c}, ${s}` : "",
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        locationUpdatedAt: new Date().toISOString(),
      });

      showAlert("Profile updated!", "Success", true);
    } catch (e) {
      showAlert("Could not save profile.", "Error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.darkFill}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerAction}>
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>Edit profile</Text>
          </View>
          <View style={styles.headerAction} />
        </View>
        <View style={styles.headerDivider} />

        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#444"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 2, marginRight: 15 }]}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. New York"
              placeholderTextColor="#444"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>State</Text>
            <TextInput
              style={styles.input}
              value={state}
              onChangeText={setState}
              placeholder="NY"
              placeholderTextColor="#444"
              maxLength={2}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {!locationUsed && (
          <TouchableOpacity
            onPress={fillFromCurrentLocation}
            disabled={saving || locating}
            activeOpacity={0.85}
            style={[styles.locationRow, (saving || locating) && { opacity: 0.7 }]}
          >
            <View style={styles.locationLeft}>
              <Text style={styles.locationIcon}>📍</Text>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.locationPrimary}>
                  {locating ? "Using current location…" : "Update using current location"}
                </Text>
                <Text style={styles.locationSecondary}>
                  {locating ? "Finding your city and state" : "Auto-fill city & state"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveButton, saving && { opacity: 0.7 }]}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="black" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
        </ScrollView>
        <AlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          onClose={() => {
            setAlertVisible(false);
            if (goBackOnClose) router.back();
            setGoBackOnClose(false);
          }}
        />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  darkFill: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  headerTitleBlock: {
    flex: 1,
    paddingHorizontal: 10,
  },
  headerTitle: { color: 'white', fontSize: 22, fontFamily: fonts.heavy, letterSpacing: 0.2 },
  headerAction: { width: 40, alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  headerDivider: { marginTop: 16, height: 1, backgroundColor: '#222' },

  form: { padding: 25, paddingTop: 18, paddingBottom: 12 },

  inputGroup: { marginBottom: 25 },
  label: {
    color: '#666',
    fontSize: 12,
    fontFamily: fonts.heavy,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 1
  },
  input: {
    backgroundColor: '#111',
    color: 'white',
    padding: 15,
    borderRadius: BUTTON_RADIUS,
    fontSize: 16,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: '#222'
  },
  row: { flexDirection: 'row' },
  locationRow: {
    marginTop: 6,
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
    flex: 1,
    paddingRight: 10,
  },
  locationIcon: { fontSize: 16 },
  locationPrimary: { color: "white", fontSize: 14, fontWeight: "800" },
  locationSecondary: { marginTop: 2, color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  saveButton: {
    marginTop: 24,
    alignSelf: "center",
    height: 52,
    width: "62%",
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "black",
    fontSize: 16,
    fontFamily: fonts.heavy,
  },
});
