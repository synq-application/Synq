import { getStackAvatarUris, resolveAvatar } from "@/app/helpers";
import { ACCENT } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

type FriendLike = { id: string; imageurl?: string };

type Props = {
  memberIds: string[];
  friends: FriendLike[];
};

export default function GroupListAvatar({ memberIds, friends }: Props) {
  const stackUris = useMemo(() => {
    if (memberIds.length === 0) return [];

    const byId = new Map(friends.map((f) => [f.id, f]));
    const images: Record<string, string> = {};
    for (const id of memberIds) {
      const friend = byId.get(id);
      images[id] = resolveAvatar(friend?.imageurl);
    }
    return getStackAvatarUris(images);
  }, [memberIds, friends]);

  if (memberIds.length === 0) {
    return (
      <View style={styles.iconRing}>
        <Ionicons name="people-outline" size={20} color={ACCENT} />
      </View>
    );
  }

  if (stackUris.length === 1) {
    return (
      <View style={styles.singleWrap}>
        <ExpoImage
          source={{ uri: stackUris[0] }}
          style={styles.singlePhoto}
          cachePolicy="memory-disk"
          transition={0}
        />
      </View>
    );
  }

  return (
    <View style={styles.stackWrap}>
      <ExpoImage
        source={{ uri: stackUris[0] }}
        style={[styles.stackPhoto, styles.stackPhotoBack]}
        cachePolicy="memory-disk"
        transition={0}
      />
      <ExpoImage
        source={{ uri: stackUris[1] }}
        style={[styles.stackPhoto, styles.stackPhotoFront]}
        cachePolicy="memory-disk"
        transition={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  singleWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  singlePhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#1C1C1E",
  },
  stackWrap: {
    width: 44,
    height: 42,
    position: "relative",
  },
  stackPhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
    position: "absolute",
    borderWidth: 2,
    borderColor: "#0A0A0A",
    backgroundColor: "#1C1C1E",
  },
  stackPhotoBack: {
    left: 0,
    top: 4,
    zIndex: 1,
  },
  stackPhotoFront: {
    left: 12,
    top: 10,
    zIndex: 2,
  },
});
