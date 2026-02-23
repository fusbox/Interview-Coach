import { Logger } from "@/lib/logger";
import { ai, AI_MODELS } from "./ai-config";

export class TTSService {
    static async generateSpeech(text: string): Promise<{ audioData: Buffer; mimeType: string }> {
        if (!ai) throw new Error("Missing GEMINI_API_KEY");
        if (!text) throw new Error("Missing text");

        // Limit check
        if (text.length > 800) {
            Logger.warn("[TTS] Text truncated to 800 chars");
            text = text.substring(0, 800);
        }

        try {
            // 1. Call Gemini for Audio
            const wrapped = `Instruction: Read the following interview question as a hiring manager addressing a candidate. Tone: Professional, clear, slightly encouraging.\n${text}`;

            const response = await ai.models.generateContent({
                model: AI_MODELS.TTS,

                contents: {
                    parts: [{ text: wrapped }],
                },
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: 'Sulafat',
                            },
                        },
                    },
                },
            });

            const candidate = response.candidates?.[0];
            const part = candidate?.content?.parts?.[0];

            if (!part?.inlineData?.data) {
                throw new Error("Gemini API response missing audio data");
            }

            const mimeType = part.inlineData.mimeType || 'unknown';
            const base64Audio = part.inlineData.data;

            // SAFETY CHECK: If audio is > 5MB, reject it to prevent OOM
            if (base64Audio.length > 5 * 1024 * 1024) {
                console.error("[TTSService] Audio too large:", base64Audio.length);
                throw new Error("Generated audio is too large");
            }

            console.error(`[TTSService] Processing audio size: ${base64Audio.length} bytes`);

            const audioBuffer = Buffer.from(base64Audio, 'base64');

            // Case A: MP3 (send as is)
            if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
                return {
                    audioData: audioBuffer,
                    mimeType: 'audio/mpeg'
                };
            }

            // Case B: Raw PCM (audio/L16) -> Wrap in WAV Header
            if (mimeType.startsWith('audio/L16') || mimeType.startsWith('audio/pcm')) {
                const wavHeader = createWavHeader(audioBuffer.length);
                const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);
                const finalBase64 = wavBuffer.toString('base64');
                console.error(`[TTSService] Final WAV base64 size: ${finalBase64.length}`);
                return {
                    audioData: wavBuffer,
                    mimeType: 'audio/wav'
                };
            }

            // Case C: Fallback
            Logger.info(`[TTSService] Generated audio size: ${base64Audio.length} bytes`);
            return {
                audioData: audioBuffer,
                mimeType: mimeType
            };

        } catch (error) {
            Logger.error("[TTSService] Error", error);
            throw error;
        }
    }
}

// --- Helper: Create WAV Header ---
// Specs for Gemini Flash TTS: 24kHz, 1 Channel (Mono), 16-bit PCM (Source App Config)
function createWavHeader(dataLength: number) {
    const buffer = Buffer.alloc(44);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4); // File size - 8
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(1, 22); // NumChannels (1)
    buffer.writeUInt32LE(24000, 24); // SampleRate (24kHz)
    buffer.writeUInt32LE(24000 * 2, 28); // ByteRate (SampleRate * BlockAlign)
    buffer.writeUInt16LE(2, 32); // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
}
