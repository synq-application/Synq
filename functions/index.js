const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const admin = require("firebase-admin");
const { logError, logWarn, logInfo } = require("./serverLog");

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 7;

function randomInviteCode(length = INVITE_CODE_LENGTH) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
    out += INVITE_CODE_ALPHABET[idx];
  }
  return out;
}

async function reserveUniqueInviteCode(db, maxAttempts = 25) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = randomInviteCode();
    const snap = await db
      .collection("users")
      .where("inviteCode", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return code;
  }
  throw new HttpsError("resource-exhausted", "Could not reserve invite code.");
}

/**
 * Expo push tokens identify a device+install, not a user. If two accounts log in on
 * the same phone, both user docs can end up with the same token — then "notify the
 * recipient" delivers to the sender's device. When a user saves a token, remove it
 * from every other profile so only one uid owns it.
 */
exports.onUserPushTokenWrite = onDocumentWritten(
  {
    document: "users/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const userId = event.params.userId;
    const after = event.data.after?.exists ? event.data.after.data() : null;
    const token = after?.pushToken;
    if (!token || typeof token !== "string") return;

    try {
      const dupes = await admin
        .firestore()
        .collection("users")
        .where("pushToken", "==", token)
        .get();

      if (dupes.size <= 1) return;

      const batch = admin.firestore().batch();
      let cleared = 0;
      dupes.docs.forEach((d) => {
        if (d.id !== userId) {
          batch.update(d.ref, {
            pushToken: admin.firestore.FieldValue.delete(),
          });
          cleared += 1;
        }
      });
      if (cleared > 0) {
        await batch.commit();
        logInfo("onUserPushTokenWrite_cleared_dupes", {
          userId,
          cleared,
        });
      }
    } catch (e) {
      logError("onUserPushTokenWrite", e, { userId });
    }
  }
);

exports.onMessageSent = onDocumentCreated({
    document: "chats/{chatId}/messages/{messageId}",
    region: "us-central1"
}, async (event) => {
    const messageSnapshot = event.data;
    if (!messageSnapshot) return;
    const messageData = messageSnapshot.data();
    const { chatId } = event.params;

    try {
        const chatDoc = await admin.firestore().collection("chats").doc(chatId).get();
        if (!chatDoc.exists) return;

        const chatData = chatDoc.data();
        const senderId = String(messageData.senderId ?? "").trim();
        if (!senderId) {
            logWarn("onMessageSent_missing_senderId", { chatId });
            return;
        }

        const recipientIds = [
            ...new Set(
                (chatData.participants || [])
                    .map((id) => String(id ?? "").trim())
                    .filter((id) => id && id !== senderId)
            ),
        ];

        const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
        const senderPushToken = senderDoc.data()?.pushToken || null;

        /** One Expo push per device token per invocation (duplicate UIDs or stale same-token rows). */
        const sentTokens = new Set();

        for (const recipientId of recipientIds) {
            const userDoc = await admin.firestore().collection("users").doc(recipientId).get();
            const userData = userDoc.data();
            const token = userData?.pushToken;

            if (!token) continue;

            if (senderPushToken && token === senderPushToken) {
                logWarn("onMessageSent_skip_same_device_token", {
                    chatId,
                    recipientId,
                });
                continue;
            }

            if (sentTokens.has(token)) {
                logInfo("onMessageSent_skip_duplicate_token", {
                    chatId,
                    recipientId,
                });
                continue;
            }
            sentTokens.add(token);

            const senderName =
                chatData.participantNames?.[senderId] ||
                chatData.participantNames?.[messageData.senderId] ||
                "New Message";
            await axios.post("https://exp.host/--/api/v2/push/send", {
                to: token,
                sound: "default",
                title: senderName,
                body: messageData.text,
                data: {
                    chatId: String(chatId),
                    messageId: String(event.params.messageId ?? ""),
                    type: "message",
                },
            });
        }
    } catch (error) {
        logError("onMessageSent", error, { chatId });
    }
});

