import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";
import { trackEvent } from "@/src/lib/analytics";
import {
  createPendingMessage,
  pendingMatchesServer,
  pruneAcknowledgedPending,
  PendingMessage,
} from "@/src/lib/chatMessages";

type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  createdAt?: unknown;
};

type Params = {
  activeChatId: string | null;
  pendingNewChat: {
    participants: string[];
    participantNames: Record<string, string>;
    participantImages: Record<string, string>;
  } | null;
  allChats: { id: string; participants: string[] }[];
  serverMessages: ChatMessage[];
  setActiveChatId: (id: string | null) => void;
  setPendingNewChat: (value: Params["pendingNewChat"]) => void;
  resolveAvatar: (url: unknown) => string;
  userAvatar?: string;
  rejectIfObjectionable: (text: string) => boolean;
  onSendError: (message: string) => void;
  onMessageDelivered?: (clientId: string, meta: { text: string; senderId: string; sentAt: number }) => void;
};

export function useSendMessage({
  activeChatId,
  pendingNewChat,
  allChats,
  serverMessages,
  setActiveChatId,
  setPendingNewChat,
  resolveAvatar,
  userAvatar,
  rejectIfObjectionable,
  onSendError,
  onMessageDelivered,
}: Params) {
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const recentlySentRef = useRef<
    Map<string, { text: string; senderId: string; sentAt: number }>
  >(new Map());

  const sendOrderRef = useRef(0);
  const sendOrderByServerIdRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const matchedServerIds = new Set();
    for (const pending of pendingMessages) {
      if (pending.sendStatus === "failed") continue;
      if (typeof pending.sendOrder !== "number") continue;
      const server = serverMessages.find(
        (row) =>
          !matchedServerIds.has(row.id) && pendingMatchesServer(pending, row)
      );
      if (server) {
        matchedServerIds.add(server.id);
        sendOrderByServerIdRef.current.set(server.id, pending.sendOrder);
      }
    }

    setPendingMessages((prev) => {
      if (!prev.length) return prev;
      const next = pruneAcknowledgedPending(serverMessages, prev);
      return next.length === prev.length ? prev : next;
    });
  }, [serverMessages, pendingMessages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !auth.currentUser) return false;
      if (
        !pendingNewChat &&
        (!activeChatId || !allChats.find((c) => c.id === activeChatId))
      ) {
        return false;
      }
      if (rejectIfObjectionable(trimmed)) return false;

      const myId = auth.currentUser.uid;
      const clientId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const myAvatar = resolveAvatar(userAvatar);
      const optimistic = createPendingMessage({
        clientId,
        text: trimmed,
        senderId: myId,
        imageurl: myAvatar,
        sendOrder: ++sendOrderRef.current,
      });

      setPendingMessages((prev) => [...prev, optimistic]);

      try {
        let chatId = activeChatId;
        let otherParticipants: string[];

        if (pendingNewChat) {
          const chatRef = await addDoc(collection(db, "chats"), {
            participants: pendingNewChat.participants,
            participantNames: pendingNewChat.participantNames,
            participantImages: pendingNewChat.participantImages,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: "",
          });
          chatId = chatRef.id;
          otherParticipants = pendingNewChat.participants.filter(
            (pId) => pId !== myId
          );
          setActiveChatId(chatId);
          setPendingNewChat(null);
        } else {
          const currentChat = allChats.find((c) => c.id === activeChatId)!;
          otherParticipants = currentChat.participants.filter(
            (pId) => pId !== myId
          );
        }

        await addDoc(collection(db, "chats", chatId!, "messages"), {
          text: trimmed,
          senderId: myId,
          imageurl: myAvatar,
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, "chats", chatId!), {
          lastMessage: trimmed,
          lastMessageSenderId: myId,
          updatedAt: serverTimestamp(),
          [`participantImages.${myId}`]: myAvatar,
        });

        recentlySentRef.current.set(clientId, {
          text: trimmed,
          senderId: myId,
          sentAt: Date.now(),
        });
        onMessageDelivered?.(clientId, {
          text: trimmed,
          senderId: myId,
          sentAt: Date.now(),
        });
        setTimeout(() => recentlySentRef.current.delete(clientId), 20_000);

        trackEvent("message_sent", { chat_id: chatId! });

        void Promise.all(
          otherParticipants.map(async (pId) => {
            const mySideFriendDoc = doc(db, "users", myId, "friends", pId);
            const theirSideFriendDoc = doc(db, "users", pId, "friends", myId);
            await updateDoc(mySideFriendDoc, {
              synqCount: increment(1),
              lastSynqAt: serverTimestamp(),
            }).catch(() => {});
            await updateDoc(theirSideFriendDoc, {
              synqCount: increment(1),
              lastSynqAt: serverTimestamp(),
            }).catch(() => {});
          })
        );

        return true;
      } catch {
        setPendingMessages((prev) =>
          prev.map((p) =>
            p.clientId === clientId ? { ...p, sendStatus: "failed" as const } : p
          )
        );
        onSendError("Message could not be sent. Please try again.");
        return false;
      }
    },
    [
      activeChatId,
      allChats,
      pendingNewChat,
      rejectIfObjectionable,
      resolveAvatar,
      setActiveChatId,
      setPendingNewChat,
      userAvatar,
      onSendError,
      onMessageDelivered,
    ]
  );

  const retryFailedMessage = useCallback(
    async (clientId: string, text: string) => {
      setPendingMessages((prev) => prev.filter((p) => p.clientId !== clientId));
      return sendMessage(text);
    },
    [sendMessage]
  );

  const clearPendingMessages = useCallback(() => {
    setPendingMessages([]);
    recentlySentRef.current.clear();
    sendOrderRef.current = 0;
    sendOrderByServerIdRef.current.clear();
  }, []);

  return {
    pendingMessages,
    sendMessage,
    retryFailedMessage,
    clearPendingMessages,
    recentlySentRef,
    sendOrderByServerIdRef,
  };
}
