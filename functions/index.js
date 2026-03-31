const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
    admin.initializeApp();
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
        logger.info("onUserPushTokenWrite: cleared duplicate pushToken from other users", {
          userId,
          cleared,
        });
      }
    } catch (e) {
      logger.error("onUserPushTokenWrite", e);
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
            logger.warn("onMessageSent: missing senderId", { chatId });
            return;
        }

        const recipientIds = (chatData.participants || [])
            .map((id) => String(id ?? "").trim())
            .filter((id) => id && id !== senderId);

        const senderDoc = await admin.firestore().collection("users").doc(senderId).get();
        const senderPushToken = senderDoc.data()?.pushToken || null;

        for (const recipientId of recipientIds) {
            const userDoc = await admin.firestore().collection("users").doc(recipientId).get();
            const userData = userDoc.data();
            const token = userData?.pushToken;

            if (!token) continue;

            if (senderPushToken && token === senderPushToken) {
                logger.warn("onMessageSent: skip push — recipient shares device token with sender", {
                    chatId,
                    recipientId,
                });
                continue;
            }

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
                    type: "message",
                },
            });
        }
    } catch (error) {
        logger.error("Error in onMessageSent:", error);
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
      logger.error("onMessageReaction: chat read", e);
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
          logger.warn("onMessageReaction: skip — author and reactor share device token", {
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
        logger.error("onMessageReaction: push", err);
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
      logger.error("Error in deleteMyAccount:", error);
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
            logger.warn("onFriendRequestSent: skip push — same device token as sender", {
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
        logger.error("Error in onFriendRequestSent:", error);
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

function isSynqActive(userData) {
  if (!userData || typeof userData !== "object") return false;
  return String(userData.status || "").trim().toLowerCase() === "available" && !!userData.synqStartedAt;
}

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
        logger.error("onOpenPlanInterest: could not read host push token", e);
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
          logger.warn("onOpenPlanInterest: joiner profile", e);
        }

        const planTitle = String(ev?.title || "").trim();
        const body = planTitle
          ? `${firstNameFromDisplay(joinerName)} is interested in your plan ${planTitle}`
          : `${firstNameFromDisplay(joinerName)} is interested in your plan`;

        const eventIdForClient =
          String(ev?.id || "").trim() ||
          String(eventMatchKey(ev)).replace(/[/\s]/g, "_");

        if (joinerPushToken && hostPushToken === joinerPushToken) {
          logger.warn("onOpenPlanInterest: skip push — same device token as joiner", {
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
          logger.error("Error in onOpenPlanInterest push:", error);
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
    logger.info("Skipping friend accepted notification (notifyOnCreate != true).", {
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
    logger.info("Skipping duplicate friend accepted notification.", { userId, friendId });
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
      logger.warn("onFriendAccepted: skip push — same device token as accepter", {
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
    logger.error("Error in onFriendAccepted:", error);
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
          logger.warn("onFriendSynqActivated: skip push — same device token", {
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
          logger.error("onFriendSynqActivated: push send failed", pushErr);
        }
      }
    } catch (err) {
      logger.error("onFriendSynqActivated", err);
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
            logger.error(">>> TOP-LEVEL CRITICAL ERROR:", error);
            throw new HttpsError("internal", error?.message || "Unknown error");
        }
    }
)