/** Notify the message author when someone else hearts their message. */
exports.onMessageReaction = onDocumentUpdated(
  {
    document: "chats/{chatId}/messages/{messageId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!after) return;

    const { chatId, messageId } = event.params;
    const beforeR = (before && before.reactions) || {};
    const afterR = after.reactions || {};

    const senderId = String(after.senderId ?? "").trim();
    if (!senderId) return;

    const newHeartUserIds = Object.keys(afterR).filter(
      (uid) => afterR[uid] === "heart" && beforeR[uid] !== "heart"
    );
    if (newHeartUserIds.length === 0) return;

    let chatData = {};
    try {
      const chatDoc = await admin.firestore().collection("chats").doc(chatId).get();
      if (!chatDoc.exists) return;
      chatData = chatDoc.data() || {};
    } catch (e) {
      logError("onMessageReaction_chat_read", e, { chatId });
      return;
    }

    const messageText = String(after.text || "").slice(0, 120);

    for (const reactorId of newHeartUserIds) {
      const rid = String(reactorId || "").trim();
      if (!rid || rid === senderId) continue;

      try {
        const authorDoc = await admin.firestore().collection("users").doc(senderId).get();
        const reactorDoc = await admin.firestore().collection("users").doc(rid).get();
        const authorToken = authorDoc.data()?.pushToken;
        if (!authorToken) continue;

        const reactorToken = reactorDoc.data()?.pushToken || null;
        if (reactorToken && authorToken === reactorToken) {
          logWarn("onMessageReaction_skip_same_device_token", {
            chatId,
            messageId,
          });
          continue;
        }

        let reactorName =
          chatData.participantNames?.[rid] ||
          reactorDoc.data()?.displayName ||
          "Someone";
        reactorName = String(reactorName).trim() || "Someone";

        const body = messageText
          ? `${reactorName} liked: ${messageText}${messageText.length >= 120 ? "…" : ""}`
          : `${reactorName} liked your message`;

        await axios.post("https://exp.host/--/api/v2/push/send", {
          to: authorToken,
          sound: "default",
          title: `${reactorName} liked your message`,
          body,
          data: {
            type: "message_reaction",
            chatId: String(chatId),
            messageId: String(messageId),
          },
        });
      } catch (err) {
        logError("onMessageReaction_push", err, { chatId, messageId });
      }
    }
  }
);

exports.deleteMyAccount = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = request.auth.uid;
    const db = admin.firestore();

    const deleteCollectionInChunks = async (colRef, chunkSize = 400) => {
      while (true) {
        const snap = await colRef.limit(chunkSize).get();
        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    };

    try {
      const myFriendsRef = db.collection("users").doc(uid).collection("friends");
      const myFriendsSnap = await myFriendsRef.get();
      const friendIds = myFriendsSnap.docs.map((d) => d.id);

      for (let i = 0; i < friendIds.length; i += 400) {
        const chunk = friendIds.slice(i, i + 400);
        const batch = db.batch();

        chunk.forEach((fid) => {
          batch.delete(db.collection("users").doc(fid).collection("friends").doc(uid));
          batch.delete(db.collection("users").doc(uid).collection("friends").doc(fid));
        });

        await batch.commit();
      }

      const chatsSnap = await db
        .collection("chats")
        .where("participants", "array-contains", uid)
        .get();

      for (const chatDoc of chatsSnap.docs) {
        const chatId = chatDoc.id;
        const msgsRef = db.collection("chats").doc(chatId).collection("messages");
        await deleteCollectionInChunks(msgsRef, 400);
        await db.collection("chats").doc(chatId).delete();
      }
      await deleteCollectionInChunks(db.collection("users").doc(uid).collection("friendRequests"), 400);
      await deleteCollectionInChunks(db.collection("users").doc(uid).collection("notificationLocks"), 400);
      await db.collection("users").doc(uid).delete();
      await admin.auth().deleteUser(uid);

      return { ok: true };
    } catch (error) {
      logError("deleteMyAccount", error, { uid });
      throw new HttpsError("internal", error?.message || "Failed to delete account.");
    }
  }
);

