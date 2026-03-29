# Shorty Control

Windows PC + Docker ustunde calisan, mobilden kontrol edilen, Turkce motivasyon/hikaye YouTube Shorts uretim sistemi.

## Ne geliyor?

- `shorty-service`: PWA panel + API + job queue + render pipeline
- `n8n`: webhook ve harici tetikleme icin ek otomasyon katmani
- `Gemini`: script yazimi + TTS
- `Pexels`: dikey B-roll arama
- `FFmpeg`: video render, muzik bed, karaoke altyazi
- `YouTube Data API`: private upload ve isleme durumu takibi

## Klasorler

- `src/`: backend, kuyruk, API, render ve entegrasyonlar
- `public/`: PWA arayuzu
- `scripts/`: YouTube OAuth yardimci scriptleri
- `tests/`: unit ve API testleri
- `n8n/`: workflow ornekleri ve kurulum notlari

## Ilk kurulum

1. `.env.example` dosyasini `.env` olarak kopyala.
2. `.env` icinde en az su alanlari doldur:
   - `SHORTY_ADMIN_TOKEN`
   - `GEMINI_API_KEY`
   - `YOUTUBE_CLIENT_ID`
   - `YOUTUBE_CLIENT_SECRET`
   - `YOUTUBE_REFRESH_TOKEN`
   - `PEXELS_API_KEY` istege bagli ama onerilir
3. Muzik looplarin varsa `data/music/` klasorune `mp3`, `wav`, `m4a` veya `aac` olarak koy.
4. Uygulamayi baslat:

```bash
npm install
npm run build
docker compose up --build
```

Servisler:

- PWA ve API: `http://localhost:3000`
- n8n: `http://localhost:5678`

## YouTube refresh token alma

1. `.env` icine `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI` yaz.
2. Auth URL olustur:

```bash
npm run youtube:auth-url
```

3. Tarayicida acilan linkte Google izin ekranini tamamla.
4. Redirect URL uzerindeki `code` degerini al.
5. Tokenlari cikar:

```bash
npm run youtube:exchange-code -- YOUR_CODE
```

6. Ciktilardaki `refresh_token` degerini `.env` icindeki `YOUTUBE_REFRESH_TOKEN` alanina yaz.

## PWA kullanimi

- Ilk giriste token istenirse `.env` icindeki `SHORTY_ADMIN_TOKEN` degerini panele gir.
- `Generate` ekranindan yeni is baslat.
- `Drafts` ekranindan durumlari izle.
- `Review` ekraninda preview, metadata, credits ve Studio linkini gor.
- `Regenerate audio` yalnizca ses, altyazi, render ve upload adimlarini tekrarlar.
- `Regenerate visuals` yalnizca gorseller, render ve upload adimlarini tekrarlar.

## Tailscale ile mobil erisim

Windows host'a Tailscale kurup giris yaptiktan sonra:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-tailscale-serve.ps1
```

Bu komut `3000` portundaki PWA panelini tailnet icinden acman icin `tailscale serve` kullanir. Telefonunda ayni tailnet hesabiyla baglanip verilen `https://...ts.net` adresini ac.

## n8n entegrasyonu

- `n8n/README.md` icindeki adimlari uygula.
- n8n tarafinda `SHORTY_SERVICE_URL=http://shorty-service:3000` ve `SHORTY_ADMIN_TOKEN=<senin tokenin>` mantigiyla HTTP Request node'u kullan.
- Hazir ornek workflow dosyalari `n8n/shorty-mobile-trigger.json` ve `n8n/shorty-job-status.json`.

## Test ve build

```bash
npm test
npm run build
```

## Cloud mode

PC acik kalmasin istiyorsan GitHub Actions tabanli cloud mode kullan.

- Workflow dosyasi: `.github/workflows/generate-short.yml`
- Rehber: `docs/cloud-mode.md`

Bu modda telefonundan GitHub Actions workflow'unu calistirirsin, render cloud runner'da olur ve video kanalina private olarak yuklenir.

## Notlar

- `PEXELS_API_KEY` yoksa sistem branded fallback visual ile calisir.
- `data/music/` bos ise FFmpeg procedurally generated ambient bed uretir.
- Yukleme tamamlandiginda video `private` veya sectigin privacy ile YouTube'a gider; son publish adimi uygulama disinda, YouTube Studio uzerindendir.
