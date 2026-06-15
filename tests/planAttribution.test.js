const {
  resolveEffectiveHostUid,
  resolvePlanAttribution,
  resolvePlanHostUidForJoin,
} = require("../src/lib/planAttribution.js");

describe("planAttribution", () => {
  test("resolvePlanHostUidForJoin uses joinedFromFriendUid over profile friend", () => {
    expect(
      resolvePlanHostUidForJoin(
        {
          joinedFromFriendUid: "shawn",
          joinedFromIds: ["shawn", "elliott"],
        },
        "elliott"
      )
    ).toBe("shawn");
  });

  test("resolveEffectiveHostUid fixes host stored as profile anchor", () => {
    expect(
      resolveEffectiveHostUid(
        {
          planHostUid: "elliott",
          joinedFromFriendUid: "elliott",
          joinedFromId: "elliott",
        },
        "viewer",
        ["shawn", "elliott", "viewer"],
        "viewer"
      )
    ).toBe("shawn");
  });

  test("keeps Shawn as host on Elliott profile when Elliott is attending", () => {
    expect(
      resolveEffectiveHostUid(
        {
          planHostUid: "shawn",
          joinedFromFriendUid: "shawn",
          joinedFromId: "shawn",
        },
        "viewer",
        ["shawn", "elliott"],
        "elliott"
      )
    ).toBe("shawn");
  });

  test("shows Shawns plan and Elliott going for third-party join", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "elliott",
        joinedFromFriendUid: "elliott",
        joinedFromId: "elliott",
        joinedFromIds: ["shawn", "elliott", "viewer"],
        joinedFromNames: ["Shawn", "Elliott", "Me"],
        attendeeDisplayNames: {
          shawn: "Shawn",
          elliott: "Elliott",
          viewer: "Me",
        },
      },
      "viewer",
      { elliott: "Elliott" },
      "viewer"
    );

    expect(result.primary).toBe("Shawn's plan");
    expect(result.secondary).toBe("Elliott is going");
    expect(result.goingPeople).toHaveLength(1);
    expect(result.goingPeople[0].displayName).toBe("Elliott");
  });

  test("shows Shawns plan on Elliott friend profile", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "shawn",
        joinedFromFriendUid: "shawn",
        joinedFromIds: ["shawn", "elliott"],
        joinedFromNames: ["Elliott"],
        attendeeDisplayNames: {
          shawn: "Shawn",
          elliott: "Elliott",
        },
      },
      "viewer",
      { shawn: "Shawn", elliott: "Elliott" },
      "elliott"
    );

    expect(result.primary).toBe("Shawn's plan");
    expect(result.secondary).toBe("Elliott is going");
  });
});
