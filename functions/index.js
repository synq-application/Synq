const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * TRIGGER: New Chat Message
 */
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
        const recipientIds = (chatData.participants || []).filter(id => id !== messageData.senderId);

        for (const recipientId of recipientIds) {
            const userDoc = await admin.firestore().collection("users").doc(recipientId).get();
            const userData = userDoc.data();

            if (userData?.pushToken) {
                const senderName = chatData.participantNames?.[messageData.senderId] || "New Message";
                await axios.post("https://exp.host/--/api/v2/push/send", {
                    to: userData.pushToken,
                    sound: "default",
                    title: senderName,
                    body: messageData.text,
                    data: { chatId: chatId }, 
                });
            }
        }
    } catch (error) {
        logger.error("Error in onMessageSent:", error);
    }
});

/**
 * TRIGGER: New Friend Request Received
 */
exports.onFriendRequestSent = onDocumentCreated({
    document: "users/{userId}/friendRequests/{requestId}",
    region: "us-central1"
}, async (event) => {
    const requestData = event.data.data();
    const { userId } = event.params; // The recipient

    try {
        const recipientDoc = await admin.firestore().collection("users").doc(userId).get();
        const recipientData = recipientDoc.data();

        if (recipientData?.pushToken) {
            // senderDisplayName should be passed when you addDoc to friendRequests in your app
            const senderName = requestData.senderName || "A user";
            
            await axios.post("https://exp.host/--/api/v2/push/send", {
                to: recipientData.pushToken,
                sound: "default",
                title: "New Friend Request 🤝",
                body: `${senderName} wants to Synq up with you!`,
                data: { type: "friend_request" }, 
            });
        }
    } catch (error) {
        logger.error("Error in onFriendRequestSent:", error);
    }
});

/**
 * TRIGGER: Friend Request Accepted
 * Watches the 'friends' subcollection for new connections.
 */
exports.onFriendAccepted = onDocumentCreated({
    document: "users/{userId}/friends/{friendId}",
    region: "us-central1"
}, async (event) => {
    const { userId, friendId } = event.params;

    try {
        // We notify the person who was "accepted" (the friendId)
        const friendDoc = await admin.firestore().collection("users").doc(friendId).get();
        const friendData = friendDoc.data();

        // We get the name of the person who just clicked "Accept" (the userId)
        const userDoc = await admin.firestore().collection("users").doc(userId).get();
        const userData = userDoc.data();

        if (friendData?.pushToken) {
            await axios.post("https://exp.host/--/api/v2/push/send", {
                to: friendData.pushToken,
                sound: "default",
                title: "Request Accepted! ✨",
                body: `${userData?.displayName || "A user"} accepted your friend request.`,
                data: { type: "friend_accepted" },
            });
        }
    } catch (error) {
        logger.error("Error in onFriendAccepted:", error);
    }
});

/**
 * CALLABLE: AI Suggestions
 */
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
);