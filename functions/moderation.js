const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const axios = require("axios");
const { containsObjectionableContent } = require("./contentFilter");
const { logError, logInfo, logWarn } = require("./serverLog");

const MODERATION_EMAIL_TO = "synqapp@gmail.com";
const MODERATION_FROM = process.env.MODERATION_EMAIL_FROM || "Synq Moderation <onboarding@resend.dev>";

async function sendModerationEmail(subject, body) {
  const apiKey = process.env.MODERATION_EMAIL_API_KEY;
  if (!apiKey) {
    logWarn("moderation_email_skipped_no_api_key", { subject });
    return;
  }
  try {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from: MODERATION_FROM,
        to: [MODERATION_EMAIL_TO],
        subject,
        text: body,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );
  } catch (e) {
    logError("moderation_email_failed", e, { subject });
  }
}

async function enqueueModerationItem(db, item) {
  const ref = await db.collection("moderationQueue").add({
    status: "open",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...item,
  });
  return ref.id;
}

async function notifyModerationQueueItem(queueId, item) {
  const lines = [
    `Queue ID: ${queueId}`,
    `Type: ${item.kind || item.contentType || "unknown"}`,
    `Reporter: ${item.reporterId || "—"}`,
    `Reported user: ${item.reportedUserId || "—"}`,
    `Reason: ${item.reason || "—"}`,
    `Content type: ${item.contentType || "—"}`,
    `Chat: ${item.chatId || "—"}`,
    `Message: ${item.messageId || "—"}`,
    `Details: ${item.details || "—"}`,
  ];
  await sendModerationEmail(
    `[Synq] Moderation: ${item.kind || item.contentType || "report"}`,
    lines.join("\n")
  );
}

async function removeFriendMutualInternal(db, uid, friendId) {
  const batch = db.batch();
  batch.delete(db.doc(`users/${uid}/friends/${friendId}`));
  batch.delete(db.doc(`users/${friendId}/friends/${uid}`));
  batch.delete(db.doc(`users/${uid}/friendRequests/${friendId}`));
  batch.delete(db.doc(`users/${friendId}/friendRequests/${uid}`));
  batch.delete(db.doc(`users/${uid}/outgoingFriendRequests/${friendId}`));
  batch.delete(db.doc(`users/${friendId}/outgoingFriendRequests/${uid}`));
  await batch.commit();
}

