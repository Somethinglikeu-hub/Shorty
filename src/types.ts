export type JobStatus =
  | "queued"
  | "writing"
  | "sourcing"
  | "voicing"
  | "captioning"
  | "rendering"
  | "uploading"
  | "uploaded_private"
  | "needs_attention"
  | "failed";

export type JobOperation = "full" | "regenerate-audio" | "regenerate-visuals";
export type PrivacyStatus = "private" | "unlisted";

export interface StoryPlan {
  topic: string;
  hook: string;
  beats: string[];
  outro: string;
  fullScript: string;
  title: string;
  description: string;
  hashtags: string[];
  visualQueries: string[];
  shortSummary: string;
}

export interface StoryReview {
  accepted: boolean;
  clicheScore: number;
  similarityScore: number;
  notes: string;
  revisedPlan?: Partial<StoryPlan>;
}

export interface VideoClipAsset {
  id: string;
  query: string;
  width: number;
  height: number;
  durationSeconds: number;
  photographer: string;
  photographerUrl?: string;
  pexelsUrl?: string;
  localPath: string;
  fileUrl: string;
}

export interface CaptionWord {
  text: string;
  durationSeconds: number;
}

export interface CaptionCue {
  startSeconds: number;
  endSeconds: number;
  words: CaptionWord[];
  plainText: string;
}

export interface JobEvent {
  at: string;
  type: string;
  message: string;
}

export interface JobError {
  at: string;
  step: string;
  message: string;
  recoverable: boolean;
  details?: string;
}

export interface ShortyJob {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  operation: JobOperation;
  input: {
    seedTopic?: string;
    privacy: PrivacyStatus;
    trigger: "pwa" | "n8n";
  };
  content: {
    topic?: string;
    hook?: string;
    beats: string[];
    outro?: string;
    fullScript?: string;
    title?: string;
    description?: string;
    hashtags: string[];
    visualQueries: string[];
    shortSummary?: string;
    review?: StoryReview & { attemptCount: number };
    wordCount?: number;
    creditsText?: string;
  };
  assets: {
    clips: VideoClipAsset[];
    fallbackVisuals: boolean;
    localMusicPath?: string;
    generatedMusicPath?: string;
    visualsPath?: string;
  };
  audio: {
    voiceName: string;
    stylePrompt: string;
    sourcePath?: string;
    durationSeconds?: number;
  };
  captions: {
    cues: CaptionCue[];
    assPath?: string;
  };
  render: {
    videoPath?: string;
    previewUrl?: string;
  };
  youtube: {
    videoId?: string;
    url?: string;
    studioUrl?: string;
    processingStatus?: string;
    uploadedAt?: string;
  };
  events: JobEvent[];
  error?: JobError;
}

export interface JobSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  operation: JobOperation;
  topic?: string;
  title?: string;
  previewUrl?: string;
  youtubeUrl?: string;
  privacy: PrivacyStatus;
  seedTopic?: string;
  lastError?: string;
}

