# Fontovi za PDF ponude

Statične instance s Google Fonts (SIL Open Font License 1.1 — https://openfontlicense.org):

| Datoteka | Obitelj | Instanca |
|---|---|---|
| Archivo-Regular.ttf | Archivo | wdth 100, wght 400 |
| Archivo-SemiBold.ttf | Archivo | wdth 100, wght 600 |
| Archivo-ExpandedBold.ttf | Archivo | wdth 125, wght 700 |
| Archivo-ExpandedBlack.ttf | Archivo | wdth 125, wght 900 (znak KARAMATIĆ) |
| IBMPlexMono-Regular.ttf | IBM Plex Mono | 400 |
| IBMPlexMono-Medium.ttf | IBM Plex Mono | 500 |

Svi imaju Č Ć Đ Š Ž, € i ². `pdf.ts` ih uvozi kao base64 (`?inline`), pa rade u Vercel funkciji.

**Ispravak:** na kraj tablice `glyf` dodano je 16 nul-bajtova (`node pad-glyf.cjs <font>.ttf`).
@pdf-lib/fontkit inače pada ("Trying to access beyond buffer length") na praznim glifovima na samom kraju tablice
(npr. razmak u Plex Monu). Oblici glifova nisu mijenjani. Novi font: preuzmi pa obavezno pokreni skriptu.
