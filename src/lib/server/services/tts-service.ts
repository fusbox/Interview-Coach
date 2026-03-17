import { Logger } from "@/lib/logger";
import { incrementMetric, observeMetric } from "@/lib/server/metrics";
import { ai, AI_MODELS } from "./ai-config";

export class TTSService {
    static async generateSpeech(text: string): Promise<{ audioData: Buffer; mimeType: string }> {
        const startedAt = Date.now();
        if (!ai) throw new Error("Missing GEMINI_API_KEY");
        if (!text) throw new Error("Missing text");

        // Limit check
        if (text.length > 800) {
            Logger.warn("[TTS] Text truncated to 800 chars");
            text = text.substring(0, 800);
        }

        try {
            // 1. Call Gemini for Audio
            Logger.info("Generating speech", {
                actorType: "service",
                textPreview: `${text.substring(0, 50)}...`
            }, "TTSService");
            const wrapped = `Instruction: Read the following interview question as a hiring manager addressing a candidate. Tone: Professional, clear, slightly encouraging.\n${text}`;

            const response = await ai.models.generateContent({
                model: AI_MODELS.TTS,

                contents: {
                    parts: [{ text: wrapped }],
                },
                config: {
                    responseModalities: ['AUDIO'],
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
                Logger.error("Generated audio rejected for size", {
                    actorType: "service",
                    errorCode: "TTS_AUDIO_TOO_LARGE",
                    audioSize: base64Audio.length
                }, "TTSService");
                throw new Error("Generated audio is too large");
            }

            Logger.debug("Processing generated audio", {
                actorType: "service",
                audioSize: base64Audio.length,
                mimeType
            }, "TTSService");

            const audioBuffer = Buffer.from(base64Audio, 'base64');

            // Case A: MP3 (send as is)
            if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
                incrementMetric("ai_requests_total", { operation: "tts", outcome: "success" });
                observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tts", outcome: "success" });
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
                Logger.debug("Generated WAV wrapper", {
                    actorType: "service",
                    finalAudioSize: finalBase64.length
                }, "TTSService");
                incrementMetric("ai_requests_total", { operation: "tts", outcome: "success" });
                observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tts", outcome: "success" });
                return {
                    audioData: wavBuffer,
                    mimeType: 'audio/wav'
                };
            }

            // Case C: Fallback
            Logger.info(`[TTSService] Generated audio size: ${base64Audio.length} bytes`);
            incrementMetric("ai_requests_total", { operation: "tts", outcome: "success" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tts", outcome: "success" });
            return {
                audioData: audioBuffer,
                mimeType: mimeType
            };

        } catch (error) {
            Logger.error("[TTSService] Error", error);
            incrementMetric("ai_requests_total", { operation: "tts", outcome: "error" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tts", outcome: "error" });
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