function registerModerationExports() {
  const db = admin.firestore();

  const filterMessageOnCreate = onDocumentCreated(
    {
      document: "chats/{chatId}/messages/{messageId}",
      region: "us-central1",
    },
    async (event) => {
      const snap = event.data;
      if (!snap) return;
      const data = snap.data();
      const text = String(data?.text || "");
      if (!text || !containsObjectionableContent(text)) return;

      const { chatId, messageId } = event.params;
      try {
        await snap.ref.delete();
        const queueId = await enqueueModerationItem(db, {
          kind: "auto_filtered",
          contentType: "message",
          reportedUserId: String(data.senderId || ""),
          reporterId: "system",
          chatId,
          messageId,
          reason: "auto_filter",
          preview: text.slice(0, 200),
        });
        await notifyModerationQueueItem(queueId, {
          kind: "auto_filtered",
          contentType: "message",
          reportedUserId: data.senderId,
          chatId,
          messageId,
        });
      } catch (e) {
        logError("onMessageContentFilter", e, { chatId, messageId });
      }
    }
  );

  const submitReport = onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    const reporterId = request.auth.uid;
    const {
      reportedUserId,
      contentType,
      reason,
      details,
      chatId,
      messageId,
      contentId,
    } = request.data || {};

    if (!reportedUserId || !contentType || !reason) {
      throw new HttpsError("invalid-argument", "Missing required report fields.");
    }

    const dedupeKey = `${reporterId}:${reportedUserId}:${contentType}:${messageId || contentId || ""}`;
    const recent = await db
      .collection("moderationQueue")
      .where("dedupeKey", "==", dedupeKey)
      .where("status", "==", "open")
      .limit(1)
      .get();
    if (!recent.empty) {
      return { ok: true, duplicate: true, queueId: recent.docs[0].id };
    }

    const queueId = await enqueueModerationItem(db, {
      kind: "user_report",
      reporterId,
      reportedUserId,
      contentType,
      reason,
      details: String(details || "").slice(0, 1000),
      chatId: chatId || null,
      messageId: messageId || null,
      contentId: contentId || null,
      dedupeKey,
    });
    await notifyModerationQueueItem(queueId, {
      kind: "user_report",
      reporterId,
      reportedUserId,
      contentType,
      reason,
      details,
      chatId,
      messageId,
    });
    return { ok: true, queueId };
  }
  );

  const blockUser = onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    const blockerId = request.auth.uid;
    const blockedUserId = String(request.data?.blockedUserId || "").trim();
    if (!blockedUserId || blockedUserId === blockerId) {
      throw new HttpsError("invalid-argument", "Invalid user to block.");
    }

    await db.doc(`users/${blockerId}/blocked/${blockedUserId}`).set({
      blockedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: request.data?.source || "manual",
    });

    try {
      await removeFriendMutualInternal(db, blockerId, blockedUserId);
    } catch (e) {
      logWarn("blockUser_remove_friend", { blockerId, blockedUserId, err: String(e) });
    }

    const queueId = await enqueueModerationItem(db, {
      kind: "block",
      reporterId: blockerId,
      reportedUserId: blockedUserId,
      contentType: "user",
      reason: "block",
      details: request.data?.details || null,
    });
    await notifyModerationQueueItem(queueId, {
      kind: "block",
      reporterId: blockerId,
      reportedUserId: blockedUserId,
      reason: "block",
    });

    return { ok: true, queueId };
  }
  );

  const unblockUser = onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    const blockerId = request.auth.uid;
    const blockedUserId = String(request.data?.blockedUserId || "").trim();
    if (!blockedUserId) throw new HttpsError("invalid-argument", "Invalid user.");
    await db.doc(`users/${blockerId}/blocked/${blockedUserId}`).delete();
    return { ok: true };
  });

  const moderateContent = onCall({ region: "us-central1" }, async (request) => {
      if (!request.auth?.token?.admin) {
        throw new HttpsError("permission-denied", "Admin only.");
      }
      const { queueId, action, targetUserId, chatId, messageId } = request.data || {};
      if (!action) throw new HttpsError("invalid-argument", "Missing action.");

      if (action === "remove_message" && chatId && messageId) {
        await db.doc(`chats/${chatId}/messages/${messageId}`).delete();
      }

      if (action === "suspend_user" && targetUserId) {
        await db.doc(`users/${targetUserId}`).set(
          { suspended: true, suspendedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      }

      if (action === "dismiss_report" && queueId) {
        await db.doc(`moderationQueue/${queueId}`).set(
          {
            status: "dismissed",
            actionedAt: admin.firestore.FieldValue.serverTimestamp(),
            actionedBy: request.auth.uid,
          },
          { merge: true }
        );
      } else if (queueId) {
        await db.doc(`moderationQueue/${queueId}`).set(
          {
            status: "actioned",
            actionedAt: admin.firestore.FieldValue.serverTimestamp(),
            actionedBy: request.auth.uid,
            action,
          },
          { merge: true }
        );
      }

      return { ok: true };
    }
  );

  const checkOpenModerationReports = onSchedule(
    {
      schedule: "every day 09:00",
      region: "us-central1",
    },
    async () => {
      const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const snap = await db
        .collection("moderationQueue")
        .where("status", "==", "open")
        .where("createdAt", "<", cutoff)
        .limit(50)
        .get();

      if (snap.empty) return;

      const ids = snap.docs.map((d) => d.id).join(", ");
      await sendModerationEmail(
        `[Synq] ${snap.size} moderation item(s) open > 24h`,
        `Review in Firebase Console → moderationQueue.\nIDs: ${ids}`
      );
      logInfo("checkOpenModerationReports_escalation", { count: snap.size });
    }
  );

  return {
    filterMessageOnCreate,
    submitReport,
    blockUser,
    unblockUser,
    moderateContent,
    checkOpenModerationReports,
  };
}

module.exports = { registerModerationExports, sendModerationEmail, enqueueModerationItem };
