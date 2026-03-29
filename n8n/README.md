# n8n setup

Bu klasorde iki ornek workflow bulunur:

- `shorty-mobile-trigger.json`: webhook ile yeni job olusturur
- `shorty-job-status.json`: job durumunu backend'den ceker

## Onerilen env degiskenleri

n8n container veya host ortaminda su degerleri tanimli olsun:

- `SHORTY_SERVICE_URL=http://shorty-service:3000`
- `SHORTY_ADMIN_TOKEN=<SHORTY_ADMIN_TOKEN>`

## Import

1. n8n panelini ac: `http://localhost:5678`
2. `Workflows -> Import from file`
3. `shorty-mobile-trigger.json` dosyasini import et
4. Gerekirse HTTP Request node icindeki URL ve header degerlerini kontrol edip kaydet

## Ornek kullanim

- `POST /webhook/shorty-mobile-generate`
  - body:
    - `seedTopic`: opsiyonel
    - `privacy`: `private` veya `unlisted`
- `GET /webhook/shorty-job-status?jobId=<id>`

Not: n8n surumu farkliysa node parametre isimleri degisebilir. Import sonrasi node'u bir kez acip kaydetmek yeterli olur.

