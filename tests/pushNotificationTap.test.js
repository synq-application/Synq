const { parsePushNotificationTap } = require("../src/lib/pushNotificationTapCore");

describe("parsePushNotificationTap", () => {
  test("routes new message notifications to the chat thread", () => {
    expect(
      parsePushNotificationTap({
        type: "message",
        chatId: "chat-1",
        messageId: "msg-1",
      })
    ).toEqual({
      kind: "chat",
      chatId: "chat-1",
      messageId: "msg-1",
    });
  });

  test("routes message like notifications to the chat thread", () => {
    expect(
      parsePushNotificationTap({
        type: "message_reaction",
        chatId: "chat-2",
        messageId: "msg-9",
      })
    ).toEqual({
      kind: "chat",
      chatId: "chat-2",
      messageId: "msg-9",
    });
  });

  test("opens chat when only chatId is present", () => {
    expect(parsePushNotificationTap({ chatId: "chat-3" })).toEqual({
      kind: "chat",
      chatId: "chat-3",
      messageId: undefined,
    });
  });

  test("routes friend requests to notifications", () => {
    expect(parsePushNotificationTap({ type: "friend_request" })).toEqual({
      kind: "notifications",
    });
  });

  test("routes community group invites to the group page", () => {
    expect(
      parsePushNotificationTap({
        type: "community_group_invite",
        groupId: "cg-42",
        fromUserId: "user-1",
      })
    ).toEqual({
      kind: "community_group",
      groupId: "cg-42",
    });
  });
});
