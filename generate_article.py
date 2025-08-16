import re

def lag_artikkel_fil(tekst, url):
    # Ekstraher år og uke fra URL
    match = re.search(r'(\d{4})/(\d{2})', url)
    if not match:
        raise ValueError("Fant ikke år og uke i URL")
    år, uke = match.groups()
    filnavn = f"{år}-{uke}.html"

    # Rens tekst
    tekst = re.sub(r"(Se bildet|Audio Player|Underoverskrifter|Lignende stoff|Copyright|Logg inn|Del|Innstillinger|SANG\s\d+.*)", "", tekst, flags=re.IGNORECASE)

    # Lag HTML-innhold
    html = f"""
<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<title>Artikkel {år} uke {uke}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<h1>Artikkel for uke {uke}, {år}</h1>
<p>{tekst}</p>
</body>
</html>
"""

    # Lagre fil
    with open(filnavn, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Lagret: {filnavn}")

    return filnavn
