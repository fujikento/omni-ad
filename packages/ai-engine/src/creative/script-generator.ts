/**
 * Script-to-Video Pipeline: Script Generator (Douyin Model)
 *
 * Generates structured video scripts from campaign briefs using Claude API.
 * Adapted from Douyin's content-first short-video production pattern.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoScene {
  order: number;
  duration: number;
  description: string;
  textOverlay: string | null;
  transition: 'cut' | 'fade' | 'slide' | 'zoom';
  cameraMovement: 'static' | 'pan' | 'zoom-in' | 'zoom-out';
  visualStyle: 'product-focus' | 'lifestyle' | 'testimonial' | 'text-heavy';
}

export interface VideoScript {
  title: string;
  duration: number;
  scenes: VideoScene[];
  voiceover: { text: string; language: string; tone: string };
  music: { mood: string; tempo: string };
  callToAction: { text: string; timing: number };
}

export interface ScriptGenerationInput {
  productName: string;
  productDescription: string;
  targetAudience: string;
  campaignGoal: string;
  platform: string;
  duration: 6 | 15 | 30;
  language: 'ja' | 'en';
  keigoLevel: 'casual' | 'polite' | 'formal';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEIGO_INSTRUCTIONS: Record<ScriptGenerationInput['keigoLevel'], string> = {
  casual: 'タメ口で親しみやすいトーン',
  polite: 'です・ます調の丁寧なトーン',
  formal: '敬語を使った格式のあるトーン',
};

const PLATFORM_GUIDANCE: Record<string, string> = {
  META: 'Instagram Reels / Facebook Stories向け。最初の1秒でアテンションを掴む。',
  GOOGLE: 'YouTube Shorts / Display向け。明確な価値提案を早めに提示。',
  X: 'X (Twitter) 動画広告向け。パンチのある短い動画。',
  TIKTOK: 'TikTok向け。トレンド感があり、UGC風の自然なスタイル。',
  LINE_YAHOO: 'LINE VOOM / Yahoo向け。信頼感があり、家族にも安心。',
  AMAZON: 'Amazon動画広告向け。商品フォーカス、機能ハイライト。',
  MICROSOFT: 'Microsoft広告向け。プロフェッショナルでB2Bフレンドリー。',
};

// ---------------------------------------------------------------------------
// Claude Tool Schema
// ---------------------------------------------------------------------------

const CLAUDE_TOOL_SCHEMA = {
  name: 'output_video_script',
  description: 'Output a structured video script as JSON',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Video title' },
      duration: { type: 'number', description: 'Total duration in seconds' },
      scenes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            order: { type: 'number' },
            duration: { type: 'number' },
            description: { type: 'string' },
            textOverlay: { type: ['string', 'null'] },
            transition: {
              type: 'string',
              enum: ['cut', 'fade', 'slide', 'zoom'],
            },
            cameraMovement: {
              type: 'string',
              enum: ['static', 'pan', 'zoom-in', 'zoom-out'],
            },
            visualStyle: {
              type: 'string',
              enum: ['product-focus', 'lifestyle', 'testimonial', 'text-heavy'],
            },
          },
          required: [
            'order',
            'duration',
            'description',
            'textOverlay',
            'transition',
            'cameraMovement',
            'visualStyle',
          ],
        },
      },
      voiceover: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          language: { type: 'string' },
          tone: { type: 'string' },
        },
        required: ['text', 'language', 'tone'],
      },
      music: {
        type: 'object',
        properties: {
          mood: { type: 'string' },
          tempo: { type: 'string' },
        },
        required: ['mood', 'tempo'],
      },
      callToAction: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          timing: { type: 'number' },
        },
        required: ['text', 'timing'],
      },
    },
    required: ['title', 'duration', 'scenes', 'voiceover', 'music', 'callToAction'],
  },
} as const;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSystemPrompt(input: ScriptGenerationInput): string {
  const keigoInstruction = KEIGO_INSTRUCTIONS[input.keigoLevel];
  const platformGuidance = PLATFORM_GUIDANCE[input.platform] ?? input.platform;

  if (input.language === 'ja') {
    return [
      'あなたは広告動画スクリプトの専門家です。',
      '与えられた商品情報から、プラットフォームに最適化された動画スクリプトを作成してください。',
      '',
      `プラットフォーム: ${platformGuidance}`,
      `トーン: ${keigoInstruction}`,
      `動画の長さ: ${input.duration}秒`,
      '',
      'ルール:',
      '- シーンの合計秒数が動画の長さと一致すること',
      '- 最初の1-2秒でフック（注目を引く要素）を入れること',
      '- 各シーンに具体的なビジュアル指示を含めること',
      '- CTAは動画の最後に配置すること',
      '- ナレーションは自然な日本語で、動画の長さに合った分量にすること',
    ].join('\n');
  }

  return [
    'You are an expert video ad script creator.',
    'Create a platform-optimized video script from the given product information.',
    '',
    `Platform: ${platformGuidance}`,
    `Duration: ${input.duration} seconds`,
    '',
    'Rules:',
    '- Total scene durations must equal the video duration',
    '- Include a hook in the first 1-2 seconds',
    '- Each scene must have specific visual direction',
    '- Place the CTA at the end of the video',
    '- Voiceover should be natural and fit within the duration',
  ].join('\n');
}

function buildUserPrompt(input: ScriptGenerationInput): string {
  return [
    `Product: ${input.productName}`,
    `Description: ${input.productDescription}`,
    `Target audience: ${input.targetAudience}`,
    `Campaign goal: ${input.campaignGoal}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseClaudeToolOutput(responseBody: unknown): VideoScript {
  const body = responseBody as Record<string, unknown>;
  const content = body['content'] as unknown[];

  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (b['type'] === 'tool_use' && b['name'] === 'output_video_script') {
      return b['input'] as VideoScript;
    }
  }

  throw new Error('Claude response did not include tool_use block for output_video_script');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateVideoScript(
  input: ScriptGenerationInput,
): Promise<VideoScript> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(input);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [CLAUDE_TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'output_video_script' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  const script = parseClaudeToolOutput(body);

  // Validate scene durations sum to total duration
  const totalSceneDuration = script.scenes.reduce(
    (sum, scene) => sum + scene.duration,
    0,
  );

  if (Math.abs(totalSceneDuration - script.duration) > 1) {
    // Allow 1 second tolerance due to rounding
    throw new ScriptValidationError(
      `Scene durations (${totalSceneDuration}s) do not match total duration (${script.duration}s)`,
    );
  }

  return script;
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class ScriptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScriptValidationError';
  }
}
