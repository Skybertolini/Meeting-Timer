# Study Timer

Dette prosjektet lar deg generere og vise ukentlige Vakttårn-artikler via GitHub Pages.

## Bruk

1. **Generer ukens artikkel**
   - Kjør `generate_article.py`
   - Lim inn artikkeltekst og URL
   - Filen lagres som `ÅÅÅÅ-UU.html` (f.eks. `2025-05.html`)

2. **Last opp til GitHub**
   - Legg alle HTML-filer og `index.html` i et offentlig repo
   - Husk å legge til `Image_2.png` manuelt
   - Aktiver GitHub Pages under repoets Settings → Pages

3. **Visning**
   - `index.html` viser automatisk ukens artikkel basert på dato
   - Logoen vises øverst

## Filbeskrivelse

- `index.html`: Hovedside med knapp for å hente ukens artikkel
- `generate_article.py`: Python-skript for å lage ukentlige artikler
- `Image_2.png`: Logo som vises på hovedsiden
