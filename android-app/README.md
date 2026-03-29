# Android App

Bu Android uygulamasi GitHub Actions workflow'unu telefondan tetikler ve son run durumunu izler.

## Gerekenler

- GitHub repo icinde bu proje ve `.github/workflows/generate-short.yml`
- Repo secrets:
  - `GEMINI_API_KEY`
  - `PEXELS_API_KEY`
  - `YOUTUBE_CLIENT_ID`
  - `YOUTUBE_CLIENT_SECRET`
  - `YOUTUBE_REFRESH_TOKEN`
- Telefonda GitHub Fine-grained PAT:
  - Actions: Read and write
  - Contents: Read

## Varsayilan uygulama hedefi

- Owner: `Somethinglikeu-hub`
- Repo: `Shorty`
- Workflow: `generate-short.yml`
- Branch: `main`

## Yerel build

1. `android-app/local.properties` icine Android SDK yolunu yaz
2. `android-app/gradlew.bat assembleDebug`
3. APK cikisi:
   - `android-app/app/build/outputs/apk/debug/app-debug.apk`

## Uygulama akisi

- GitHub PAT, owner, repo, workflow ve branch bilgisini kaydet
- `Generate Short` ile workflow dispatch et
- Uygulama son run'i poll eder
- Run tamamlaninca artifact icindeki `headless-last-run.json` okunur
- Uygulama YouTube ve Studio linklerini gosterir
