export interface TextGenerationRequest {
  productName: string;
  productDescription: string;
  targetAudience: string;
  usp: string;
  platform: string;
  language: 'ja' | 'en';
  keigoLevel: 'casual' | 'polite' | 'formal';
  maxHeadlineLength: number;
  maxBodyLength: number;
  variantCount: number;
}

export interface GeneratedText {
  headline: string;
  body: string;
  cta: string;
  variant: number;
  model: string;
}

interface TextVariantOutput {
  headline: string;
  body: string;
  cta: string;
}

const KEIGO_INSTRUCTIONS: Record<TextGenerationRequest['keigoLevel'], string> = {
  casual: 'タメ口で親しみやすいトーン',
  polite: 'です・ます調の丁寧なトーン',
  formal: '敬語を使った格式のあるトーン',
};

const PLATFORM_CONTEXT: Record<string, string> = {
  META: 'Facebook/Instagram feed and Stories ads — visual-first, emotional appeal works well',
  GOOGLE: 'Google Search/Display ads — clear value proposition, include relevant keywords',
  X: 'X (Twitter) ads — concise, punchy, hashtag-friendly',
  TIKTOK: 'TikTok ads — casual, trendy, action-oriented, youth-focused',
  LINE_YAHOO: 'LINE/Yahoo Japan ads — trusted, family-friendly, practical benefits',
  AMAZON: 'Amazon ads — product-focused, feature highlights, reviews-informed',
  MICROSOFT: 'Microsoft/Bing ads — professional, B2B friendly, clear benefits',
};

function buildJapaneseSystemPrompt(
  req: TextGenerationRequest,
  currentMonth: number,
): string {
  const keigoInstruction = KEIGO_INSTRUCTIONS[req.keigoLevel];
  const platformCtx = PLATFORM_CONTEXT[req.platform] ?? req.platform;
  const season = getSeason(currentMonth);

  return [
    `あなたは日本語広告コピーの専門家です。`,
    `プラットフォーム: ${platformCtx}`,
    `トーン: ${keigoInstruction}`,
    `季節感: ${season}（${currentMonth}月）を意識した表現を使ってください。`,
    `文字制限: ヘッドライン最大${req.maxHeadlineLength}文字（全角1文字=2バイトとしてカウント）、`,
    `本文最大${req.maxBodyLength}文字（同様）。制限を必ず守ってください。`,
    `${req.variantCount}種類のバリエーションを生成してください。`,
  ].join('\n');
}

function buildEnglishSystemPrompt(
  req: TextGenerationRequest,
  currentMonth: number,
): string {
  const platformCtx = PLATFORM_CONTEXT[req.platform] ?? req.platform;
  const season = getSeason(currentMonth);

  return [
    `You are an expert ad copywriter.`,
    `Platform: ${platformCtx}`,
    `Season: ${season} (month ${currentMonth}) — incorporate seasonal relevance where natural.`,
    `Character limits: headline max ${req.maxHeadlineLength} chars, body max ${req.maxBodyLength} chars. Stay within limits.`,
    `Generate ${req.variantCount} distinct variants.`,
  ].join('\n');
}

function buildUserPrompt(req: TextGenerationRequest): string {
  return [
    `Product: ${req.productName}`,
    `Description: ${req.productDescription}`,
    `Target audience: ${req.targetAudience}`,
    `Unique selling point: ${req.usp}`,
  ].join('\n');
}

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return '春';
  if (month >= 6 && month <= 8) return '夏';
  if (month >= 9 && month <= 11) return '秋';
  return '冬';
}

function truncateToWidth(text: string, maxWidth: number): string {
  let width = 0;
  let result = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const charWidth = isFullWidthCode(code) ? 2 : 1;
    if (width + charWidth > maxWidth) break;
    width += charWidth;
    result += char;
  }
  return result;
}

function isFullWidthCode(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xac00 && code <= 0xd7af)
  );
}

const CLAUDE_TOOL_SCHEMA = {
  name: 'output_ad_variants',
  description: 'Output ad copy variants as structured JSON',
  input_schema: {
    type: 'object',
    properties: {
      variants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            body: { type: 'string' },
            cta: { type: 'string' },
          },
          required: ['headline', 'body', 'cta'],
        },
      },
    },
    required: ['variants'],
  },
};

const GPT_FUNCTION_SCHEMA = {
  name: 'output_ad_variants',
  description: 'Output ad copy variants as structured JSON',
  parameters: {
    type: 'object',
    properties: {
      variants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            body: { type: 'string' },
            cta: { type: 'string' },
          },
          required: ['headline', 'body', 'cta'],
        },
      },
    },
    required: ['variants'],
  },
};

function parseClaudeToolOutput(responseBody: unknown): TextVariantOutput[] {
  const body = responseBody as Record<string, unknown>;
  const content = body['content'] as unknown[];
  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (b['type'] === 'tool_use' && b['name'] === 'output_ad_variants') {
      const input = b['input'] as Record<string, unknown>;
      return input['variants'] as TextVariantOutput[];
    }
  }
  throw new Error('Claude response did not include tool_use block');
}

function parseGptFunctionOutput(responseBody: unknown): TextVariantOutput[] {
  const body = responseBody as Record<string, unknown>;
  const choices = body['choices'] as unknown[];
  const first = choices[0] as Record<string, unknown>;
  const message = first['message'] as Record<string, unknown>;
  const toolCalls = message['tool_calls'] as unknown[] | undefined;
  if (toolCalls && toolCalls.length > 0) {
    const call = toolCalls[0] as Record<string, unknown>;
    const fn = call['function'] as Record<string, unknown>;
    const args = JSON.parse(fn['arguments'] as string) as Record<string, unknown>;
    return args['variants'] as TextVariantOutput[];
  }
  throw new Error('GPT response did not include function_call');
}

async function generateWithClaude(
  systemPrompt: string,
  userPrompt: string,
): Promise<TextVariantOutput[]> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [CLAUDE_TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'output_ad_variants' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  return parseClaudeToolOutput(body);
}

async function generateWithGpt(
  systemPrompt: string,
  userPrompt: string,
): Promise<TextVariantOutput[]> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [{ type: 'function', function: GPT_FUNCTION_SCHEMA }],
      tool_choice: { type: 'function', function: { name: 'output_ad_variants' } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  return parseGptFunctionOutput(body);
}

export async function generateAdText(
  request: TextGenerationRequest,
): Promise<GeneratedText[]> {
  const currentMonth = new Date().getMonth() + 1;
  const userPrompt = buildUserPrompt(request);

  let rawVariants: TextVariantOutput[];
  let model: string;

  if (request.language === 'ja') {
    const systemPrompt = buildJapaneseSystemPrompt(request, currentMonth);
    rawVariants = await generateWithClaude(systemPrompt, userPrompt);
    model = 'claude-sonnet-4-20250514';
  } else {
    const systemPrompt = buildEnglishSystemPrompt(request, currentMonth);
    rawVariants = await generateWithGpt(systemPrompt, userPrompt);
    model = 'gpt-4o';
  }

  return rawVariants.map((v, i) => ({
    headline: truncateToWidth(v.headline, request.maxHeadlineLength),
    body: truncateToWidth(v.body, request.maxBodyLength),
    cta: v.cta,
    variant: i + 1,
    model,
  }));
}
