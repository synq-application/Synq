import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { router } from "expo-router";
import { signInWithPhoneNumber } from "firebase/auth";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { app, auth, firebaseConfig } from "../../src/lib/firebase";

const ACCENT = "#7DFFA6";

export default function Phone() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");

  const [confirm, setConfirm] = useState<any>(null);
  const [isCodeSent, setIsCodeSent] = useState(false);

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<(TextInput | null)[]>([]);
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const [loading, setLoading] = useState(false);

  const handlePhoneNumberChange = (text: string) => {
    const formattedText = text.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(formattedText);
  };

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, "").slice(0, 1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && index > 0 && !code[index]) {
      inputs.current[index - 1]?.focus();
    }
  };

  const sendVerificationCode = async () => {
    if (!recaptchaVerifier.current) {
      Alert.alert("Error", "ReCAPTCHA not initialized");
      return;
    }

    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length !== 10) {
      Alert.alert("Invalid phone", "Please enter a 10-digit phone number.");
      return;
    }

    const cc = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
    const formattedPhoneNumber = `${cc}${digits}`;

    try {
      setLoading(true);

      // Optional; safe if undefined
      // @ts-ignore
      auth.useDeviceLanguage?.();

      const confirmation = await signInWithPhoneNumber(
        auth,
        formattedPhoneNumber,
        // @ts-expect-error expo-firebase-recaptcha provides a compatible verifier
        recaptchaVerifier.current
      );

      setConfirm(confirmation);
      setIsCodeSent(true);
      setCode(["", "", "", "", "", ""]);

      setTimeout(() => inputs.current[0]?.focus(), 250);
    } catch (error: any) {
      console.log("Error sending code:", error?.code, error?.message, error);
      Alert.alert(
        "Couldn’t send code",
        error?.message ?? "Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    try {
      const fullCode = code.join("");
      if (fullCode.length !== 6) {
        Alert.alert("Invalid code", "Please enter the 6-digit code.");
        return;
      }

      if (!confirm) {
        Alert.alert("Error", "Please resend the verification code.");
        return;
      }

      setLoading(true);

      const userCredential = await confirm.confirm(fullCode);
      const user = userCredential.user;

      console.log("Signed in user:", user?.uid);

      // 👉 Go to onboarding
      //router.replace("/profile");
    } catch (error: any) {
      console.error("Verification failed:", error?.code, error?.message, error);
      Alert.alert("Error", error?.message ?? "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone =
    phoneNumber.length === 10
      ? `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
      : "your number";

  const recaptchaConfig = (app as any)?.options ?? firebaseConfig;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.root}>
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={recaptchaConfig}
          attemptInvisibleVerification
        />

        {/* Close */}
        <TouchableOpacity
          onPress={() => router.replace("/(auth)/welcome")}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>

        <View style={styles.container}>
          {!isCodeSent ? (
            <>
              <Text style={styles.title}>What’s your phone number?</Text>

              <View style={styles.row}>
                <TextInput
                  value={countryCode}
                  editable
                  onChangeText={setCountryCode}
                  style={styles.countryInput}
                  keyboardType="phone-pad"
                />

                <TextInput
                  value={phoneNumber}
                  onChangeText={handlePhoneNumberChange}
                  style={styles.phoneInput}
                  keyboardType="phone-pad"
                  placeholder="5555550100"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                />
              </View>

              <Text style={styles.helper}>
                Synq will send you a text with a verification code. Message and
                data rates may apply.
              </Text>

              <TouchableOpacity
                onPress={sendVerificationCode}
                style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Code</Text>
                )}
              </TouchableOpacity>

              {/* 👇 EMAIL FALLBACK */}
              <TouchableOpacity
                onPress={() => router.push("/(auth)/email")}
                style={{ marginTop: 16 }}
              >
                <Text style={styles.emailLink}>
                  Sign up with email instead
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.titleCenter}>Enter code</Text>
              <Text style={styles.subtitleCenter}>Sent to {maskedPhone}</Text>

              <View style={styles.otpRow}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(el) => (inputs.current[index] = el)}
                    value={digit}
                    onChangeText={(text) => handleChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    style={styles.otpBox}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={() => {
                  setIsCodeSent(false);
                  setConfirm(null);
                  setCode(["", "", "", "", "", ""]);
                }}
                style={{ marginTop: 18 }}
                disabled={loading}
              >
                <Text style={styles.linkText}>
                  Didn’t receive a code? Try again.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={verifyCode}
                style={[
                  styles.primaryButton,
                  { alignSelf: "center" },
                  loading && { opacity: 0.6 },
                ]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.primaryButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },

  close: { position: "absolute", top: 60, right: 20, zIndex: 10 },
  closeText: { fontSize: 28, color: "white" },

  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },

  title: { color: "white", fontSize: 30, fontWeight: "700", width: 320 },
  titleCenter: { color: "white", fontSize: 26, fontWeight: "700", textAlign: "center" },
  subtitleCenter: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },

  row: { flexDirection: "row", alignItems: "center", marginTop: 24 },

  countryInput: {
    color: "white",
    backgroundColor: "rgba(255,255,255,0.08)",
    width: 70,
    height: 48,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 18,
    marginRight: 10,
  },

  phoneInput: {
    flex: 1,
    color: "white",
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 18,
    borderWidth: 2,
    borderColor: ACCENT,
  },

  helper: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 14,
    width: "90%",
  },

  emailLink: {
    color: ACCENT,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "700",
  },

  primaryButton: {
    marginTop: 24,
    backgroundColor: ACCENT,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: { color: "black", fontSize: 16, fontWeight: "700" },

  otpRow: { flexDirection: "row", justifyContent: "center", marginTop: 26 },
  otpBox: {
    width: 48,
    height: 60,
    borderWidth: 2,
    borderColor: ACCENT,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 24,
    marginHorizontal: 5,
    color: "white",
  },

  linkText: { color: "rgba(255,255,255,0.8)", textAlign: "center" },
});
