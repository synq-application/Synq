const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const logger = require("firebase-functions/logger");

exports.getSynqSuggestions = onCall(
    {
        secrets: ["GEMINI_API_KEY", "GOOGLE_MAPS_API_KEY"],
        region: "us-central1",
    },
    async (request) => {
        if (!request.auth) {
            logger.error("Auth Error: User not authenticated");
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
            )}, suggest 3 ${category} venues.
Return ONLY a JSON array:
[{"name":"Venue Name"}]`;

            const result = await model.generateContent(prompt);
            const rawText = result?.response?.text?.() || "";
            const cleaned = rawText.replace(/```json|```/g, "").trim();

            let venues;
            try {
                venues = JSON.parse(cleaned);
            } catch (parseErr) {
                logger.error(">>> STEP 2 ERROR: Failed to parse Gemini JSON", {
                    cleaned,
                    error: parseErr?.message,
                });
                throw new HttpsError("internal", "AI response was not valid JSON.");
            }

            logger.info(">>> STEP 2: Gemini suggested venues", { venues });

            const enrichedSuggestions = [];

            for (const venue of venues) {
                try {
                    logger.info(`>>> STEP 3: Searching Google for: ${venue.name}`);

                    const googleRes = await axios.post(
                        "https://places.googleapis.com/v1/places:searchText",
                        { textQuery: `${venue.name} in ${location}` },
                        {
                            headers: {
                                "Content-Type": "application/json",
                                "X-Goog-Api-Key": googleKey,

                                // ✅ Include shortFormattedAddress so you can show "Dupont Circle, Washington, DC"
                                "X-Goog-FieldMask":
                                    "places.displayName,places.rating,places.photos,places.shortFormattedAddress,places.formattedAddress",
                            },
                        }
                    );

                    const place = googleRes.data.places?.[0];
                    let imageUrl = "https://via.placeholder.com/150";

                    if (place?.photos?.length > 0) {
                        const photoName = place.photos[0].name;
                        imageUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${googleKey}&maxWidthPx=400`;
                        logger.info(`>>> Image found for ${venue.name}`);
                    } else {
                        logger.warn(`>>> No photos found for ${venue.name}`);
                    }

                    const shortLoc =
                        place?.shortFormattedAddress ||
                        place?.formattedAddress ||
                        "Location not available";

                    enrichedSuggestions.push({
                        ...venue,
                        rating: place?.rating ? Number(place.rating).toFixed(1) : "4.0",
                        imageUrl,
                        location: shortLoc,
                        address: place?.formattedAddress || "Address not available",
                    });
                } catch (e) {
                    logger.error(`>>> STEP 3 ERROR: Google enrichment failed for ${venue.name}`, {
                        error: e.response?.data || e.message,
                    });

                    enrichedSuggestions.push({
                        ...venue,
                        imageUrl: "https://via.placeholder.com/150",
                        rating: "4.0",
                        location: "Location not available",
                    });
                }
            }

            logger.info(">>> FINAL: Returning results", { count: enrichedSuggestions.length });
            return { suggestions: enrichedSuggestions };
        } catch (error) {
            logger.error(">>> TOP-LEVEL CRITICAL ERROR:", error);
            throw new HttpsError("internal", error?.message || "Unknown error");
        }
    }
);