/** Removes friendship on both sides and clears pending friend requests in both directions. */
exports.removeFriendMutual = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = request.auth.uid;
    const otherUid = request.data?.otherUid;
    if (!otherUid || typeof otherUid !== "string" || otherUid === uid) {
      throw new HttpsError("invalid-argument", "Invalid friend id.");
    }
    const db = admin.firestore();
    const batch = db.batch();
    batch.delete(db.collection("users").doc(uid).collection("friends").doc(otherUid));
    batch.delete(db.collection("users").doc(otherUid).collection("friends").doc(uid));
    batch.delete(db.collection("users").doc(uid).collection("friendRequests").doc(otherUid));
    batch.delete(db.collection("users").doc(otherUid).collection("friendRequests").doc(uid));
    await batch.commit();
    return { ok: true };
  }
);

/** Returns current user's invite code; creates one if missing. */
exports.getOrCreateInviteCode = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const uid = String(request.auth.uid || "").trim();
    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "User profile not found.");
    }
    const existing = String(userSnap.data()?.inviteCode || "").trim().toUpperCase();
    if (existing) {
      return { inviteCode: existing };
    }
    const inviteCode = await reserveUniqueInviteCode(db);
    await userRef.set(
      {
        inviteCode,
        inviteCodeCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { inviteCode };
  }
);

