import { google } from "googleapis";
import { config } from "../src/config";

if (!config.youtubeClientId || !config.youtubeClientSecret) {
  throw new Error("YOUTUBE_CLIENT_ID ve YOUTUBE_CLIENT_SECRET gerekli.");
}

const auth = new google.auth.OAuth2(
  config.youtubeClientId,
  config.youtubeClientSecret,
  config.youtubeRedirectUri
);

const url = auth.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/youtube.upload"]
});

console.log(url);

