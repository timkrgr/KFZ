# KFZ Karteikarten

Persönliche Lern-App für die Kfz-Abschlussprüfung. Läuft als installierbare Web-App (PWA) direkt vom iPhone-Homescreen, auch offline.

## Nutzung

- **Karte umdrehen:** antippen
- **Weiß ich / Nochmal üben:** Buttons unten oder nach rechts/links wischen
- **Filtern:** oben rechts auf ⚙ tippen → Kategorie oder "nur unsichere/noch zu lernende Karten" wählen
- **Neue Karten:** Fragen einfach an Claude schicken. Claude trägt sie in `cards.json` ein und committet/pusht. Danach in der App auf ⚙ → "Neue Karten laden" tippen (oder App schließen und neu öffnen).

## Zum Homescreen hinzufügen (iPhone)

1. Die gehostete URL in **Safari** öffnen (nicht Chrome – "Zum Home-Bildschirm" braucht Safari).
2. Teilen-Symbol (Quadrat mit Pfeil) antippen.
3. "Zum Home-Bildschirm" wählen.
4. Fertig – die App startet ab jetzt im Vollbild wie eine native App.

## Struktur

- `index.html`, `style.css`, `app.js` – die App selbst
- `cards.json` – deine Fragen/Antworten (wird von Claude gepflegt)
- `manifest.json`, `sw.js`, `icons/` – PWA-Grundlagen (Installierbarkeit, Offline-Cache)

`cards.json`-Format:

```json
{
  "cards": [
    { "id": "eindeutige-id", "category": "Kategorie", "question": "Frage", "answer": "Antwort" }
  ]
}
```

Lernfortschritt wird nur lokal im Browser gespeichert (localStorage) – nicht in `cards.json` und nicht auf einem Server.
