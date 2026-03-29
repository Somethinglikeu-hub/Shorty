import { google } from "googleapis";
import { config } from "../src/config";

const code = process.argv[2];
if (!code) {
  throw new Error("Kullanım: npm run youtube:exchange-code -- <authorization_code>");
}

if (!config.youtubeClientId || !config.youtubeClientSecret) {
  throw new Error("YOUTUBE_CLIENT_ID ve YOUTUBE_CLIENT_SECRET gerekli.");
}

const auth = new google.auth.OAuth2(
  config.youtubeClientId,
  config.youtubeClientSecret,
  config.youtubeRedirectUri
);

async function main() {
  const { tokens } = await auth.getToken(code);
  console.log(JSON.stringify(tokens, null, 2));
}

void main();

