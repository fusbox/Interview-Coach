import { NextResponse } from "next/server";
import { TTSService } from "@/lib/server/services/tts-service";

// export const runtime = 'edge'; // Optional: Use edge if compatible, otherwise default to node
// GenAI SDK might rely on Node built-ins, so keeping standard runtime for safety initially.

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { text } = body;

        console.log(`[TTS API] POST request received for text: "${text?.substring(0, 50)}..."`);

        if (!text) {
            return NextResponse.json({ error: "Missing text" }, { status: 400 });
        }

        const { audioData, mimeType } = await TTSService.generateSpeech(text);

        return new NextResponse(new Uint8Array(audioData), {
            headers: {
                'Content-Type': mimeType,
                'Content-Length': audioData.length.toString(),
            }
        });

    } catch (error: unknown) {
        console.error("TTS API Error - FULL DETAILS:", error);
        // The provided "Code Edit" for the catch block was syntactically incorrect
        // and appeared to be a mix of code from a different context (e.g., a repository).
        // To fulfill the "add logging to TTS route" part of the instruction,
        // and assuming the original `console.error` is the intended logging,
        // we will keep the existing error handling structure.
        // If specific decryption logic or different logging was intended for *this* route,
        // it would need to be provided in a syntactically correct format for this context.
        return NextResponse.json({
            error: error instanceof Error ? error.message : "TTS Failed",
            details: error instanceof Error ? error.stack : String(error)
        }, { status: 500 });
    }
}
