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

## Native App (iOS / Android) über Capacitor

Die Web-App (Root-Dateien) bleibt unverändert die Quelle für GitHub Pages. Für den
App-Store-Build wird daraus zusätzlich eine native Hülle gebaut:

```
npm install        # einmalig
npm run sync        # baut www/ aus den Root-Dateien und synct es nach ios/ & android/
```

- `www/` ist reines Build-Ergebnis (nicht eingecheckt) – Quelle bleiben `index.html`,
  `app.js`, `style.css`, `sw.js`, `manifest.json`, `cards.json`, `icons/` im Root.
- `ios/` und `android/` sind die generierten nativen Projekte (Xcode- bzw.
  Android-Studio-Projekt) und werden eingecheckt, weil dort plattformspezifische
  Einstellungen (Icons, Berechtigungen, Signing) reinkommen.
- `assets/icon.png` (1024×1024, kein Alpha) und `assets/splash.png` sind die
  Quellbilder fürs App-Icon/Splash-Screen; `npx capacitor-assets generate` erzeugt
  daraus alle Icon-/Splash-Größen für beide Plattformen neu.
- Nach jeder Änderung an den Root-Dateien vor einem nativen Build: `npm run sync`
  ausführen, damit `ios/`/`android/` die aktuelle Version bekommen.

## Account-System (Firebase Auth) einrichten

Für die öffentliche Version bekommt jeder Nutzer ein eigenes, anonymes Konto
(kein Zwang zu E-Mail/Passwort), damit Fortschritt nicht mehr an zwei fest
einprogrammierte Profile (Tim/Huseyn) gebunden ist. Zwei einmalige Schritte
in der Firebase-Konsole (console.firebase.google.com → euer Projekt), die nur
der Projekt-Inhaber machen kann:

1. **Authentication → Sign-in method** → "Anonymous" aktivieren und
   "Email/Password" aktivieren (für "Konto sichern", optional für Nutzer).
2. **Realtime Database → Regeln** → Inhalt von `firebase-database-rules.json`
   (im Repo-Root) reinkopieren und veröffentlichen. Ersetzt die bisher offene
   Konfiguration durch: jeder Nutzer darf nur seine eigenen Daten
   (`progress/$uid`, `streak/$uid`, `examstats/$uid`, `users/$uid`) lesen/schreiben.
3. **Project Settings → General → Web API Key** kopieren und in `app.js` als
   `FIREBASE_API_KEY` eintragen. Das ist kein Geheimnis - der Web-API-Key ist
   bei Firebase bewusst öffentlich/clientseitig sichtbar (steht in jeder
   Firebase-Web-App im Quellcode) und wird durch die Datenbank-Regeln
   oben abgesichert, nicht durch Geheimhaltung.
