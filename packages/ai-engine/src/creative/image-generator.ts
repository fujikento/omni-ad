export interface ImageGenerationRequest {
  prompt: string;
  style: string;
  dimensions: { width: number; height: number }[];
  brandColors: string[];
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  model: string;
}

type GptImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto';

function toGptImageSize(width: number, height: number): GptImageSize {
  const ratio = width / height;
  if (ratio > 1.2) return '1536x1024';
  if (ratio < 0.8) return '1024x1536';
  return '1024x1024';
}

function buildImagePrompt(
  request: ImageGenerationRequest,
  width: number,
  height: number,
): string {
  const colorHints =
    request.brandColors.length > 0
      ? ` Use these brand colors: ${request.brandColors.join(', ')}.`
      : '';
  const styleHint = request.style ? ` Style: ${request.style}.` : '';
  const aspectHint = ` Optimized for ${width}x${height} ad format.`;
  return `${request.prompt}${styleHint}${colorHints}${aspectHint}`;
}

interface OpenAIImageResponse {
  data: { url: string }[];
}

function isOpenAIImageResponse(value: unknown): value is OpenAIImageResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v['data']);
}

async function callImagesApi(
  prompt: string,
  size: GptImageSize,
  overrideApiKey?: string,
): Promise<string> {
  const apiKey = overrideApiKey ?? process.env['OPENAI_API_KEY'];
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI Images API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  if (!isOpenAIImageResponse(body) || body.data.length === 0) {
    throw new Error('Unexpected response shape from OpenAI Images API');
  }

  const url = body.data[0]?.url;
  if (!url) throw new Error('OpenAI Images API returned no URL');
  return url;
}

export interface ImageGenerationOptions {
  openaiApiKey?: string;
}

export async function generateAdImage(
  request: ImageGenerationRequest,
  options?: ImageGenerationOptions,
): Promise<GeneratedImage[]> {
  if (request.dimensions.length === 0) {
    throw new Error('At least one dimension must be specified');
  }

  const results = await Promise.all(
    request.dimensions.map(async ({ width, height }) => {
      const size = toGptImageSize(width, height);
      const prompt = buildImagePrompt(request, width, height);
      const url = await callImagesApi(prompt, size, options?.openaiApiKey);
      return { url, width, height, model: 'gpt-image-1' };
    }),
  );

  return results;
}
