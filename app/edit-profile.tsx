import { Ionicons } from '@expo/vector-icons';
import * as Location from "expo-location";
import { router } from 'expo-router';
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { ACCENT, BG, BUTTON_RADIUS, MUTED2 } from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";

const fonts = {
  black: 'Avenir-Black',
  heavy: 'Avenir-Heavy',
  medium: 'Avenir-Medium',
};

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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showRemoveLocationConfirm, setShowRemoveLocationConfirm] = useState(false);
  const [removingLocation, setRemovingLocation] = useState(false);

  type Baseline = {
    displayName: string;
    city: string;
    state: string;
    coords: { lat: number; lng: number } | null;
  };
  const [baseline, setBaseline] = useState<Baseline>({
    displayName: "",
    city: "",
    state: "",
    coords: null,
  });

  const normalizeState = (s: string) => s.trim().toUpperCase();

  const coordsEqual = (
    a: { lat: number; lng: number } | null,
    b: { lat: number; lng: number } | null
  ) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.lat === b.lat && a.lng === b.lng;
  };

  const isDirty =
    displayName.trim() !== baseline.displayName.trim() ||
    city.trim() !== baseline.city.trim() ||
    normalizeState(state) !== normalizeState(baseline.state) ||
    !coordsEqual(coords, baseline.coords);

  const hasSavedLocation =
    !!city.trim() || !!state.trim() || coords !== null;

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
        const nextCoords =
          lat !== null && lng !== null ? { lat, lng } : null;
        if (nextCoords) {
          setCoords(nextCoords);
        } else {
          setCoords(null);
        }
        setBaseline({
          displayName: data.displayName || "",
          city: data.city || "",
          state: (data.state || "").trim().toUpperCase(),
          coords: nextCoords,
        });
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

      setBaseline({
        displayName: displayName.trim(),
        city: c,
        state: s,
        coords: coords?.lat != null && coords?.lng != null ? { ...coords } : null,
      });

      showAlert("Profile updated!", "Success", true);
    } catch (e) {
      showAlert("Could not save profile.", "Error");
    } finally {
      setSaving(false);
    }
  };

  const leaveScreen = () => {
    router.back();
  };

  const handleCancel = () => {
    if (!isDirty) {
      leaveScreen();
      return;
    }
    setShowDiscardConfirm(true);
  };

  const confirmRemoveLocation = async () => {
    if (!auth.currentUser) return;
    setShowRemoveLocationConfirm(false);
    setRemovingLocation(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        city: deleteField(),
        state: deleteField(),
        locationDisplay: deleteField(),
        lat: deleteField(),
        lng: deleteField(),
        locationUpdatedAt: deleteField(),
        locationPromptSnoozedUntil: deleteField(),
      });
      setCity("");
      setState("");
      setCoords(null);
      setLocationUsed(false);
      setBaseline((prev) => ({
        ...prev,
        city: "",
        state: "",
        coords: null,
      }));
    } catch {
      showAlert("Could not remove location.", "Error");
    } finally {
      setRemovingLocation(false);
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
          <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#888" />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>Edit profile</Text>
          </View>
          <View style={styles.backButtonSpacer} />
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
            disabled={saving || locating || removingLocation}
            activeOpacity={0.85}
            style={[styles.locationRow, (saving || locating || removingLocation) && { opacity: 0.7 }]}
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
        {hasSavedLocation && (
          <TouchableOpacity
            onPress={() => setShowRemoveLocationConfirm(true)}
            disabled={saving || locating || removingLocation}
            style={styles.removeLocationBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.removeLocationText}>Remove location</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || removingLocation}
          style={[styles.saveButton, (saving || removingLocation) && { opacity: 0.7 }]}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="black" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleCancel}
          disabled={saving || removingLocation}
          style={[styles.cancelButton, (saving || removingLocation) && { opacity: 0.45 }]}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
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
        <ConfirmModal
          visible={showDiscardConfirm}
          title="Discard changes?"
          message="You have unsaved changes. Discard them and go back?"
          confirmText="Discard"
          cancelText="Keep editing"
          destructive
          onConfirm={() => {
            setShowDiscardConfirm(false);
            leaveScreen();
          }}
          onCancel={() => setShowDiscardConfirm(false)}
        />
        <ConfirmModal
          visible={showRemoveLocationConfirm}
          title="Remove location?"
          message="This clears your city, state, and saved coordinates from your profile. You can add a location again anytime."
          confirmText="Remove"
          cancelText="Cancel"
          destructive
          onConfirm={confirmRemoveLocation}
          onCancel={() => setShowRemoveLocationConfirm(false)}
        />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  darkFill: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  headerTitleBlock: {
    flex: 1,
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: "white",
    fontSize: 22,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    lineHeight: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1F1F1F",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonSpacer: {
    width: 40,
    height: 40,
  },
  headerDivider: { marginTop: 16, height: 1, backgroundColor: "#222" },

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
  removeLocationBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  removeLocationText: {
    color: MUTED2,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
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
  cancelButton: {
    marginTop: 28,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    color: "#ff453a",
    fontSize: 15,
    fontFamily: fonts.heavy,
  },
});
