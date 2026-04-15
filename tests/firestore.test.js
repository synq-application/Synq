/**
 * Firestore security rules + critical-path flows (auth gate, DM message, friend accept).
 * Requires: `npm test` (wraps Firestore emulator via firebase emulators:exec).
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} = require("firebase/firestore");

const RULES_PATH = join(__dirname, "..", "firestore.rules");
const PROJECT_ID = "demo-synq-rules";

describe("Firestore", () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(RULES_PATH, "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe("security rules", () => {
    test("unauthenticated users cannot read arbitrary profiles (auth gate)", async () => {
      const anon = testEnv.unauthenticatedContext();
      const db = anon.firestore();
      await assertFails(getDoc(doc(db, "users", "alice")));
    });

    test("users can create and read their own profile document", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const db = alice.firestore();
      await assertSucceeds(
        setDoc(doc(db, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(getDoc(doc(db, "users", "alice")));
    });

    test("users cannot read another user without friendship or pending request", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );

      await assertFails(getDoc(doc(aliceDb, "users", "bob")));
    });

    test("friends can read each other's profiles", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "friends", "bob"), { ok: true })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob", "friends", "alice"), { ok: true })
      );

      await assertSucceeds(getDoc(doc(aliceDb, "users", "bob")));
      await assertSucceeds(getDoc(doc(bobDb, "users", "alice")));
    });

    test("friend requests reject self-invites and duplicates", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );

      await assertFails(
        setDoc(doc(aliceDb, "users", "alice", "friendRequests", "alice"), {
          from: "alice",
          to: "alice",
          senderName: "Alice",
        })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "bob", "friendRequests", "alice"), {
          from: "alice",
          to: "bob",
          senderName: "Alice",
        })
      );

      await assertFails(
        setDoc(doc(bobDb, "users", "alice", "friendRequests", "bob"), {
          from: "bob",
          to: "alice",
          senderName: "Bob",
        })
      );
    });

    test("clients cannot read or write invite attribution logs", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const aliceDb = alice.firestore();
      await assertFails(
        setDoc(doc(aliceDb, "invites", "alice_bob"), {
          fromUid: "alice",
          toUid: "bob",
        })
      );
      await assertFails(getDoc(doc(aliceDb, "invites", "alice_bob")));
    });

    test("only chat participants can read chat and messages", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const eve = testEnv.authenticatedContext("eve");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();
      const eveDb = eve.firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" })
      );
      await assertSucceeds(
        setDoc(doc(eveDb, "users", "eve"), { displayName: "Eve" })
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "chats", "c1"), {
          participants: ["alice", "bob"],
        })
      );

      await assertSucceeds(getDoc(doc(aliceDb, "chats", "c1")));
      await assertSucceeds(getDoc(doc(bobDb, "chats", "c1")));
      await assertFails(getDoc(doc(eveDb, "chats", "c1")));
    });
  });

  describe("critical paths", () => {
    test("message: friends exchange DMs in a shared chat", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" });
      await setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" });
      await setDoc(doc(aliceDb, "users", "alice", "friends", "bob"), {
        ok: true,
      });
      await setDoc(doc(bobDb, "users", "bob", "friends", "alice"), {
        ok: true,
      });

      await setDoc(doc(aliceDb, "chats", "dm_ab"), {
        participants: ["alice", "bob"],
      });

      await assertSucceeds(
        setDoc(doc(aliceDb, "chats", "dm_ab", "messages", "m1"), {
          senderId: "alice",
          text: "hey",
        })
      );

      await assertSucceeds(
        getDoc(doc(bobDb, "chats", "dm_ab", "messages", "m1"))
      );
    });

    test("friend accept: incoming request then mutual friend docs", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const aliceDb = alice.firestore();
      const bobDb = bob.firestore();

      await setDoc(doc(aliceDb, "users", "alice"), { displayName: "Alice" });
      await setDoc(doc(bobDb, "users", "bob"), { displayName: "Bob" });

      await assertSucceeds(
        setDoc(doc(bobDb, "users", "alice", "friendRequests", "bob"), {
          from: "bob",
          to: "alice",
          senderName: "Bob",
        })
      );

      await assertSucceeds(
        deleteDoc(doc(aliceDb, "users", "alice", "friendRequests", "bob"))
      );

      await assertSucceeds(
        setDoc(doc(aliceDb, "users", "alice", "friends", "bob"), { ok: true })
      );
      await assertSucceeds(
        setDoc(doc(bobDb, "users", "bob", "friends", "alice"), { ok: true })
      );

      await assertSucceeds(getDoc(doc(aliceDb, "users", "bob")));
    });
  });
});
