# Android App

Bu Android uygulamasi GitHub Actions workflow'unu telefondan tetikler, Google ile YouTube baglantisi kurar ve gerekli repo secret'larini uygulama icinden guncelleyebilir.

## Gerekenler

- GitHub repo icinde bu proje ve `.github/workflows/generate-short.yml`
- Telefonda GitHub Fine-grained PAT:
  - Actions: Read and write
  - Secrets: Read and write
  - Contents: Read
- YouTube OAuth client bilgileri yerel build'e gomulu olmalidir
  - Bunun icin once `powershell -ExecutionPolicy Bypass -File .\scripts\sync-android-local-config.ps1` calistir
  - Bu script root `.env` icindeki degerleri `android-app/local.properties` icine tasir

## Varsayilan uygulama hedefi

- Owner: `Somethinglikeu-hub`
- Repo: `Shorty`
- Workflow: `generate-short.yml`
- Branch: `main`

## Yerel build

1. `android-app/local.properties` icinde `sdk.dir` bulunsun
2. `powershell -ExecutionPolicy Bypass -File .\scripts\sync-android-local-config.ps1`
3. `android-app/gradlew.bat assembleDebug`
3. APK cikisi:
   - `android-app/app/build/outputs/apk/debug/app-debug.apk`

## Uygulama akisi

- GitHub PAT, owner, repo, workflow ve branch bilgisini kaydet
- `Connect YouTube` ile Google hesap secicisini ac
- Secilen hesap icin refresh token al ve repo secret'larini sync et
- `Generate Short` ile workflow dispatch et
- Uygulama son run'i poll eder
- Run tamamlaninca artifact icindeki `headless-last-run.json` okunur
- Uygulama YouTube ve Studio linklerini gosterir
