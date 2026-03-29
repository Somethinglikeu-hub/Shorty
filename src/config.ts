import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("3000"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  DATA_DIR: z.string().default("./data"),
  SHORTY_ADMIN_TOKEN: z.string().optional(),
  SHORTY_ADMIN_USERNAME: z.string().default("admin"),
  JOB_CONCURRENCY: z.string().default("1"),
  FFMPEG_FONT_FILE: z
    .string()
    .default("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_TEXT_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_TTS_MODEL: z.string().default("gemini-2.5-flash-preview-tts"),
  SHORTY_VOICE_NAME: z.string().default("Sulafat"),
  PEXELS_API_KEY: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REDIRECT_URI: z.string().default("http://localhost:3000/oauth2callback"),
  YOUTUBE_REFRESH_TOKEN: z.string().optional(),
  YOUTUBE_DEFAULT_CATEGORY_ID: z.string().default("22"),
  YOUTUBE_DEFAULT_LANGUAGE: z.string().default("tr")
});

const env = envSchema.parse(process.env);

export const config = {
  port: Number(env.PORT),
  publicBaseUrl: env.PUBLIC_BASE_URL,
  dataDir: path.resolve(process.cwd(), env.DATA_DIR),
  adminToken: env.SHORTY_ADMIN_TOKEN?.trim() || "",
  adminUsername: env.SHORTY_ADMIN_USERNAME,
  jobConcurrency: Math.max(1, Number(env.JOB_CONCURRENCY) || 1),
  ffmpegFontFile: env.FFMPEG_FONT_FILE,
  geminiApiKey: env.GEMINI_API_KEY?.trim() || "",
  geminiTextModel: env.GEMINI_TEXT_MODEL,
  geminiTtsModel: env.GEMINI_TTS_MODEL,
  shortyVoiceName: env.SHORTY_VOICE_NAME,
  pexelsApiKey: env.PEXELS_API_KEY?.trim() || "",
  youtubeClientId: env.YOUTUBE_CLIENT_ID?.trim() || "",
  youtubeClientSecret: env.YOUTUBE_CLIENT_SECRET?.trim() || "",
  youtubeRedirectUri: env.YOUTUBE_REDIRECT_URI,
  youtubeRefreshToken: env.YOUTUBE_REFRESH_TOKEN?.trim() || "",
  youtubeDefaultCategoryId: env.YOUTUBE_DEFAULT_CATEGORY_ID,
  youtubeDefaultLanguage: env.YOUTUBE_DEFAULT_LANGUAGE
};

export type AppConfig = typeof config;

