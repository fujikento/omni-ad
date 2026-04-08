export interface VideoGenerationRequest {
  prompt: string;
  durationSeconds: 6 | 15 | 30;
  imageFrameUrls: string[];
  aspectRatio: '16:9' | '9:16' | '1:1';
}

export interface GeneratedVideo {
  url: string;
  durationSeconds: number;
  aspectRatio: string;
  model: string;
}

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 min timeout

interface RunwayTaskResponse {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  output?: string[];
  failure?: string;
  failureCode?: string;
  progress?: number;
}

function isRunwayTaskResponse(value: unknown): value is RunwayTaskResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['id'] === 'string' && typeof v['status'] === 'string';
}

function toDurationRatio(seconds: number): number {
  // Runway Gen-3 supports 5 or 10 second increments — map our values
  if (seconds <= 6) return 5;
  if (seconds <= 15) return 10;
  return 10; // 30s maps to max; real multi-clip stitching is out of v1 scope
}

async function createRunwayTask(
  request: VideoGenerationRequest,
  overrideApiKey?: string,
): Promise<string> {
  const apiKey = overrideApiKey ?? process.env['RUNWAY_API_KEY'];
  if (!apiKey) throw new Error('RUNWAY_API_KEY not configured');

  const firstFrame = request.imageFrameUrls[0] ?? null;
  const lastFrame = request.imageFrameUrls[request.imageFrameUrls.length - 1] ?? null;
  const duration = toDurationRatio(request.durationSeconds);

  const payload: Record<string, unknown> = {
    promptText: request.prompt,
    model: 'gen3a_turbo',
    duration,
    ratio: request.aspectRatio,
  };

  if (firstFrame) payload['promptImage'] = firstFrame;
  if (lastFrame && lastFrame !== firstFrame) payload['lastFrame'] = lastFrame;

  const response = await fetch(`${RUNWAY_API_BASE}/image_to_video`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'X-Runway-Version': '2024-11-06',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Runway API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  if (!isRunwayTaskResponse(body)) {
    throw new Error('Unexpected response shape from Runway API');
  }
  return body.id;
}

async function pollRunwayTask(
  taskId: string,
  overrideApiKey?: string,
): Promise<string> {
  const apiKey = overrideApiKey ?? process.env['RUNWAY_API_KEY'];
  if (!apiKey) throw new Error('RUNWAY_API_KEY not configured');

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const response = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Runway poll error ${response.status}: ${text}`);
    }

    const body: unknown = await response.json();
    if (!isRunwayTaskResponse(body)) {
      throw new Error('Unexpected poll response shape from Runway API');
    }

    if (body.status === 'SUCCEEDED') {
      const url = body.output?.[0];
      if (!url) throw new Error('Runway task succeeded but returned no output URL');
      return url;
    }

    if (body.status === 'FAILED' || body.status === 'CANCELLED') {
      const reason = body.failure ?? body.failureCode ?? body.status;
      throw new Error(`Runway task ${body.status}: ${reason}`);
    }
  }

  throw new Error(
    `Runway task ${taskId} timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface VideoGenerationOptions {
  runwayApiKey?: string;
}

export async function generateAdVideo(
  request: VideoGenerationRequest,
  options?: VideoGenerationOptions,
): Promise<GeneratedVideo> {
  const taskId = await createRunwayTask(request, options?.runwayApiKey);
  const videoUrl = await pollRunwayTask(taskId, options?.runwayApiKey);

  return {
    url: videoUrl,
    durationSeconds: request.durationSeconds,
    aspectRatio: request.aspectRatio,
    model: 'runway-gen3a-turbo',
  };
}
