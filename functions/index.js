const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ENV_VARS } = require("../src/lib/config")

exports.getSynqSuggestions = onCall(
  { secrets: ["GEMINI_API_KEY"] }, 
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    var API_KEY = ENV_VARS.GEMINI_API_KEY
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    const { shared, location } = request.data;

    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash", 
      });

      const prompt = `You are a social assistant for Synq. 
      Location: ${location}. Shared interests: ${shared.join(", ")}. 
      Suggest 3 quick, fun things for these friends to do right now in a short list. 
      No introductory text.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return { suggestion: text };
      
    } catch (error) {
      console.error("GEMINI EXECUTION ERROR:", error);
      throw new HttpsError("internal", `AI failed: ${error.message}`);
    }
  }
);