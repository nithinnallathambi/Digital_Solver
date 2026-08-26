import { GoogleGenAI, type Part } from '@google/genai';

export default async function (req: Request) {
    try {
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

        // 1. Parse FormData instead of JSON
        const formData = await req.formData();
        const prompt = formData.get('prompt') as string;
        
        // Extract the raw files sent from the frontend
        const imageFile = formData.get('image') as File | null;
        const audioFile = formData.get('audio') as File | null;

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

        const contentParts: Part[] = [{ text: systemInstruction + "\n\nUser Request: " + (prompt || "See attached media.") }];

        // 2. Convert raw image file to Base64 for the Gemini API
        if (imageFile) {
            const arrayBuffer = await imageFile.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString("base64");
            contentParts.push({
                inlineData: { data: base64Data, mimeType: imageFile.type || "image/jpeg" }
            });
        }
        
        // 3. Convert raw audio file to Base64 for the Gemini API
        if (audioFile) {
            const arrayBuffer = await audioFile.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString("base64");
            contentParts.push({
                inlineData: { data: base64Data, mimeType: audioFile.type || "audio/mp3" }
            });
        }

        // Generate response
        const result = await genAI.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: contentParts
        });
        const responseText = result.text || '';

        // Strip out markdown code blocks if the AI wraps the JSON
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return Response.json(JSON.parse(cleanJson));

    } catch (error: any) {
        console.error("AI Generation Error:", error);
        
        // Handle Token/Quota Limits gracefully without crashing
        const errMsg = error.message?.toLowerCase() || "";
        if (error.status === 429 || errMsg.includes('quota') || errMsg.includes('token') || errMsg.includes('429')) {
            return Response.json(
                { error: "Token limit exceeded or quota reached. Please report this to the admin or try a shorter prompt." },
                { status: 429 }
            );
        }

        // Generic fallback error
        return Response.json(
            { error: "The AI encountered a processing issue. Please refine your prompt and try again." },
            { status: 500 }
        );
    }
}

export const config = {
    path: '/api/generate',
    method: 'POST'
};
