import type { Config } from "@netlify/functions";
import { GoogleGenAI } from '@google/genai';

// Netlify will automatically inject this key from your environment variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async (req: Request) => {
    try {
        const { prompt } = await req.json();
        
        if (!prompt) {
            return Response.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const systemPrompt = `You are a digital logic synthesizer AI. Convert the user's natural language circuit description into a clean Boolean expression.

CRITICAL RULES:
1. Use ONLY these syntax operators:
   - AND: &
   - OR: |
   - NOT: ~
   - XOR: ^
2. Use standard uppercase variable names (A, B, C, D, etc.).
3. Output ONLY the raw expression string.
4. DO NOT use markdown, code fences (\`\`\`), quotes, or prefix with "Y =" or "Output =".

User Description: "${prompt}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: systemPrompt,
        });

        return Response.json({ expression: response.text });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Generation failed on server.' }, { status: 500 });
    }
};

export const config: Config = {
    path: "/api/generate",
    method: "POST",
};