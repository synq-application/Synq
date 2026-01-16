export type SynqStatus = "idle" | "activating" | "finding" | "active";

export const formatTime = (timestamp: any) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const getChatTitle = (chat: any, myId: string) => {
  if (!chat?.participantNames) return "Synq Chat";
  const otherNames = Object.entries(chat.participantNames)
    .filter(([uid]) => uid !== myId)
    .map(([_, name]) => name as string);

  if (otherNames.length === 0) return "Just You";
  if (otherNames.length === 1) return `You & ${otherNames[0]}`;
  const last = otherNames.pop();
  return `You, ${otherNames.join(", ")} & ${last}`;
};

