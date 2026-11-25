# Playmania

Eine Sammlung kleiner Spiele für iPhone & Android. Erstes Spiel: **Rocket Racer** –
Matchbox-Autos mit Raketen-Antrieb rasen durch Kinderzimmer, Garagen und Wohnzimmer.

**Tech:** TypeScript · [Three.js](https://threejs.org) (3D-Darstellung) · [Phaser 4](https://phaser.io) (Menüs, HUD, Matter.js-Physik) · Vite · [Capacitor 8](https://capacitorjs.com) für native Apps.

**2,5D:** Die Physik läuft in 2D (Seitenansicht, gut steuerbar für Kinder), gerendert wird ein echter
3D-Raum mit Licht, Schatten und Perspektive. Die 3D-Modelle (Autos, Rakete, Möbel) sind mit Higgsfield
generiert – Details in [docs/ASSETS.md](docs/ASSETS.md). Sounds kommen aus einem WebAudio-Synth.

## Schnellstart

```bash
npm install
npm run dev          # http://localhost:5173 – auch im WLAN erreichbar (--host)
npm run build        # Production-Build nach dist/
npm run typecheck
```

Modell-Viewer (nur Dev): `/tools/viewer.html?model=/models/car-flitzer.glb&yaw=0`

Debug-Parameter: `?debug` (stellt `window.__race` / `window.__game` bereit), `?scene=race` / `?scene=garage` springt direkt hinein.

## Auf dem iPhone testen

| Weg | Was du brauchst | Aufwand |
|-----|-----------------|---------|
| **1. Im WLAN** | Rechner + iPhone im selben WLAN | `npm run dev`, dann die angezeigte `Network:`-URL in Safari öffnen |
| **2. Als Web-App (PWA)** | GitHub Pages (oder Netlify/Vercel) | Push auf `main` → Workflow deployt; in Safari öffnen → Teilen → „Zum Home-Bildschirm“ → startet im Vollbild |
| **3. Native App** | Mac mit Xcode, Apple-ID | `npm run ios` öffnet Xcode → Team wählen → iPhone per Kabel → ▶ |

Hinweise zu 3: Mit kostenloser Apple-ID läuft die App 7 Tage, danach neu installieren. Für TestFlight / App Store
braucht es das Apple Developer Program (99 €/Jahr). Android: `npm run android` (Android Studio) – das APK läuft sofort auf jedem Gerät.

GitHub Pages bei privaten Repos erfordert einen bezahlten GitHub-Plan; alternativ `dist/` auf Netlify/Vercel deployen.

## Steuerung (Rocket Racer)

| Touch | Tastatur | Wirkung |
|-------|----------|---------|
| GAS (rechts unten) | → / D | Beschleunigen · in der Luft: Nase hoch |
| BREMSE (links unten) | ← / A | Bremsen/Rückwärts · in der Luft: Nase runter |
| RAKETE | Leertaste / ↑ | Schub in Fahrtrichtung, verbraucht Tank (lädt am Boden nach) |
| II | Esc / P | Pause · `R` = zurück zum letzten Kontrollpunkt |

Orange Rampen mit Pfeilen sind **Jump-Boosts**, blaue Ringe in der Luft geben einen weiteren Schub –
so springt man von Boost zu Boost. Die Gravitation ist bewusst niedrig (0.55 statt 1.0).
In der Luft stabilisiert sich das Auto selbst, damit Kinder nicht ständig auf dem Dach landen.

## Projektstruktur

```
src/
  main.ts                   Phaser-Setup (Retina, Resize, Audio-Unlock), transparenter Canvas über Three.js
  core/                     Spielstand (localStorage), WebAudio-Synth, View/Safe-Area
  ui/                       Buttons, Theme, Widgets
  scenes/                   Boot + Playmania-Hub (Spieleauswahl)
  games/rocket-racer/
    cars.ts                 Autos & Raketen-Upgrades (Preise, Werte)
    Car.ts                  Fahrphysik (Chassis + gefederte Räder, Rakete, Luftsteuerung)
    LevelPhysics.ts         Baut die Matter-Körper + Spiel-Logik aus Level-Daten
    three/                  3D: World3D (Rennen), Car3D, Showroom3D (Garage), Partikel, Texturen, Modell-Loader
    levels/                 Level als Daten (kidsroom.ts = Level 1)
    scenes/                 Garage, Rennen, HUD
public/models/              GLB-Modelle (optimiert)
ios/ android/               Capacitor-Projekte
```

### Neues Level anlegen

1. `src/games/rocket-racer/levels/kidsroom.ts` kopieren, Boden/Blöcke/Rampen/Ringe/Münzen anpassen.
   `coinArc()` legt Münzen exakt auf die Flugbahn eines Boosts.
2. In `levels/index.ts` zu `LEVELS` hinzufügen.

### Neues Spiel in Playmania

Eigenen Ordner unter `src/games/<name>/` anlegen, Szenen in `main.ts` registrieren und im `HubScene` eine Karte mit `scene: '<start-szene>'` eintragen. Münzen (`save.coins`) gelten spielübergreifend.

## Icons

`npm run icons` erzeugt die Icons neu (benötigt Playwright + Chromium).
