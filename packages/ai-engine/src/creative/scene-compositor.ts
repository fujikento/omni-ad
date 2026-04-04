/**
 * Scene Compositor (Douyin Model)
 *
 * Takes a VideoScript and generates visual assets for each scene
 * by leveraging existing image and video generation pipelines.
 */

import type { VideoScript, VideoScene } from './script-generator.js';
import { generateAdImage } from './image-generator.js';
import { generateAdVideo } from './video-generator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneAsset {
  sceneOrder: number;
  imageUrl: string;
  videoUrl: string;
  duration: number;
}

export interface CompositionResult {
  sceneAssets: SceneAsset[];
  totalDuration: number;
  model: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sceneToImagePrompt(scene: VideoScene, productContext: string): string {
  const styleMap: Record<VideoScene['visualStyle'], string> = {
    'product-focus': 'Clean product photography, centered subject, studio lighting',
    'lifestyle': 'Lifestyle photography, natural setting, warm tones',
    'testimonial': 'Person speaking to camera, authentic feel, soft background',
    'text-heavy': 'Bold typography overlay, vibrant background, minimal imagery',
  };

  const style = styleMap[scene.visualStyle];
  const overlay = scene.textOverlay ? ` Text overlay: "${scene.textOverlay}".` : '';

  return `${scene.description}. ${style}.${overlay} ${productContext}. Optimized for vertical video ad.`;
}

function sceneToVideoPrompt(scene: VideoScene): string {
  const movementMap: Record<VideoScene['cameraMovement'], string> = {
    'static': 'Static camera, stable composition',
    'pan': 'Slow horizontal pan',
    'zoom-in': 'Gradual zoom in toward subject',
    'zoom-out': 'Gradual zoom out revealing full scene',
  };

  const movement = movementMap[scene.cameraMovement];
  return `${scene.description}. Camera: ${movement}. Transition: ${scene.transition}.`;
}

function getAspectRatio(platform: string): '16:9' | '9:16' | '1:1' {
  // Vertical for short-form platforms, horizontal for display
  const verticalPlatforms = new Set(['TIKTOK', 'META', 'LINE_YAHOO']);
  const squarePlatforms = new Set(['AMAZON']);

  if (verticalPlatforms.has(platform)) return '9:16';
  if (squarePlatforms.has(platform)) return '1:1';
  return '16:9';
}

function getImageDimensions(
  aspectRatio: '16:9' | '9:16' | '1:1',
): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
      return { width: 1920, height: 1080 };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function composeScenes(
  script: VideoScript,
  productContext: string,
  platform: string,
): Promise<CompositionResult> {
  const aspectRatio = getAspectRatio(platform);
  const dimensions = getImageDimensions(aspectRatio);

  const sceneAssets: SceneAsset[] = [];

  for (const scene of script.scenes) {
    const imagePrompt = sceneToImagePrompt(scene, productContext);

    // 1. Generate scene image
    const images = await generateAdImage({
      prompt: imagePrompt,
      style: scene.visualStyle,
      dimensions: [dimensions],
      brandColors: [],
    });

    const imageUrl = images[0]?.url;
    if (!imageUrl) {
      throw new SceneGenerationError(
        `Failed to generate image for scene ${scene.order}`,
      );
    }

    // 2. Generate scene video clip from the image
    const videoPrompt = sceneToVideoPrompt(scene);
    const videoDuration = scene.duration <= 6 ? 6 : scene.duration <= 15 ? 15 : 30;

    const video = await generateAdVideo({
      prompt: videoPrompt,
      durationSeconds: videoDuration as 6 | 15 | 30,
      imageFrameUrls: [imageUrl],
      aspectRatio,
    });

    sceneAssets.push({
      sceneOrder: scene.order,
      imageUrl,
      videoUrl: video.url,
      duration: scene.duration,
    });
  }

  return {
    sceneAssets,
    totalDuration: script.duration,
    model: 'gpt-image-1+runway-gen3a-turbo',
  };
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class SceneGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneGenerationError';
  }
}
