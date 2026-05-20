import StackScreenHeader from '@/src/components/StackScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import * as Location from "expo-location";
import { router } from 'expo-router';
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StatusBar,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED,
  MUTED2,
  MUTED3,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  fonts,
} from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import { filterOrReject } from "@/src/lib/contentFilter";
import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";

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
    const nameCheck = filterOrReject(displayName.trim());
    if (!nameCheck.ok) {
      showAlert(nameCheck.reason, "Content not allowed");
      return;
    }
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
        <StatusBar barStyle="light-content" />
        <StackScreenHeader title="Edit profile" onBack={handleCancel} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.groupTitle}>Name</Text>
          <View style={styles.group}>
            <View style={styles.fieldRow}>
              <TextInput
                style={styles.fieldInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Display name"
                placeholderTextColor={MUTED3}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          <Text style={styles.groupTitle}>Location</Text>
          <View style={styles.group}>
            <View style={styles.locationFieldsRow}>
              <TextInput
                style={[styles.fieldInput, styles.cityInput]}
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={MUTED3}
                autoCapitalize="words"
              />
              <View style={styles.colDivider} />
              <TextInput
                style={[styles.fieldInput, styles.stateInput]}
                value={state}
                onChangeText={setState}
                placeholder="ST"
                placeholderTextColor={MUTED3}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {!locationUsed && (
            <View style={styles.group}>
              <TouchableOpacity
                onPress={fillFromCurrentLocation}
                disabled={saving || locating || removingLocation}
                activeOpacity={0.75}
                style={[
                  styles.actionRow,
                  (saving || locating || removingLocation) && styles.disabledControl,
                ]}
              >
                <View style={styles.actionIconWrap}>
                  {locating ? (
                    <ActivityIndicator size="small" color={ACCENT} />
                  ) : (
                    <Ionicons name="location-outline" size={20} color={ACCENT} />
                  )}
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>
                    {locating ? "Using current location…" : "Use current location"}
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    {locating ? "Finding your city and state" : "Auto-fill city and state"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={MUTED2} />
              </TouchableOpacity>
            </View>
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
            style={[
              styles.saveButton,
              (saving || removingLocation) && styles.disabledControl,
            ]}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator size="small" color="black" />
            ) : (
              <Text style={styles.saveButtonText}>Save changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCancel}
            disabled={saving || removingLocation}
            style={[
              styles.cancelButton,
              (saving || removingLocation) && styles.disabledControl,
            ]}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <View style={styles.footerSpace} />
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
  darkFill: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },

  scrollContent: {
    paddingBottom: SPACE_6,
    paddingTop: SPACE_3,
  },

  groupTitle: {
    color: MUTED,
    fontSize: TYPE_CAPTION + 1,
    fontFamily: fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: SPACE_5,
    marginBottom: SPACE_3 - 2,
    marginTop: SPACE_3,
  },
  group: {
    backgroundColor: SURFACE,
    marginHorizontal: SPACE_4 + SPACE_3,
    borderRadius: RADIUS_MD,
    overflow: "hidden",
    marginBottom: SPACE_3,
    borderWidth: 1,
    borderColor: BORDER,
  },

  fieldRow: {
    paddingHorizontal: SPACE_4 + 2,
    paddingVertical: 10,
    justifyContent: "center",
  },
  locationFieldsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: SPACE_4 + 2,
    paddingVertical: 10,
    minHeight: 44,
  },
  colDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.16)",
    marginHorizontal: SPACE_3 - 2,
    marginVertical: 6,
  },
  fieldInput: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    paddingVertical: Platform.OS === "ios" ? 6 : 4,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  cityInput: {
    flex: 1,
    minWidth: 0,
    alignSelf: "center",
  },
  stateInput: {
    width: 56,
    alignSelf: "center",
    textAlign: "center",
    letterSpacing: 1.2,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE_4,
    paddingHorizontal: SPACE_4 + 2,
    gap: SPACE_3 + 2,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,255,133,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,255,133,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    lineHeight: 22,
  },
  actionSubtitle: {
    marginTop: 2,
    color: MUTED,
    fontSize: TYPE_CAPTION + 1,
    fontFamily: fonts.book,
    lineHeight: 18,
  },

  removeLocationBtn: {
    alignSelf: "flex-start",
    marginTop: SPACE_3 - 4,
    marginLeft: SPACE_5,
    marginBottom: SPACE_3,
    paddingVertical: SPACE_3 - 4,
  },
  removeLocationText: {
    color: MUTED2,
    fontSize: TYPE_CAPTION + 2,
    fontFamily: fonts.medium,
  },

  saveButton: {
    marginTop: SPACE_5 + 8,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "black",
    fontSize: TYPE_BODY + 2,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  cancelButton: {
    marginTop: SPACE_4,
    alignSelf: "center",
    paddingVertical: SPACE_3,
    paddingHorizontal: SPACE_4,
  },
  cancelButtonText: {
    color: MUTED2,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
  },

  disabledControl: { opacity: 0.5 },
  footerSpace: { height: SPACE_5 },
});
