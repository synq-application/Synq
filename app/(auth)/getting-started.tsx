import { ACCENT, BG, fonts, MUTED, synqSvg, TEXT } from "@/constants/Variables";
import { router } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";

export default function GetStartedScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>

        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>

        <View style={styles.topCopy}>
          <Text style={styles.title}>You’re ready.</Text>
          <View style={styles.divider} />
          <Text style={styles.sub}>
            Turn Synq on when you’re free and{"\n"}see who’s down to meet up.
          </Text>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.primaryBtn}
            onPress={() => router.push("/(auth)/phone")}
          >
            <Text style={styles.primaryText}>Get Started</Text>
          </TouchableOpacity>

          <View style={styles.signInRow}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/login")}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.signInLink}>Sign in here</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG },

  bgSvgWrap: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    opacity: 0.35,
    transform: [{ rotate: "-8deg" }],
  },
  topCopy: {
    paddingTop: 86,
    paddingHorizontal: 22,
  },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: 34,
    letterSpacing: 0.2,
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: "78%",
  },
  sub: {
    marginTop: 16,
    color: MUTED,
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 36,
    alignItems: "center",
    paddingHorizontal: 22,
  },

  primaryBtn: {
    width: "88%",
    height: 56,
    borderRadius: 18,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryText: {
    color: "#061006",
    fontFamily: fonts.heavy,
    fontSize: 18,
    letterSpacing: 0.2,
  },

  signInRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  signInText: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fonts.book,
    fontSize: 14,
  },
  signInLink: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 14,
  },
});
