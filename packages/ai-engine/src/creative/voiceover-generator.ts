/**
 * Voiceover Generator
 *
 * Generates text-to-speech audio using OpenAI TTS API.
 * Part of the Script-to-Video pipeline (Douyin Model).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TtsVoice = 'alloy' | 'nova' | 'onyx';
type TtsModel = 'tts-1' | 'tts-1-hd';

export interface VoiceoverRequest {
  text: string;
  language: 'ja' | 'en';
  tone: 'neutral' | 'energetic' | 'calm' | 'professional';
}

export interface VoiceoverResult {
  audioUrl: string;
  voice: TtsVoice;
  model: TtsModel;
  durationEstimateSeconds: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TONE_TO_VOICE: Record<VoiceoverRequest['tone'], TtsVoice> = {
  neutral: 'alloy',
  energetic: 'nova',
  calm: 'alloy',
  professional: 'onyx',
};

// Rough estimate: Japanese ~5 chars/sec, English ~15 chars/sec for natural speech
const CHARS_PER_SECOND: Record<VoiceoverRequest['language'], number> = {
  ja: 5,
  en: 15,
};

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

interface TtsErrorResponse {
  error: { message: string; type: string };
}

function isTtsErrorResponse(value: unknown): value is TtsErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['error'] === 'object' && v['error'] !== null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface VoiceoverOptions {
  openaiApiKey?: string;
}

export async function generateVoiceover(
  request: VoiceoverRequest,
  options?: VoiceoverOptions,
): Promise<VoiceoverResult> {
  const apiKey = options?.openaiApiKey ?? process.env['OPENAI_API_KEY'];
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  if (request.text.trim().length === 0) {
    throw new VoiceoverValidationError('Voiceover text must not be empty');
  }

  const voice = TONE_TO_VOICE[request.tone];
  const model: TtsModel = 'tts-1';

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: request.text,
      voice,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    const errorMessage = isTtsErrorResponse(errorBody)
      ? errorBody.error.message
      : `HTTP ${response.status}`;

    throw new VoiceoverGenerationError(
      `OpenAI TTS API error: ${errorMessage}`,
    );
  }

  // The TTS API returns raw audio bytes. In a production setup,
  // we would upload to cloud storage and return the URL.
  // For now, we convert to a data URL or expect the caller to handle the blob.
  const audioBuffer = await response.arrayBuffer();
  const base64Audio = bufferToBase64(audioBuffer);
  const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

  const charsPerSec = CHARS_PER_SECOND[request.language];
  const durationEstimateSeconds = Math.ceil(request.text.length / charsPerSec);

  return {
    audioUrl,
    voice,
    model,
    durationEstimateSeconds,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class VoiceoverValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceoverValidationError';
  }
}

export class VoiceoverGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceoverGenerationError';
  }
}