/** Accepts invite-link attribution and creates a safe friend request to inviter. */
exports.acceptInviteFromLink = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const toUid = String(request.auth.uid || "").trim();
    const fromUidInput = String(request.data?.fromUid || "").trim();
    const inviteCode = String(request.data?.inviteCode || "")
      .trim()
      .toUpperCase();

    const db = admin.firestore();
    let fromUid = fromUidInput;
    if (!fromUid) {
      if (!inviteCode) {
        throw new HttpsError("invalid-argument", "Missing inviter id or invite code.");
      }
      const inviterByCodeSnap = await db
        .collection("users")
        .where("inviteCode", "==", inviteCode)
        .limit(1)
        .get();
      if (inviterByCodeSnap.empty) {
        throw new HttpsError("failed-precondition", "Invite code no longer exists.");
      }
      fromUid = inviterByCodeSnap.docs[0].id;
    }
    if (fromUid === toUid) {
      throw new HttpsError("invalid-argument", "Cannot invite yourself.");
    }

    const inviterRef = db.collection("users").doc(fromUid);
    const recipientRef = db.collection("users").doc(toUid);
    const recipientToInviterReqRef = inviterRef.collection("friendRequests").doc(toUid);
    const inviterToRecipientReqRef = recipientRef.collection("friendRequests").doc(fromUid);
    const inviterFriendRef = inviterRef.collection("friends").doc(toUid);
    const recipientFriendRef = recipientRef.collection("friends").doc(fromUid);
    const inviteLogRef = db.collection("invites").doc(`${fromUid}_${toUid}`);

    const [
      inviterSnap,
      recipientSnap,
      recipientToInviterReqSnap,
      inviterToRecipientReqSnap,
      inviterFriendSnap,
      recipientFriendSnap,
    ] = await Promise.all([
      inviterRef.get(),
      recipientRef.get(),
      recipientToInviterReqRef.get(),
      inviterToRecipientReqRef.get(),
      inviterFriendRef.get(),
      recipientFriendRef.get(),
    ]);

    if (!inviterSnap.exists) {
      throw new HttpsError("failed-precondition", "Inviter no longer exists.");
    }
    if (!recipientSnap.exists) {
      throw new HttpsError("failed-precondition", "Recipient profile missing.");
    }

    const alreadyFriends = inviterFriendSnap.exists || recipientFriendSnap.exists;
    if (alreadyFriends) {
      await inviteLogRef.set(
        {
          fromUid,
          toUid,
          inviteCode: inviteCode || null,
          status: "already_friends",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { ok: true, status: "already_friends" };
    }

    if (recipientToInviterReqSnap.exists || inviterToRecipientReqSnap.exists) {
      await inviteLogRef.set(
        {
          fromUid,
          toUid,
          inviteCode: inviteCode || null,
          status: "request_exists",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { ok: true, status: "request_exists" };
    }

    const recipientData = recipientSnap.data() || {};
    const senderName = String(
      recipientData.displayName || request.auth.token.name || "Someone"
    ).trim() || "Someone";
    const senderImageUrl =
      typeof recipientData.imageurl === "string" ? recipientData.imageurl : null;

    const batch = db.batch();
    batch.set(recipientToInviterReqRef, {
      from: toUid,
      to: fromUid,
      senderName,
      senderImageUrl,
      source: "invite_link",
      status: "pending",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(
      inviteLogRef,
      {
        fromUid,
        toUid,
        inviteCode: inviteCode || null,
        status: "request_created",
        source: "invite_link",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
    return { ok: true, status: "request_created" };
  }
);

exports.onFriendRequestSent = onDocumentCreated({
    document: "users/{userId}/friendRequests/{requestId}",
    region: "us-central1"
}, async (event) => {
    const requestData = event.data.data();
    const { userId, requestId } = event.params;

    try {
        const recipientDoc = await admin.firestore().collection("users").doc(userId).get();
        const recipientData = recipientDoc.data();
        const senderDoc = await admin.firestore().collection("users").doc(requestId).get();
        const senderPushToken = senderDoc.data()?.pushToken || null;

        const token = recipientData?.pushToken;
        if (!token) return;

        if (senderPushToken && token === senderPushToken) {
            logWarn("onFriendRequestSent_skip_same_device_token", {
                userId,
                requestId,
            });
            return;
        }

        const senderName = requestData.senderName || "A user";

        await axios.post("https://exp.host/--/api/v2/push/send", {
            to: token,
            sound: "default",
            title: "New Friend Request 🤝",
            body: `${senderName} wants to Synq with you!`,
            data: {
                type: "friend_request",
                fromUserId: String(requestId),
            },
        });
    } catch (error) {
        logError("onFriendRequestSent", error, { userId, requestId });
    }
});

function collectJoinedIds(e) {
  const ids = new Set();
  if (Array.isArray(e?.joinedFromIds)) {
    e.joinedFromIds.forEach((id) => {
      const s = String(id || "").trim();
      if (s) ids.add(s);
    });
  }
  const j = String(e?.joinedFromId || "").trim();
  if (j) ids.add(j);
  return ids;
}

function eventMatchKey(e) {
  return `${String(e?.title || "").trim().toLowerCase()}|${String(e?.date || "").trim()}`;
}

function findBeforeEvent(beforeEvents, afterEvent) {
  const aid = String(afterEvent?.id || "").trim();
  if (aid) {
    const b = beforeEvents.find((x) => String(x?.id || "").trim() === aid);
    if (b) return b;
  }
  const k = eventMatchKey(afterEvent);
  return beforeEvents.find((x) => eventMatchKey(x) === k);
}

function firstNameFromDisplay(name) {
  return String(name || "").trim().split(/\s+/)[0] || "Someone";
}

/** Must match app `EXPIRATION_HOURS` in constants/Variables.ts */
const SYNQ_EXPIRATION_HOURS = 12;
const SYNQ_EXPIRATION_MS = SYNQ_EXPIRATION_HOURS * 60 * 60 * 1000;

function synqStartedAtMillis(userData) {
  const t = userData?.synqStartedAt;
  if (!t) return null;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t._seconds === "number") return t._seconds * 1000;
  return null;
}

function isSynqActive(userData) {
  if (!userData || typeof userData !== "object") return false;
  if (String(userData.status || "").trim().toLowerCase() !== "available") return false;
  const ms = synqStartedAtMillis(userData);
  if (ms == null) return false;
  return Date.now() - ms <= SYNQ_EXPIRATION_MS;
}

/**
 * Deactivates Synq for users past the window (server-side, no app open required).
 * Also clears legacy rows that are still `available` but missing `synqStartedAt`.
 */
exports.expireStaleSynq = onSchedule(
  {
    schedule: "every 60 minutes",
    region: "us-central1",
    timeZone: "Etc/UTC",
  },
  async () => {
    const db = admin.firestore();
    const cutoffTs = admin.firestore.Timestamp.fromMillis(Date.now() - SYNQ_EXPIRATION_MS);
    const deactivatePayload = { status: "inactive", memo: "" };

    try {
      const expiredByTime = await db
        .collection("users")
        .where("status", "==", "available")
        .where("synqStartedAt", "<", cutoffTs)
        .get();

      if (!expiredByTime.empty) {
        let batch = db.batch();
        let n = 0;
        for (const doc of expiredByTime.docs) {
          batch.update(doc.ref, deactivatePayload);
          n += 1;
          if (n >= 500) {
            await batch.commit();
            batch = db.batch();
            n = 0;
          }
        }
        if (n > 0) await batch.commit();
        logInfo("expireStaleSynq_by_age", {
          count: expiredByTime.size,
        });
      }

      const FieldPath = admin.firestore.FieldPath;
      let lastDoc = null;
      let legacyTotal = 0;
      let reads = 0;
      const maxLegacyReads = 8000;

      while (reads < maxLegacyReads) {
        let q = db
          .collection("users")
          .where("status", "==", "available")
          .orderBy(FieldPath.documentId())
          .limit(500);
        if (lastDoc) q = q.startAfter(lastDoc);
        const page = await q.get();
        if (page.empty) break;
        reads += page.size;

        const refs = page.docs.filter((d) => !d.data().synqStartedAt).map((d) => d.ref);
        if (refs.length) {
          let lb = db.batch();
          let c = 0;
          for (const ref of refs) {
            lb.update(ref, deactivatePayload);
            legacyTotal += 1;
            c += 1;
            if (c >= 500) {
              await lb.commit();
              lb = db.batch();
              c = 0;
            }
          }
          if (c > 0) await lb.commit();
        }

        lastDoc = page.docs[page.docs.length - 1];
        if (page.size < 500) break;
      }

      if (legacyTotal) {
        logInfo("expireStaleSynq_legacy_missing_started_at", {
          count: legacyTotal,
        });
      }
    } catch (e) {
      logError("expireStaleSynq", e, {});
    }
  }
);

/** When a friend’s id is added to a hosted open plan, notify the host. */
exports.onOpenPlanInterest = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const hostUid = event.params.userId;
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const beforeEvents = Array.isArray(before.events) ? before.events : [];
    const afterEvents = Array.isArray(after.events) ? after.events : [];

    const hostDocRef = admin.firestore().collection("users").doc(hostUid);
    let hostPushToken = after.pushToken;
    if (!hostPushToken) {
      try {
        const snap = await hostDocRef.get();
        hostPushToken = snap.data()?.pushToken;
      } catch (e) {
        logError("onOpenPlanInterest_host_token", e, { hostUid });
        return;
      }
    }
    if (!hostPushToken) return;

    for (const ev of afterEvents) {
      if (String(ev?.planHostUid || "").trim() !== hostUid) continue;

      const beforeEv = findBeforeEvent(beforeEvents, ev);
      const beforeIds = beforeEv ? collectJoinedIds(beforeEv) : new Set();
      const afterIds = collectJoinedIds(ev);

      for (const joinerId of afterIds) {
        if (joinerId === hostUid) continue;
        if (beforeIds.has(joinerId)) continue;

        const eventId = String(ev?.id || eventMatchKey(ev)).replace(/[/\s]/g, "_");
        const lockId = `plan_interest_${hostUid}_${joinerId}_${eventId}`.slice(0, 1400);
        const lockRef = hostDocRef.collection("notificationLocks").doc(lockId);

        const alreadySent = await lockRef.get();
        if (alreadySent.exists) continue;

        let joinerName = "Someone";
        let joinerPushToken = null;
        try {
          const joinerDoc = await admin.firestore().collection("users").doc(joinerId).get();
          if (joinerDoc.exists) {
            const jd = joinerDoc.data();
            joinerName = jd?.displayName || joinerName;
            joinerPushToken = jd?.pushToken || null;
          }
        } catch (e) {
          logError("onOpenPlanInterest_joiner_profile", e, { hostUid, joinerId });
        }

        const planTitle = String(ev?.title || "").trim();
        const body = planTitle
          ? `${firstNameFromDisplay(joinerName)} is interested in your plan ${planTitle}`
          : `${firstNameFromDisplay(joinerName)} is interested in your plan`;

        const eventIdForClient =
          String(ev?.id || "").trim() ||
          String(eventMatchKey(ev)).replace(/[/\s]/g, "_");

        if (joinerPushToken && hostPushToken === joinerPushToken) {
          logWarn("onOpenPlanInterest_skip_same_device_token", {
            hostUid,
            joinerId,
          });
          continue;
        }

        try {
          await axios.post("https://exp.host/--/api/v2/push/send", {
            to: hostPushToken,
            sound: "default",
            title: "Open plan",
            body,
            data: {
              type: "open_plan_interest",
              planHostUid: hostUid,
              fromUserId: joinerId,
              eventId: eventIdForClient,
            },
          });
          await lockRef.set({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: "open_plan_interest",
            joinerId,
            planTitle: planTitle || null,
          });
        } catch (error) {
          logError("onOpenPlanInterest_push", error, { hostUid, joinerId });
        }
      }
    }
  }
);

exports.onFriendAccepted = onDocumentCreated({
  document: "users/{userId}/friends/{friendId}",
  region: "us-central1",
}, async (event) => {
  const { userId, friendId } = event.params;

  const friendSnap = event.data;
  if (!friendSnap) return;

  const friendDocData = friendSnap.data() || {};

  if (friendDocData.notifyOnCreate !== true) {
    logInfo("onFriendAccepted_skip_no_notify", {
      userId,
      friendId,
    });
    return;
  }

  const notifId = `${userId}_accepted_${friendId}`; 
  const notifRef = admin
    .firestore()
    .collection("users")
    .doc(friendId)
    .collection("notificationLocks")
    .doc(notifId);

  const alreadySent = await notifRef.get();
  if (alreadySent.exists) {
    logInfo("onFriendAccepted_skip_duplicate", { userId, friendId });
    return;
  }

  try {
    const friendUserDoc = await admin.firestore().collection("users").doc(friendId).get();
    const friendUserData = friendUserDoc.data();

    const accepterDoc = await admin.firestore().collection("users").doc(userId).get();
    const accepterData = accepterDoc.data();

    if (!friendUserData?.pushToken) return;

    const accepterToken = accepterData?.pushToken || null;
    if (accepterToken && friendUserData.pushToken === accepterToken) {
      logWarn("onFriendAccepted_skip_same_device_token", {
        userId,
        friendId,
      });
      return;
    }

    await axios.post("https://exp.host/--/api/v2/push/send", {
      to: friendUserData.pushToken,
      sound: "default",
      title: "Request Accepted! ✨",
      body: `${accepterData?.displayName || "A user"} accepted your friend request.`,
      data: { type: "friend_accepted", fromUserId: userId },
    });

    await notifRef.set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      from: userId,
      to: friendId,
      type: "friend_accepted",
    });
  } catch (error) {
    logError("onFriendAccepted", error, { userId, friendId });
  }
});

/** Notify active friends when a friend activates Synq (only to recipients also active). */
exports.onFriendSynqActivated = onDocumentUpdated(
  {
    document: "users/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const activatedUserId = event.params.userId;
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};

    const wasActive = isSynqActive(before);
    const isActive = isSynqActive(after);
    if (wasActive || !isActive) return;

    const activatedPushToken = after?.pushToken || null;
    const activatedName = String(after?.displayName || "Your friend").trim() || "Your friend";

    try {
      const friendsSnap = await admin
        .firestore()
        .collection("users")
        .doc(activatedUserId)
        .collection("friends")
        .get();

      if (friendsSnap.empty) return;

      const friendIds = friendsSnap.docs.map((d) => String(d.id || "").trim()).filter(Boolean);
      if (!friendIds.length) return;

      const friendDocs = await Promise.all(
        friendIds.map((fid) => admin.firestore().collection("users").doc(fid).get())
      );

      for (const friendDoc of friendDocs) {
        if (!friendDoc.exists) continue;
        const friendData = friendDoc.data() || {};
        const recipientId = friendDoc.id;
        const recipientToken = friendData?.pushToken;
        if (!recipientToken) continue;
        if (!isSynqActive(friendData)) continue;

        if (activatedPushToken && recipientToken === activatedPushToken) {
          logWarn("onFriendSynqActivated_skip_same_device_token", {
            activatedUserId,
            recipientId,
          });
          continue;
        }

        try {
          await axios.post("https://exp.host/--/api/v2/push/send", {
            to: recipientToken,
            sound: "default",
            title: "Friend active on Synq",
            body: `${firstNameFromDisplay(activatedName)} just activated Synq.`,
            data: {
              type: "friend_synq_active",
              fromUserId: activatedUserId,
            },
          });
        } catch (pushErr) {
          logError("onFriendSynqActivated_push", pushErr, {
            activatedUserId,
            recipientId,
          });
        }
      }
    } catch (err) {
      logError("onFriendSynqActivated", err, { activatedUserId });
    }
  }
);

