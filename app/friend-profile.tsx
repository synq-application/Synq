import {
  ACCENT,
  BG,
  BORDER,
  fonts,
  MUTED2,
  SURFACE,
  TEXT,
} from "@/constants/Variables";
import { db } from "@/src/lib/firebase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

export default function FriendProfile() {
  const { friendId } = useLocalSearchParams();
  const router = useRouter();

  const [friend, setFriend] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFriend = async () => {
      try {
        const snap = await getDoc(doc(db, "users", friendId as string));
        if (snap.exists()) {
          setFriend(snap.data());
        }
      } catch (e) {
        console.error("[FriendProfile]", e);
      } finally {
        setLoading(false);
      }
    };

    fetchFriend();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!friend) return null;

  const city = friend.city?.trim();
  const state = friend.state?.trim();
  const locationText =
    friend.location || [city, state].filter(Boolean).join(", ");

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Icon name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Image
            source={{
              uri:
                friend.imageurl ||
                "https://www.gravatar.com/avatar/?d=mp",
            }}
            style={styles.avatar}
          />

          <Text style={styles.name}>
            {friend.displayName || "User"}
          </Text>

          {locationText ? (
            <View style={styles.locationRow}>
              <Icon name="location-outline" size={14} color={MUTED2} />
              <Text style={styles.locationText}>{locationText}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INTERESTS</Text>
          <View style={styles.interestsWrapper}>
            {friend.interests?.length ? (
              friend.interests.map((interest: string, i: number) => (
                <View key={i} style={styles.pill}>
                  <Text style={styles.pillText}>{interest}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No interests listed
              </Text>
            )}
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    marginTop: 6,
    marginBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginTop: 10,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: ACCENT,
    marginBottom: 16,
  },
  name: {
    color: TEXT,
    fontSize: 26,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  locationText: {
    color: MUTED2,
    fontSize: 14,
    marginLeft: 4,
    fontFamily: fonts.book,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginTop: 24,
    marginBottom: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: MUTED2,
    fontSize: 11,
    fontFamily: fonts.heavy,
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  interestsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pill: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  pillText: {
    color: TEXT,
    fontSize: 13,
    fontFamily: fonts.book,
  },
  emptyText: {
    color: MUTED2,
    fontStyle: "italic",
    fontFamily: fonts.book,
  },
});