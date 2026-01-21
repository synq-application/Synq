import { ACCENT, BG, fonts, MUTED, synqSvg, TEXT } from "@/constants/Variables";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { auth } from "../../src/lib/firebase";

const { height } = Dimensions.get("window");

export default function EmailSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canContinue = email.trim().length > 3 && password.length >= 6 && !loading;

  const signUp = async () => {
    try {
      setLoading(true);
      const cleanedEmail = email.trim().toLowerCase();
      await createUserWithEmailAndPassword(auth, cleanedEmail, password);
    } catch (e: any) {
      console.log("email signup error", e?.code, e?.message);
      Alert.alert(
        "Couldn’t sign up",
        e?.message ?? "Please check your email and password and try again."
      );
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.root}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
          <Text style={styles.closeText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.container}>
          <View style={styles.inner}>
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
        </View>
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
  closeBtn: { position: "absolute", top: 60, left: 22, zIndex: 10 },
  closeText: { fontSize: 16, color: ACCENT, fontFamily: fonts.book },
  container: { flex: 1, paddingHorizontal: 22 },
  inner: { width: "100%", marginTop: height * 0.20 },
  title: {
    color: TEXT,
    fontSize: 34,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: "78%",
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
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: ACCENT,
    height: 56,
    borderRadius: 18,
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
