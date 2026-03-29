# Cloud Mode Without Your PC

Bu modda sistem telefonundan tetiklenir ama hesaplama GitHub Actions runner'inda yapilir.

## Neden bu yol?

- PC acik kalmak zorunda degil
- Ucretsiz baslamak kolay
- Elle tetikleme telefondan yapilabilir
- Video private yuklenir, sen sonra YouTube Studio'dan kontrol edersin

## Nasil calisir?

1. Bu klasoru GitHub repo olarak push et
2. En pratik yol Android uygulamasindaki `Connect YouTube` butonunu kullanmaktir
   - Uygulama Google hesap secimini acar
   - Refresh token alir
   - Repo secret'larini GitHub API ile sync eder
3. Bunun icin GitHub PAT'inde su izinler olsun:
   - Actions: Read and write
   - Secrets: Read and write
   - Contents: Read
4. Daha sonra telefonda uygulamadan `Generate Short` diyebilirsin
5. Workflow bitince:
   - Step summary'de YouTube ve Studio linklerini gor
   - Artifact olarak final mp4'yi indir

## Legacy project'ten neyi reuse edebilirsin?

`C:\Users\User\Desktop\AI Coding Projects\Useless Projects\Youtube Project`

- Oradaki `.env` dosyasinda Gemini ve Pexels anahtarlari icin alanlar var
- `youtube_bot\youtube_token.json` icinde refresh token mevcut
- `client_secret_...json` icinde YouTube client id ve client secret mevcut

Eski refresh token iptal edilmis veya eskiyse workflow upload adiminda basarisiz olur. Bu durumda en kolay cozum uygulama icinden tekrar `Connect YouTube` yapmaktir.

Istersen manuel yol da kullanabilirsin:

1. `npm run youtube:auth-url`
2. Linki `infenglov@gmail.com` oturumuyla ac
3. Donen `code` ile `npm run youtube:exchange-code -- YOUR_CODE`
4. Yeni `refresh_token` degerini GitHub secret olarak guncelle

## Limitler

- Bu yol "gercekten hep acik bir sunucu" degil, on-demand runner modelidir
- Ucretsiz dakika kotan biterse workflow durur
- PWA review panelinin cloud always-on versiyonu bu modda kullanilmaz; review YouTube private link + GitHub artifact uzerinden yapilir
