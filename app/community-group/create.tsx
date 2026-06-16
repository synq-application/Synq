import AlertModal from "@/app/alert-modal";
import {
  ACCENT,
  BG,
  fonts,
  MUTED3,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import StackScreenHeader from "@/src/components/StackScreenHeader";
import { auth } from "@/src/lib/firebase";
import {
  COMMUNITY_GROUP_CATEGORIES,
  type CommunityGroupCategory,
} from "@/src/lib/communityGroupCategories";
import {
  createCommunityGroup,
} from "@/src/lib/communityGroups";
import { filterOrReject } from "@/src/lib/contentFilter";
import { launchProfilePhotoPicker } from "@/src/lib/profilePhotoPicker";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export default function CreateCommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = auth.currentUser?.uid ?? "";

  const [name, setName] = useState("");
  const [category, setCategory] = useState<CommunityGroupCategory | "">("");
  const [location, setLocation] = useState("");
  const [about, setAbout] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0 && category.length > 0 && !busy;

  const showError = useCallback((message: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const pickCoverPhoto = async () => {
    if (busy) return;
    const result = await launchProfilePhotoPicker();
    if (result.ok) {
      setCoverUri(result.uri);
    }
  };

  const handleCreate = async () => {
    if (!uid || !canCreate) return;

    const nameCheck = filterOrReject(trimmedName);
    if (!nameCheck.ok) {
      showError(nameCheck.reason);
      return;
    }
    const aboutTrimmed = about.trim();
    if (aboutTrimmed) {
      const aboutCheck = filterOrReject(aboutTrimmed);
      if (!aboutCheck.ok) {
        showError(aboutCheck.reason);
        return;
      }
    }

    Keyboard.dismiss();
    setBusy(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const id = await createCommunityGroup(
        uid,
        {
          name: trimmedName,
          category,
          location: location.trim() || undefined,
          about: aboutTrimmed || undefined,
        },
        coverUri ?? undefined
      );

      router.replace({ pathname: "/community-group/[id]", params: { id } });
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Could not create community.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <StackScreenHeader
        title=""
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            onPress={() => void handleCreate()}
            disabled={!canCreate}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Create community"
            accessibilityState={{ disabled: !canCreate }}
          >
            {busy ? (
              <ActivityIndicator color={ACCENT} size="small" />
            ) : (
              <Text style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}>
                Create
              </Text>
            )}
          </TouchableOpacity>
        }
      />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={32}
        extraKeyboardSpace={insets.bottom + 24}
      >
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Create Community</Text>
          </View>

          <View style={styles.form}>
            <FieldLabel>Community name</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="e.g. DC Volo Kickball"
              placeholderTextColor={MUTED3}
              value={name}
              onChangeText={setName}
              maxLength={40}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <FieldLabel>Category</FieldLabel>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => setCategoryVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Choose category"
            >
              <Text style={[styles.selectText, !category && styles.selectPlaceholder]}>
                {category || "Choose a category"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={MUTED3} />
            </TouchableOpacity>

            <FieldLabel>Location (optional)</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="City or neighborhood"
              placeholderTextColor={MUTED3}
              value={location}
              onChangeText={setLocation}
              maxLength={80}
              autoCapitalize="words"
            />

            <FieldLabel>About your community</FieldLabel>
            <TextInput
              style={[styles.input, styles.aboutInput]}
              placeholder="What is this group about? Who should join?"
              placeholderTextColor={MUTED3}
              value={about}
              onChangeText={setAbout}
              maxLength={500}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.coverSection}>
            <Text style={styles.coverFieldLabel}>Cover photo (optional)</Text>
            <TouchableOpacity
            style={[styles.coverBox, coverUri && styles.coverBoxFilled]}
            onPress={() => void pickCoverPhoto()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={coverUri ? "Change cover photo" : "Add photo"}
          >
            {coverUri ? (
              <>
                <ExpoImage source={{ uri: coverUri }} style={styles.coverImage} contentFit="cover" />
                <View style={styles.coverOverlay}>
                  <Ionicons name="camera-outline" size={22} color="#fff" />
                  <Text style={styles.coverOverlayText}>Change photo</Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="image-outline" size={28} color={MUTED3} />
                <Text style={styles.coverLabel}>Add photo</Text>
              </>
            )}
          </TouchableOpacity>
          </View>
      </KeyboardAwareScrollView>

      <Modal
        visible={categoryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCategoryVisible(false)}>
          <Pressable style={styles.categorySheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.categorySheetTitle}>Category</Text>
            {COMMUNITY_GROUP_CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.categoryRow}
                onPress={() => {
                  setCategory(item);
                  setCategoryVisible(false);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: category === item }}
              >
                <Text
                  style={[styles.categoryRowText, category === item && styles.categoryRowTextActive]}
                >
                  {item}
                </Text>
                {category === item ? (
                  <Ionicons name="checkmark" size={18} color={ACCENT} />
                ) : null}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <AlertModal
        visible={alertVisible}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const FIELD_SURFACE = "#0E1012";
const FIELD_BORDER = "rgba(255,255,255,0.18)";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: SPACE_6 + 24,
  },
  createBtn: {
    fontFamily: fonts.heavy,
    fontSize: 16,
    color: ACCENT,
    letterSpacing: 0.06,
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  hero: {
    paddingTop: SPACE_3,
    paddingBottom: SPACE_5,
    gap: 6,
  },
  heroTitle: {
    fontFamily: fonts.heavy,
    fontSize: 22,
    color: TEXT,
    letterSpacing: 0.1,
  },
  form: {
    gap: SPACE_3,
    marginBottom: SPACE_4,
  },
  fieldLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
    letterSpacing: 0.04,
    marginBottom: -4,
  },
  coverSection: {
    gap: 12,
  },
  coverFieldLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
    letterSpacing: 0.04,
    marginBottom: 2,
  },
  input: {
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    backgroundColor: FIELD_SURFACE,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
  },
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    backgroundColor: FIELD_SURFACE,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  selectText: {
    fontFamily: fonts.book,
    fontSize: 16,
    color: TEXT,
  },
  selectPlaceholder: {
    color: MUTED3,
  },
  aboutInput: {
    minHeight: 120,
    paddingTop: 14,
  },
  coverBox: {
    minHeight: 160,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: FIELD_BORDER,
    backgroundColor: FIELD_SURFACE,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  coverBoxFilled: {
    borderStyle: "solid",
    padding: 0,
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  coverOverlayText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION + 1,
    color: "#fff",
  },
  coverLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  categorySheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  categorySheetTitle: {
    fontFamily: fonts.heavy,
    fontSize: 18,
    color: TEXT,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  categoryRowText: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
  },
  categoryRowTextActive: {
    fontFamily: fonts.medium,
    color: ACCENT,
  },
});
