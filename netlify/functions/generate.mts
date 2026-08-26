// generate.mts (Next.js App Router Example)
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, imageBase64, audioBase64 } = body;

        // The system instruction forces the AI to output strictly structured JSON
        // with a conversational yet concise response, and strict A-F variable mapping.
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

        const model = genAI.getGenerativeModel({ model: 'gemini-3.7-flash' });

        // Build the multimodal payload
        const contentParts: any[] = [{ text: systemInstruction + "\n\nUser Request: " + prompt }];

        if (imageBase64) {
            contentParts.push({
                inlineData: { data: imageBase64, mimeType: "image/jpeg" }
            });
        }
        
        if (audioBase64) {
            contentParts.push({
                inlineData: { data: audioBase64, mimeType: "audio/mp3" }
            });
        }

        const result = await model.generateContent(contentParts);
        const responseText = result.response.text();

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
