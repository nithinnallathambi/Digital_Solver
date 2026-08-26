import type { Config } from "@netlify/functions";
import { GoogleGenAI } from '@google/genai';

// Initialize the NEW Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default async (req: Request) => {
    try {
        // 1. Parse FormData instead of JSON (supports text, images, and audio)
        const formData = await req.formData();
        const prompt = formData.get('prompt') as string;
        const imageFile = formData.get('image') as File | null;
        const audioFile = formData.get('audio') as File | null;

        // Ensure the user sent at least something
        if (!prompt && !imageFile && !audioFile) {
            return Response.json({ error: 'Please provide a prompt, image, or audio.' }, { status: 400 });
        }

        // 2. Define strict System Instructions
        const systemInstruction = `
        You are an interactive digital logic engineering assistant. 
        Analyze the user's problem statement and design a logic circuit.
        
        RULES:
        1. Keep your English response extremely short, to the point, and conversational.
        2. Assign variables using ONLY letters A through F.
        3. Use ONLY these symbols for the expression: & (AND), | (OR), ~ (NOT), ^ (XOR).
        
        You MUST respond with a valid JSON object exactly like this:
        {
            "chat_response": "Here is the logic for your 3-input voter circuit.",
            "expression": "A & B | B & C | A & C",
            "mapping": { "A": "Temperature Sensor", "B": "Pressure Switch", "C": "Override" }
        }
        `;

        // 3. Build the payload for the new SDK
        const contentParts: any[] = [];
        
        if (prompt) {
            contentParts.push(`User Request: ${prompt}`);
        } else {
            contentParts.push("Analyze the attached media and design the logic circuit.");
        }

        // Convert raw image to Base64
        if (imageFile) {
            const arrayBuffer = await imageFile.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString("base64");
            contentParts.push({
                inlineData: { data: base64Data, mimeType: imageFile.type || "image/jpeg" }
            });
        }
        
        // Convert raw audio to Base64
        if (audioFile) {
            const arrayBuffer = await audioFile.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString("base64");
            contentParts.push({
                inlineData: { data: base64Data, mimeType: audioFile.type || "audio/mp3" }
            });
        }

        // 4. Generate content using the new SDK syntax
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contentParts,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json" // Forces Gemini to output pure JSON
            }
        });

        // 5. Parse and return the response
        // Note: In the new SDK, `response.text` is a property, NOT a function()
        const responseText = response.text || "{}";

        // Strip out markdown code blocks just in case Gemini includes them
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return Response.json(JSON.parse(cleanJson));

    } catch (error: any) {
        console.error("AI Generation Error:", error);
        
        const errMsg = error.message?.toLowerCase() || "";
        if (error.status === 429 || errMsg.includes('quota') || errMsg.includes('token') || errMsg.includes('429')) {
            return Response.json(
                { error: "Token limit exceeded or quota reached. Please try a shorter prompt." },
                { status: 429 }
            );
        }

        return Response.json(
            { error: "The AI encountered a processing issue. Please refine your prompt and try again." },
            { status: 500 }
        );
    }
};

// Netlify routing configuration
export const config: Config = {
    path: "/api/generate",
    method: "POST",
};
