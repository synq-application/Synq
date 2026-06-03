import CloseIcon from "@/src/components/CloseIcon";
import StackScreenHeader from "@/src/components/StackScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ACCENT,
  BG,
  BORDER,
  DEFAULT_AVATAR,
  fonts,
  MUTED,
  MUTED2,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_SECTION,
} from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";

import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";
import { prefetchResolvedAvatar, resolveAvatar } from "./helpers";

function prefetchActorAvatars(items: FeedItem[]) {
  items.forEach((item) => {
    if (item.actorImageUrl) prefetchResolvedAvatar(item.actorImageUrl);
  });
}

const SURFACE = "rgba(255,255,255,0.06)";
const BACKGROUND = BG;

type ActivityType =
  | "friend_accepted"
  | "open_plan_interest"
  | "friend_synq_active"
  | "synq_nudge";

type FeedItem =
  | {
      feedKey: string;
      kind: "friend_request";
      id: string;
      fromUserId: string;
      actorName: string;
      actorImageUrl: string | null;
      sortMs: number;
      raw: Record<string, unknown>;
    }
  | {
      feedKey: string;
      kind: ActivityType;
      id: string;
      source: "notifications" | "legacy";
      fromUserId: string | null;
      actorName: string;
      actorImageUrl: string | null;
      title: string;
      body: string;
      sortMs: number;
      read: boolean;
      eventId?: string | null;
      planHostUid?: string | null;
      raw: Record<string, unknown>;
    };

function timestampMillis(v: unknown): number {
  if (!v) return 0;
  const t = v as { toMillis?: () => number; seconds?: number };
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return 0;
}

function firstName(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || "Someone";
}

/** Cloud Functions mirror many notifications in both collections (same doc id). */
function activityDeleteRefs(userId: string, notificationId: string) {
  return [
    doc(db, "users", userId, "notifications", notificationId),
    doc(db, "users", userId, "notificationLocks", notificationId),
  ];
}

function NotificationsEmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconRing}>
        <Ionicons name="notifications-off-outline" size={34} color={MUTED2} />
      </View>
      <Text style={styles.emptyHeadline}>No notifications</Text>
      <Text style={styles.emptyHelper}>
        Friend requests and activity from your friends will appear here.
      </Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [legacyActivityItems, setLegacyActivityItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissingKeys, setDismissingKeys] = useState<Set<string>>(() => new Set());
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ title, message });
    setAlertVisible(true);
  };

  const resolveActor = async (
    fromUserId: string | null | undefined,
    fallbackName?: string,
    fallbackImage?: string | null
  ) => {
    let actorName = fallbackName || "Someone";
    let actorImageUrl = fallbackImage || null;

    if (!fromUserId) {
      return { actorName, actorImageUrl };
    }

    try {
      const senderSnap = await getDoc(doc(db, "users", fromUserId));
      if (senderSnap.exists()) {
        const senderData = senderSnap.data() as Record<string, unknown>;
        actorName = (senderData?.displayName as string) || actorName;
        actorImageUrl = (senderData?.imageurl as string) || actorImageUrl;
      }
    } catch {}

    return { actorName, actorImageUrl };
  };

  const resolveFriendRequest = async (request: Record<string, unknown> & { id: string }) => {
    const fromUserId = String(request.from || request.fromId || request.id || "");
    const inlineName =
      (request.senderName as string) ||
      (request.fromName as string) ||
      undefined;
    const inlineImage =
      (request.senderImageUrl as string) ||
      (request.fromImageUrl as string) ||
      (request.fromImageurl as string) ||
      (request.imageurl as string) ||
      null;

    const { actorName, actorImageUrl } = await resolveActor(
      fromUserId,
      inlineName,
      inlineImage
    );

    return {
      ...request,
      fromUserId,
      actorName,
      actorImageUrl,
      sortMs: timestampMillis(request.sentAt) || Date.now(),
    };
  };

  const resolveActivity = async (item: Record<string, unknown> & { id: string }) => {
    const fromUserId = item.fromUserId ? String(item.fromUserId) : null;
    const { actorName, actorImageUrl } = await resolveActor(fromUserId);
    const type = String(item.type || "") as ActivityType;
    const planTitle = String(item.planTitle || "").trim();
    const title = String(item.title || "").trim();
    const storedBody = String(item.body || "").trim();

    let body = storedBody;
    if (!body) {
      if (type === "friend_accepted") {
        body = `${actorName} accepted your friend request.`;
      } else if (type === "open_plan_interest") {
        body = planTitle
          ? `${firstName(actorName)} is interested in your plan ${planTitle}`
          : `${firstName(actorName)} is interested in your plan`;
      } else if (type === "friend_synq_active") {
        body = `${firstName(actorName)} just activated Synq.`;
      } else if (type === "synq_nudge") {
        body = `${firstName(actorName)} wants to know if you're free right now`;
      }
    }

    return {
      ...item,
      type,
      fromUserId,
      actorName,
      actorImageUrl,
      title:
        title ||
        (type === "friend_accepted"
          ? "Request accepted"
          : type === "open_plan_interest"
            ? "Open plan"
            : type === "synq_nudge"
              ? "Are you free?"
              : "Friend active on Synq"),
      body,
      sortMs: timestampMillis(item.createdAt) || Date.now(),
      read: item.read === true,
      eventId: item.eventId ? String(item.eventId) : null,
      planHostUid: item.planHostUid ? String(item.planHostUid) : null,
    };
  };

  const fetchAll = async () => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;

    const [reqSnap, activitySnap, legacySnap] = await Promise.all([
      getDocs(collection(db, "users", myId, "friendRequests")),
      getDocs(
        query(
          collection(db, "users", myId, "notifications"),
          orderBy("createdAt", "desc")
        )
      ),
      getDocs(collection(db, "users", myId, "notificationLocks")),
    ]);

    const reqList = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const activityList = activitySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const legacyList = legacySnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((row) =>
        ["friend_accepted", "open_plan_interest"].includes(String(row.type || ""))
      );

    const [resolvedReqs, resolvedActivity, resolvedLegacy] = await Promise.all([
      Promise.all(reqList.map(resolveFriendRequest)),
      Promise.all(activityList.map(resolveActivity)),
      Promise.all(
        legacyList.map((row) =>
          resolveActivity({
            id: row.id,
            type: row.type,
            fromUserId: row.from || row.joinerId || null,
            planTitle: row.planTitle || null,
            createdAt: row.createdAt,
            read: true,
          })
        )
      ),
    ]);

    setFriendRequests(resolvedReqs);
    setActivityItems(resolvedActivity);
    setLegacyActivityItems(resolvedLegacy);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;

    const reqRef = collection(db, "users", myId, "friendRequests");
    const activityRef = query(
      collection(db, "users", myId, "notifications"),
      orderBy("createdAt", "desc")
    );
    const legacyRef = collection(db, "users", myId, "notificationLocks");

    let reqReady = false;
    let activityReady = false;
    let legacyReady = false;

    const maybeDoneLoading = () => {
      if (reqReady && activityReady && legacyReady) setLoading(false);
    };

    const unsubReq = onSnapshot(
      reqRef,
      async (snapshot) => {
        const reqList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const resolved = await Promise.all(reqList.map(resolveFriendRequest));
        setFriendRequests(resolved);
        setLoadError(false);
        reqReady = true;
        maybeDoneLoading();
      },
      (error) => {
        console.error("friendRequests snapshot:", error);
        setLoadError(true);
        reqReady = true;
        maybeDoneLoading();
      }
    );

    const unsubActivity = onSnapshot(
      activityRef,
      async (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const resolved = await Promise.all(list.map(resolveActivity));
        prefetchActorAvatars(
          resolved.map((r) => ({
            feedKey: r.id,
            kind: r.type,
            id: r.id,
            fromUserId: r.fromUserId,
            actorName: r.actorName,
            actorImageUrl: r.actorImageUrl,
            title: r.title,
            body: r.body,
            sortMs: r.sortMs,
            read: r.read,
            eventId: r.eventId,
            raw: r,
          }))
        );
        setActivityItems(resolved);
        setLoadError(false);
        activityReady = true;
        maybeDoneLoading();
      },
      (error) => {
        console.error("notifications snapshot:", error);
        setLoadError(true);
        activityReady = true;
        maybeDoneLoading();
      }
    );

    const unsubLegacy = onSnapshot(
      legacyRef,
      async (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((row) =>
            ["friend_accepted", "open_plan_interest"].includes(String(row.type || ""))
          );
        const resolved = await Promise.all(
          list.map((row) =>
            resolveActivity({
              id: row.id,
              type: row.type,
              fromUserId: row.from || row.joinerId || null,
              planTitle: row.planTitle || null,
              createdAt: row.createdAt,
              read: true,
            })
          )
        );
        setLegacyActivityItems(resolved);
        legacyReady = true;
        maybeDoneLoading();
      },
      () => {
        legacyReady = true;
        maybeDoneLoading();
      }
    );

    return () => {
      unsubReq();
      unsubActivity();
      unsubLegacy();
    };
  }, []);

  useEffect(() => {
    prefetchResolvedAvatar(DEFAULT_AVATAR);
  }, []);

  const feedItems: FeedItem[] = useMemo(() => {
    const requests: FeedItem[] = friendRequests.map((r) => ({
      feedKey: `req_${r.id}`,
      kind: "friend_request" as const,
      id: r.id,
      fromUserId: r.fromUserId,
      actorName: r.actorName,
      actorImageUrl: r.actorImageUrl,
      sortMs: r.sortMs,
      raw: r,
    }));

    const activityIds = new Set(activityItems.map((a) => a.id));
    const mergedActivity = [
      ...activityItems,
      ...legacyActivityItems.filter((a) => !activityIds.has(a.id)),
    ];

    const activity: FeedItem[] = mergedActivity
      .filter((a) =>
        ["friend_accepted", "open_plan_interest", "friend_synq_active", "synq_nudge"].includes(
          a.type
        )
      )
      .map((a) => ({
        feedKey: `act_${a.id}`,
        kind: a.type as ActivityType,
        id: a.id,
        source: activityIds.has(a.id)
          ? ("notifications" as const)
          : ("legacy" as const),
        fromUserId: a.fromUserId,
        actorName: a.actorName,
        actorImageUrl: a.actorImageUrl,
        title: a.title,
        body: a.body,
        sortMs: a.sortMs,
        read: a.read,
        eventId: a.eventId,
        planHostUid: a.planHostUid,
        raw: a,
      }));

    return [...requests, ...activity].sort((a, b) => b.sortMs - a.sortMs);
  }, [friendRequests, activityItems, legacyActivityItems]);

  const markActivityRead = async (item: Extract<FeedItem, { kind: ActivityType }>) => {
    if (!auth.currentUser || item.source !== "notifications") return;
    try {
      await updateDoc(
        doc(db, "users", auth.currentUser.uid, "notifications", item.id),
        { read: true }
      );
    } catch {}
  };

  const clearAll = async () => {
    if (!auth.currentUser || clearingAll || feedItems.length === 0) return;

    const myId = auth.currentUser.uid;
    setClearingAll(true);
    setShowClearConfirm(false);

    const refByPath = new Map<string, ReturnType<typeof doc>>();
    for (const item of feedItems) {
      if (item.kind === "friend_request") {
        const ref = doc(db, "users", myId, "friendRequests", item.id);
        refByPath.set(ref.path, ref);
      } else {
        for (const ref of activityDeleteRefs(myId, item.id)) {
          refByPath.set(ref.path, ref);
        }
      }
    }
    const refs = Array.from(refByPath.values());

    const BATCH_LIMIT = 450;
    try {
      for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
    } catch {
      showAlert("Error", "Could not clear notifications. Please try again.");
    } finally {
      setClearingAll(false);
    }
  };

  const dismissActivity = async (item: Extract<FeedItem, { kind: ActivityType }>) => {
    if (!auth.currentUser || dismissingKeys.has(item.feedKey)) return;

    const myId = auth.currentUser.uid;
    setDismissingKeys((prev) => new Set(prev).add(item.feedKey));

    try {
      const batch = writeBatch(db);
      activityDeleteRefs(myId, item.id).forEach((ref) => batch.delete(ref));
      await batch.commit();
    } catch {
      showAlert("Error", "Could not dismiss notification. Please try again.");
    } finally {
      setDismissingKeys((prev) => {
        const next = new Set(prev);
        next.delete(item.feedKey);
        return next;
      });
    }
  };

  const handleRequest = async (request: Record<string, unknown> & { id: string }, accept: boolean) => {
    if (!auth.currentUser) return;

    try {
      const myId = auth.currentUser.uid;
      const senderId = String(request.from || request.fromId || "");

      if (!senderId) throw new Error("Missing sender ID.");

      if (accept) {
        const meSnap = await getDoc(doc(db, "users", myId));
        const meData = meSnap.exists() ? meSnap.data() : {};

        const myName =
          (meData as Record<string, unknown>)?.displayName ||
          auth.currentUser.displayName ||
          "User";

        const myImageUrl = resolveAvatar((meData as Record<string, unknown>)?.imageurl);

        let senderName =
          (request.senderName as string) ||
          (request.fromName as string) ||
          "User";

        let senderImageUrl =
          (request.senderImageUrl as string) ||
          (request.fromImageUrl as string) ||
          (request.fromImageurl as string) ||
          (request.imageurl as string) ||
          null;

        if (!senderImageUrl || !senderName) {
          const senderSnap = await getDoc(doc(db, "users", senderId));
          if (senderSnap.exists()) {
            const senderData = senderSnap.data() as Record<string, unknown>;
            senderName =
              senderName ||
              (senderData?.displayName as string) ||
              "User";
            senderImageUrl =
              senderImageUrl ||
              resolveAvatar(senderData?.imageurl);
          }
        }

        const batch = writeBatch(db);

        batch.set(doc(db, "users", myId, "friends", senderId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: senderName,
          imageurl: resolveAvatar(senderImageUrl),
          notifyOnCreate: true,
        });

        batch.set(doc(db, "users", senderId, "friends", myId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: myName,
          imageurl: myImageUrl,
        });

        batch.delete(doc(db, "users", myId, "friendRequests", request.id));

        await batch.commit();

        showAlert("Success", `You are now connected with ${senderName}!`);
      } else {
        await deleteDoc(doc(db, "users", myId, "friendRequests", request.id));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      showAlert("Error", `Could not process request: ${message}`);
    }
  };

  const handleActivityPress = useCallback(async (item: FeedItem) => {
    if (item.kind === "friend_request") return;

    void markActivityRead(item);

    if (item.kind === "friend_accepted" && item.fromUserId) {
      router.push({
        pathname: "/friend-profile",
        params: { friendId: item.fromUserId },
      });
      return;
    }

    if (item.kind === "open_plan_interest") {
      if (item.eventId) {
        router.push(
          `/(tabs)/me?focusEventId=${encodeURIComponent(item.eventId)}`
        );
      } else {
        router.push("/(tabs)/me");
      }
      return;
    }

    if (item.kind === "friend_synq_active" || item.kind === "synq_nudge") {
      router.push("/(tabs)");
    }
  }, []);

  const kickerFor = (kind: FeedItem["kind"]) => {
    switch (kind) {
      case "friend_request":
        return "Friend request";
      case "friend_accepted":
        return "Request accepted";
      case "open_plan_interest":
        return "Plan interest";
      case "friend_synq_active":
        return "Synq active";
      case "synq_nudge":
        return "Are you free?";
      default:
        return "Notification";
    }
  };

  const FriendRequestRow = ({ item }: { item: Extract<FeedItem, { kind: "friend_request" }> }) => {
    const avatarUri = resolveAvatar(item.actorImageUrl);

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.avatar}>
            <ExpoImage
              source={{ uri: avatarUri }}
              style={styles.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
              recyclingKey={avatarUri}
              priority="high"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.rowKicker}>{kickerFor(item.kind)}</Text>
            <Text style={styles.rowText}>
              <Text style={styles.boldWhite}>{item.actorName}</Text>
              <Text style={styles.grayText}> wants to be your friend.</Text>
            </Text>
          </View>
        </View>

        <View style={styles.rowRight}>
          <TouchableOpacity
            onPress={() => handleRequest(item.raw as Record<string, unknown> & { id: string }, true)}
            style={styles.acceptBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Accept friend request"
          >
            <Ionicons name="checkmark" size={18} color="black" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleRequest(item.raw as Record<string, unknown> & { id: string }, false)}
            style={styles.dismissBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Decline friend request"
          >
            <CloseIcon size={20} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ActivityRow = ({ item }: { item: Extract<FeedItem, { kind: ActivityType }> }) => {
    const avatarUri = resolveAvatar(item.actorImageUrl);
    const unread = !item.read;
    const isDismissing = dismissingKeys.has(item.feedKey);

    return (
      <View
        style={[styles.row, styles.activityRow, unread && styles.activityRowUnread]}
      >
        <TouchableOpacity
          style={styles.activityTapArea}
          activeOpacity={0.75}
          onPress={() => handleActivityPress(item)}
          disabled={isDismissing}
        >
          <View style={styles.rowLeft}>
            <View style={styles.avatar}>
              <ExpoImage
                source={{ uri: avatarUri }}
                style={styles.avatarImg}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
                recyclingKey={avatarUri}
                priority="high"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.rowKicker}>{kickerFor(item.kind)}</Text>
              <Text style={styles.rowText}>{item.body}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => dismissActivity(item)}
          style={styles.dismissBtn}
          disabled={isDismissing}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isDismissing ? (
            <ActivityIndicator size="small" color={MUTED2} />
          ) : (
            <CloseIcon size={20} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderFeedItem = ({ item }: { item: FeedItem }) => (
    <View style={styles.group}>
      {item.kind === "friend_request" ? (
        <FriendRequestRow item={item} />
      ) : (
        <ActivityRow item={item} />
      )}
    </View>
  );

  const isEmpty = feedItems.length === 0;
  const emptyTopOffset = Math.round(windowHeight * 0.2);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <StackScreenHeader
        title="Notifications"
        right={
          !loading && !loadError && !isEmpty ? (
            <TouchableOpacity
              onPress={() => setShowClearConfirm(true)}
              disabled={clearingAll}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
            >
              {clearingAll ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Text style={styles.clearAllText}>Clear all</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Could not load notifications</Text>
          <Text style={styles.emptySubtitle}>Pull down to refresh or try again later.</Text>
        </View>
      ) : isEmpty ? (
        <ScrollView
          style={styles.emptyScroll}
          contentContainerStyle={[
            styles.emptyScrollContent,
            { paddingTop: emptyTopOffset },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
            />
          }
        >
          <NotificationsEmptyState />
        </ScrollView>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.feedKey}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={renderFeedItem}
        />
      )}

      <ConfirmModal
        visible={showClearConfirm}
        title="Clear all?"
        message="This removes every item in your notifications list. Pending friend requests will be declined."
        confirmText="Clear all"
        destructive
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={clearAll}
      />

      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: SPACE_4 },
  listContent: {
    paddingBottom: SPACE_6 + 8,
    paddingTop: SPACE_3,
  },
  emptyScroll: {
    flex: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: SPACE_6,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: SPACE_5,
    maxWidth: 300,
    width: "100%",
    alignSelf: "center",
  },
  group: {
    backgroundColor: SURFACE,
    marginHorizontal: SPACE_4 + 4,
    borderRadius: RADIUS_MD,
    overflow: "hidden",
    marginBottom: SPACE_3,
    borderWidth: 1,
    borderColor: BORDER,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACE_4 + 2,
    paddingHorizontal: SPACE_4 + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#252525",
  },
  activityRow: {
    borderBottomWidth: 0,
  },
  activityRowUnread: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  activityTapArea: {
    flex: 1,
    marginRight: SPACE_3,
  },
  dismissBtn: {
    backgroundColor: "#222",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: SPACE_3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACE_4,
    overflow: "hidden",
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  rowKicker: {
    color: ACCENT,
    fontSize: TYPE_CAPTION - 2,
    fontFamily: fonts.black,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  rowText: {
    fontSize: TYPE_BODY - 1,
    color: "white",
    fontFamily: fonts.medium,
    lineHeight: 18,
  },
  boldWhite: { fontFamily: fonts.heavy, color: "white" },
  grayText: { color: "#aaa", fontFamily: fonts.medium, fontSize: TYPE_BODY - 1 },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptBtn: {
    backgroundColor: ACCENT,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACE_3,
  },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE_5,
  },
  emptyHeadline: {
    color: TEXT,
    fontSize: TYPE_SECTION + 2,
    fontFamily: fonts.heavy,
    textAlign: "center",
    letterSpacing: 0.15,
  },
  emptyHelper: {
    color: MUTED,
    fontSize: TYPE_BODY,
    fontFamily: fonts.book,
    textAlign: "center",
    lineHeight: 24,
    marginTop: SPACE_3,
    maxWidth: 280,
  },
  emptyTitle: {
    color: "white",
    fontSize: TYPE_SECTION,
    fontFamily: fonts.heavy,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: "#777",
    fontSize: TYPE_BODY - 1,
    fontFamily: fonts.medium,
    textAlign: "center",
    marginTop: 8,
  },
  clearAllText: {
    color: ACCENT,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.heavy,
  },
});
