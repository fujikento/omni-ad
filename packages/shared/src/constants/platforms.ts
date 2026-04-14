import { Platform } from '../types/platform.js';
import type { RateLimitConfig } from '../types/platform.js';
import type { PlatformCreativeSpecs } from '../types/creative.js';

export const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  [Platform.META]: 'Meta（Facebook/Instagram）',
  [Platform.GOOGLE]: 'Google広告',
  [Platform.X]: 'X（旧Twitter）',
  [Platform.TIKTOK]: 'TikTok広告',
  [Platform.LINE_YAHOO]: 'LINE/Yahoo!広告',
  [Platform.AMAZON]: 'Amazon広告',
  [Platform.MICROSOFT]: 'Microsoft広告',
};

/** Short names for compact UI (badges, tight table cells). */
export const PLATFORM_SHORT_NAMES: Record<Platform, string> = {
  [Platform.META]: 'Meta',
  [Platform.GOOGLE]: 'Google',
  [Platform.X]: 'X',
  [Platform.TIKTOK]: 'TikTok',
  [Platform.LINE_YAHOO]: 'LINE/Yahoo',
  [Platform.AMAZON]: 'Amazon',
  [Platform.MICROSOFT]: 'Microsoft',
};

/**
 * Official brand colors for use as *identification accents* only
 * (e.g. colored dots, left-borders, subtle logo tints). Not for large
 * fills or replacing the product's own accent system. Sources: each
 * platform's public brand guidelines.
 */
export const PLATFORM_BRAND_COLORS: Record<Platform, string> = {
  [Platform.META]: '#1877F2',
  [Platform.GOOGLE]: '#4285F4',
  [Platform.X]: '#0F1419',
  [Platform.TIKTOK]: '#FF0050',
  [Platform.LINE_YAHOO]: '#06C755',
  [Platform.AMAZON]: '#FF9900',
  [Platform.MICROSOFT]: '#00A4EF',
};

/** Slug used for asset filenames (`/platforms/{slug}.svg`). */
export const PLATFORM_SLUGS: Record<Platform, string> = {
  [Platform.META]: 'meta',
  [Platform.GOOGLE]: 'google',
  [Platform.X]: 'x',
  [Platform.TIKTOK]: 'tiktok',
  [Platform.LINE_YAHOO]: 'line',
  [Platform.AMAZON]: 'amazon',
  [Platform.MICROSOFT]: 'microsoft',
};

export const PLATFORM_CREATIVE_SPECS: Record<Platform, PlatformCreativeSpecs> = {
  [Platform.META]: {
    platform: Platform.META,
    maxHeadlineLength: 40,
    maxBodyLength: 125,
    supportedFormats: ['jpg', 'png', 'gif', 'mp4', 'mov'],
    dimensions: [
      { name: 'フィード（正方形）', width: 1080, height: 1080 },
      { name: 'フィード（横長）', width: 1200, height: 628 },
      { name: 'ストーリーズ', width: 1080, height: 1920 },
      { name: 'リール', width: 1080, height: 1920 },
    ],
    maxFileSizeMb: 30,
    maxVideoDurationSeconds: 240,
  },
  [Platform.GOOGLE]: {
    platform: Platform.GOOGLE,
    maxHeadlineLength: 30,
    maxBodyLength: 90,
    supportedFormats: ['jpg', 'png', 'gif', 'svg', 'mp4'],
    dimensions: [
      { name: 'レクタングル（大）', width: 336, height: 280 },
      { name: 'レクタングル（中）', width: 300, height: 250 },
      { name: 'リーダーボード', width: 728, height: 90 },
      { name: 'ハーフページ', width: 300, height: 600 },
      { name: 'ビルボード', width: 970, height: 250 },
    ],
    maxFileSizeMb: 5,
    maxVideoDurationSeconds: null,
  },
  [Platform.X]: {
    platform: Platform.X,
    maxHeadlineLength: 70,
    maxBodyLength: 280,
    supportedFormats: ['jpg', 'png', 'gif', 'mp4'],
    dimensions: [
      { name: '単一画像', width: 1200, height: 675 },
      { name: 'アプリカード', width: 800, height: 418 },
    ],
    maxFileSizeMb: 15,
    maxVideoDurationSeconds: 140,
  },
  [Platform.TIKTOK]: {
    platform: Platform.TIKTOK,
    maxHeadlineLength: 100,
    maxBodyLength: 100,
    supportedFormats: ['mp4', 'mov', 'mpeg', 'avi'],
    dimensions: [
      { name: '縦型動画', width: 1080, height: 1920 },
      { name: '横型動画', width: 1920, height: 1080 },
      { name: '正方形動画', width: 1080, height: 1080 },
    ],
    maxFileSizeMb: 500,
    maxVideoDurationSeconds: 60,
  },
  [Platform.LINE_YAHOO]: {
    platform: Platform.LINE_YAHOO,
    maxHeadlineLength: 40,
    maxBodyLength: 90,
    supportedFormats: ['jpg', 'png', 'gif', 'mp4'],
    dimensions: [
      { name: 'スクエア', width: 1080, height: 1080 },
      { name: 'ランドスケープ', width: 1200, height: 628 },
      { name: 'ストーリーズ', width: 1080, height: 1920 },
    ],
    maxFileSizeMb: 20,
    maxVideoDurationSeconds: 60,
  },
  [Platform.AMAZON]: {
    platform: Platform.AMAZON,
    maxHeadlineLength: 50,
    maxBodyLength: 150,
    supportedFormats: ['jpg', 'png', 'gif'],
    dimensions: [
      { name: 'モバイルバナー', width: 320, height: 50 },
      { name: 'レクタングル', width: 300, height: 250 },
      { name: 'リーダーボード', width: 728, height: 90 },
      { name: 'ビルボード', width: 970, height: 250 },
    ],
    maxFileSizeMb: 2,
    maxVideoDurationSeconds: null,
  },
  [Platform.MICROSOFT]: {
    platform: Platform.MICROSOFT,
    maxHeadlineLength: 30,
    maxBodyLength: 90,
    supportedFormats: ['jpg', 'png', 'gif'],
    dimensions: [
      { name: 'レクタングル', width: 300, height: 250 },
      { name: 'リーダーボード', width: 728, height: 90 },
      { name: 'ハーフページ', width: 300, height: 600 },
    ],
    maxFileSizeMb: 5,
    maxVideoDurationSeconds: null,
  },
};

export const PLATFORM_RATE_LIMITS: Record<Platform, RateLimitConfig> = {
  [Platform.META]: {
    maxRequestsPerHour: 200,
    maxRequestsPerDay: 4000,
    burstLimit: 50,
  },
  [Platform.GOOGLE]: {
    maxRequestsPerHour: 1000,
    maxRequestsPerDay: 15000,
    burstLimit: 100,
  },
  [Platform.X]: {
    maxRequestsPerHour: 300,
    maxRequestsPerDay: 5000,
    burstLimit: 25,
  },
  [Platform.TIKTOK]: {
    maxRequestsPerHour: 500,
    maxRequestsPerDay: 10000,
    burstLimit: 60,
  },
  [Platform.LINE_YAHOO]: {
    maxRequestsPerHour: 600,
    maxRequestsPerDay: 10000,
    burstLimit: 80,
  },
  [Platform.AMAZON]: {
    maxRequestsPerHour: 400,
    maxRequestsPerDay: 8000,
    burstLimit: 40,
  },
  [Platform.MICROSOFT]: {
    maxRequestsPerHour: 500,
    maxRequestsPerDay: 10000,
    burstLimit: 60,
  },
};
