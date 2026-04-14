import {
  onboardingAuthInnerMarginTop,
  ONBOARDING_BACK_LEFT,
  ONBOARDING_BACK_TOP,
  ONBOARDING_DIVIDER_MARGIN_TOP,
  ONBOARDING_DIVIDER_WIDTH,
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
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
  synqSvg,
  TEXT,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import { SvgXml } from "react-native-svg";
import AlertModal from "../alert-modal";
import { auth } from "../../src/lib/firebase";

export default function EmailSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const canContinue = email.trim().length > 3 && password.length >= 6 && !loading;

  const signUp = async () => {
    try {
      setLoading(true);
      const cleanedEmail = email.trim().toLowerCase();
      await createUserWithEmailAndPassword(auth, cleanedEmail, password);
    } catch (e: any) {
      if (__DEV__) {
        console.error("email signup error", e?.code, e?.message);
      }
      showAlert(
        e?.message ?? "Please check your email and password and try again.",
        "Couldn’t sign up"
      );
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.root}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={ACCENT} />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.inner, { marginTop: onboardingAuthInnerMarginTop() }]}>
            <Text style={styles.title}>Sign up with email</Text>
            <View style={styles.divider} />
            <View style={{ marginTop: 18 }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
              />

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password (6+ characters)"
                placeholderTextColor="rgba(255,255,255,0.25)"
                secureTextEntry
                textContentType="newPassword"
                style={[styles.input, { marginTop: 12 }]}
              />
            </View>

            <TouchableOpacity
              disabled={!canContinue}
              onPress={signUp}
              activeOpacity={0.85}
              style={[styles.primaryButton, !canContinue && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color="#061006" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.small}>
              By continuing, you agree to receive account-related emails from Synq.
            </Text>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <AlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          onClose={() => setAlertVisible(false)}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  bgSvgWrap: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    opacity: 0.35,
    transform: [{ rotate: "-8deg" }],
  },
  backBtn: {
    position: "absolute",
    top: ONBOARDING_BACK_TOP,
    left: ONBOARDING_BACK_LEFT,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  container: { flex: 1, paddingHorizontal: ONBOARDING_H_PADDING },
  scrollContent: { flexGrow: 1, paddingBottom: ONBOARDING_SCROLL_BOTTOM },
  inner: { width: "100%" },
  title: {
    color: TEXT,
    fontSize: ONBOARDING_TITLE_SIZE,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
  },
  divider: {
    marginTop: ONBOARDING_DIVIDER_MARGIN_TOP,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  subtitle: {
    color: MUTED,
    fontSize: 15,
    marginTop: 14,
    fontFamily: fonts.book,
    lineHeight: 22,
  },
  input: {
    color: TEXT,
    backgroundColor: "rgba(255,255,255,0.06)",
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  primaryButton: {
    marginTop: 20,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#061006",
    fontSize: 18,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  disabledButton: { backgroundColor: "rgba(125,255,166,0.30)" },
  small: {
    marginTop: 18,
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    fontFamily: fonts.book,
  },
});
