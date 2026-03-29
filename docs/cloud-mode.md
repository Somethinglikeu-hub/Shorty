# Cloud Mode Without Your PC

Bu modda sistem telefonundan tetiklenir ama hesaplama GitHub Actions runner'inda yapilir.

## Neden bu yol?

- PC acik kalmak zorunda degil
- Ucretsiz baslamak kolay
- Elle tetikleme telefondan yapilabilir
- Video private yuklenir, sen sonra YouTube Studio'dan kontrol edersin

## Nasil calisir?

1. Bu klasoru GitHub repo olarak push et
2. Repo `Settings -> Secrets and variables -> Actions` altina su secret'lari gir:
   - `GEMINI_API_KEY`
   - `PEXELS_API_KEY`
   - `YOUTUBE_CLIENT_ID`
   - `YOUTUBE_CLIENT_SECRET`
   - `YOUTUBE_REFRESH_TOKEN`
   - `SHORTY_ADMIN_TOKEN` opsiyonel
   - Eger mevcut refresh token `invalid_grant` verirse, `infenglov@gmail.com` hesabiyla yeniden OAuth alman gerekir.
3. Telefonda GitHub'i ac
4. `Actions -> Generate Short -> Run workflow`
5. `seed_topic` bos ya da dolu gir
6. `privacy=private` sec
7. Workflow bitince:
   - Step summary'de YouTube ve Studio linklerini gor
   - Artifact olarak final mp4'yi indir

## Legacy project'ten neyi reuse edebilirsin?

`C:\Users\User\Desktop\AI Coding Projects\Useless Projects\Youtube Project`

- Oradaki `.env` dosyasinda Gemini ve Pexels anahtarlari icin alanlar var
- `youtube_bot\youtube_token.json` icinde refresh token mevcut
- `client_secret_...json` icinde YouTube client id ve client secret mevcut

Bu degerleri GitHub Secrets'e tasirsan yeni cloud workflow icin yeniden OAuth kurman gerekmeyebilir.

Ancak refresh token iptal edilmis veya eskiyse workflow upload adiminda basarisiz olur. Bu durumda:

1. `npm run youtube:auth-url`
2. Linki `infenglov@gmail.com` oturumuyla ac
3. Donen `code` ile `npm run youtube:exchange-code -- YOUR_CODE`
4. Yeni `refresh_token` degerini GitHub secret olarak guncelle

## Limitler

- Bu yol "gercekten hep acik bir sunucu" degil, on-demand runner modelidir
- Ucretsiz dakika kotan biterse workflow durur
- PWA review panelinin cloud always-on versiyonu bu modda kullanilmaz; review YouTube private link + GitHub artifact uzerinden yapilir
