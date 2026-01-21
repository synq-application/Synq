import { ACCENT, BG, fonts, MUTED, synqSvg, TEXT } from "@/constants/Variables";
import { router } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { SvgXml } from "react-native-svg";
import { auth } from "../../src/lib/firebase";

const { height } = Dimensions.get("window");

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Hold on", "Please enter both your email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
    } catch (error: any) {
      let errorMessage = "Incorrect email or password. Please try again.";
      if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Try resetting your password.";
      }
      Alert.alert("Login Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async () => {
    if (!resetEmail) return;
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      setResetModalVisible(false);
      Alert.alert(
        "Check your inbox",
        "If an account exists for this email, a reset link has been sent."
      );
    } catch (e) {
      Alert.alert("Error", "Could not send reset email.");
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.root}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.container}>
          <View style={styles.inner}>
            <Text style={styles.title}>Welcome back!</Text>
            <View style={styles.divider} />
            <Text style={styles.subtitle}>Sign in to your account</Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  onPress={() => {
                    setResetEmail(email);
                    setResetModalVisible(true);
                  }}
                  style={styles.forgotBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (loading || !email || !password) && styles.disabledButton,
              ]}
              onPress={handleLogin}
              disabled={loading || !email || !password}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#061006" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={resetModalVisible} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Reset password</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your email and we’ll send you a link to get back into your account.
                </Text>

                <TextInput
                  style={styles.modalInput}
                  placeholder="Email address"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 14 }]}
                  onPress={handleSendReset}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Send Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setResetModalVisible(false)}
                  style={styles.cancelBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
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
  backBtn: { position: "absolute", top: 60, left: 22, zIndex: 10 },
  backText: { fontSize: 16, color: ACCENT, fontFamily: fonts.book },
  container: { flex: 1, paddingHorizontal: 22 },
  inner: { width: "100%", marginTop: height * 0.20 },
  title: {
    color: TEXT,
    fontSize: 36,
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
    marginBottom: 26,
    fontFamily: fonts.book,
  },
  inputGroup: { gap: 12 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    height: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: 16,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  forgotBtn: { alignSelf: "flex-end", marginTop: 10, paddingVertical: 4 },
  forgotText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontFamily: fonts.book,
  },
  primaryButton: {
    backgroundColor: ACCENT,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },
  primaryButtonText: {
    color: "#061006",
    fontSize: 18,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  disabledButton: { backgroundColor: "rgba(125,255,166,0.30)" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    padding: 22,
  },
  modalContent: {
    backgroundColor: "rgba(18,18,18,0.96)",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    color: TEXT,
    fontSize: 22,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  modalSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontFamily: fonts.book,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    height: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: 16,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cancelBtn: { marginTop: 14, alignItems: "center" },
  cancelText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontFamily: fonts.book,
  },
});