exports.getSynqSuggestions = onCall(
    {
        secrets: ["GEMINI_API_KEY", "GOOGLE_MAPS_API_KEY"],
        region: "us-central1",
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Must be logged in.");
        }

        try {
            const geminiKey = process.env.GEMINI_API_KEY;
            const googleKey = process.env.GOOGLE_MAPS_API_KEY;
            const { shared, location, category } = request.data;
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `You are a local expert in ${location}. Based on interests: ${shared.join(
                ", "
            )}, suggest 3 ${category} venues. Return ONLY a JSON array: [{"name":"Venue Name"}]`;

            const result = await model.generateContent(prompt);
            const rawText = result?.response?.text?.() || "";
            const cleaned = rawText.replace(/```json|```/g, "").trim();

            let venues = JSON.parse(cleaned);
            const enrichedSuggestions = [];

            for (const venue of venues) {
                try {
                    const googleRes = await axios.post(
                        "https://places.googleapis.com/v1/places:searchText",
                        { textQuery: `${venue.name} in ${location}` },
                        {
                            headers: {
                                "Content-Type": "application/json",
                                "X-Goog-Api-Key": googleKey,
                                "X-Goog-FieldMask": "places.displayName,places.rating,places.photos,places.shortFormattedAddress,places.formattedAddress",
                            },
                        }
                    );

                    const place = googleRes.data.places?.[0];
                    let imageUrl = "https://via.placeholder.com/150";

                    if (place?.photos?.length > 0) {
                        const photoName = place.photos[0].name;
                        imageUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${googleKey}&maxWidthPx=400`;
                    }

                    enrichedSuggestions.push({
                        ...venue,
                        rating: place?.rating ? Number(place.rating).toFixed(1) : "4.0",
                        imageUrl,
                        location: place?.shortFormattedAddress || "Location not available",
                        address: place?.formattedAddress || "Address not available",
                    });
                } catch (e) {
                    enrichedSuggestions.push({ ...venue, imageUrl: "https://via.placeholder.com/150", rating: "4.0" });
                }
            }

            return { suggestions: enrichedSuggestions };
        } catch (error) {
            logError("getSynqSuggestions", error, { uid: request.auth?.uid });
            throw new HttpsError("internal", error?.message || "Unknown error");
        }
    }
)