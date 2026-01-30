import { GoogleGenAI, Modality } from "@google/genai";

const getAI = () => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Base64 helper
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve({
                inlineData: {
                    data: base64String,
                    mimeType: file.type,
                },
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const transcribeMedia = async (file: File): Promise<string> => {
    const ai = getAI();
    // Gemini 3 Flash for fast audio transcription
    const modelId = "gemini-3-flash-preview";
    
    // Only support audio/video for this. 
    // Note: Client-side file processing limits apply. Large files might fail in browser due to memory.
    const mediaPart = await fileToGenerativePart(file);

    const prompt = `
    Transcribe the following audio/video into subtitles. 
    Format the output strictly as SRT (SubRip Subtitle) format. 
    Do not include any other text, markdown, or explanation. 
    Just the SRT content.
    `;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: {
            parts: [mediaPart, { text: prompt }]
        }
    });

    return response.text || "";
};

export const analyzeMedia = async (file: File): Promise<string> => {
    const ai = getAI();
    // Gemini 3 Pro for deep video understanding
    const modelId = "gemini-3-pro-preview";
    
    const mediaPart = await fileToGenerativePart(file);

    const prompt = `
    Analyze this video/audio. 
    1. Summarize the main topic.
    2. List key vocabulary or phrases used in the media with their meanings.
    3. Identify the tone and context.
    Format as a concise markdown report.
    `;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: {
            parts: [mediaPart, { text: prompt }],
        },
        config: {
            // High thinking budget for deep analysis if needed, though for summary flash might suffice. 
            // Using Pro as requested for "Video Understanding".
            // thinkingConfig: { thinkingBudget: 1024 } // Optional: enable if complex reasoning needed
        }
    });

    return response.text || "";
};

export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
    const ai = getAI();
    const modelId = "gemini-2.5-flash-preview-tts";

    const response = await ai.models.generateContent({
        model: modelId,
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    // Decode audio
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return await audioContext.decodeAudioData(bytes.buffer);
};