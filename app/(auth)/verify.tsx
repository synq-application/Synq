import { router, useLocalSearchParams } from "expo-router";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
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
  onboardingAuthInnerMarginTop,
  ONBOARDING_DIVIDER_MARGIN_TOP,
  ONBOARDING_DIVIDER_WIDTH,
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
  ONBOARDING_SUBTITLE_MARGIN_TOP,
  ONBOARDING_SUBTITLE_SIZE,
  ONBOARDING_TITLE_LINE_HEIGHT,
  ONBOARDING_TITLE_SIZE,
} from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  fonts,
  MUTED,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  TEXT,
} from "@/constants/Variables";
import AlertModal from "../alert-modal";
import { auth } from "../../src/lib/firebase";

export default function Verify() {
  const { verificationId, phone } = useLocalSearchParams<{ verificationId?: string; phone?: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const canVerify = useMemo(
    () => verificationId && code.replace(/\D/g, "").length >= 6 && !loading,
    [verificationId, code, loading]
  );

  const verify = async () => {
    if (!verificationId) return;

    try {
      setLoading(true);
      const credential = PhoneAuthProvider.credential(verificationId, code);
      await signInWithCredential(auth, credential);

      router.replace("/(tabs)");
    } catch (err: any) {
      if (__DEV__) {
        console.error("verify error", err);
      }
      setAlertMessage(err?.message ?? "Please try again.");
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: onboardingAuthInnerMarginTop(),
              paddingHorizontal: ONBOARDING_H_PADDING,
              paddingBottom: ONBOARDING_SCROLL_BOTTOM,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <View style={styles.inner}>
            <Text style={styles.title}>Enter code</Text>
            <View style={styles.divider} />
            <Text style={styles.subtitle}>Sent to {phone ?? "your phone"}.</Text>

            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="number-pad"
              style={styles.input}
              maxLength={6}
            />

            <TouchableOpacity
              disabled={!canVerify}
              onPress={verify}
              activeOpacity={0.85}
              style={[styles.primaryButton, !canVerify && styles.primaryButtonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#061006" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={styles.backLink} activeOpacity={0.7}>
              <Text style={styles.back}>Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <AlertModal
          visible={alertVisible}
          title="Invalid code"
          message={alertMessage}
          onClose={() => setAlertVisible(false)}
        />
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: {
    flexGrow: 1,
  },
  inner: { width: "100%" },
  title: {
    fontSize: ONBOARDING_TITLE_SIZE,
    lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
    fontFamily: fonts.heavy,
    color: TEXT,
    letterSpacing: 0.2,
  },
  divider: {
    marginTop: ONBOARDING_DIVIDER_MARGIN_TOP,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  subtitle: {
    marginTop: ONBOARDING_SUBTITLE_MARGIN_TOP,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    color: MUTED,
    fontFamily: fonts.book,
    lineHeight: 22,
  },
  input: {
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    height: 56,
    borderRadius: BUTTON_RADIUS,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: 18,
    letterSpacing: 4,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  primaryButton: {
    marginTop: 22,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: "rgba(125, 255, 166, 0.30)" },
  primaryButtonText: {
    color: "#061006",
    fontSize: 18,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  backLink: { marginTop: 18, alignSelf: "flex-start" },
  back: { color: MUTED, fontSize: 15, fontFamily: fonts.book },
});
