# 3D-Assets

Alle Modelle in `public/models/` wurden mit **Higgsfield** generiert und danach mit
`scripts/fetch-model.sh` optimiert (gltf-transform: WebP-Texturen, Meshopt-Kompression).
Gesamtgröße ca. 2 MB.

## Autos (Bild → 3D)

Damit sich die Räder drehen und federn können, sind die Autos **Karosserien ohne Räder**.
Die Räder sind prozedural (`three/Car3D.ts`) und hängen an der Physik.

Weg: Bild mit `gpt_image_2_6` erzeugen (Karosserie mit leeren Radkästen, weißer Hintergrund),
dann `tripo_h3_1_image_to_3d` (face_limit 10000, Textur + PBR). Kosten ca. 10 Credits pro Auto.

Prompt-Vorlage:

> Product photo of a single die-cast toy car BODY SHELL with ALL FOUR WHEELS REMOVED: *(Beschreibung)*,
> matchbox toy style, glossy paint … The four wheel arches are completely EMPTY round cut-outs, no tires,
> no rims, no axles visible. Three-quarter front view from slightly above, floating on a plain pure white
> background, soft studio lighting, no shadow, no ground, centered, whole object visible.

| Datei | Beschreibung |
|-------|--------------|
| car-flitzer.glb | roter 70er-Sportcoupé, weißer Streifen, Nr. 1 |
| car-pickup.glb | blauer Pickup, gelber Streifen |
| car-blitz.glb | gelber Rennwagen, schwarze Streifen, Nr. 7, Spoiler |
| car-monster.glb | grüner Monstertruck mit Flammen, Überrollbügel |
| rocket.glb | Spielzeug-Raketenantrieb (weiß/rot) |

Feinabstimmung (Länge, Höhe der Schweller) pro Auto: `FIT` in `src/games/rocket-racer/three/Car3D.ts`.

## Möbel (Text → 3D)

`tripo_3d` (ca. 5 Credits pro Modell), Stil: *cute cartoon toy style, stylized game asset*.
bed, shelf (Bücherregal), lamp (Stehlampe), chest (Spielzeugkiste), dino (Plüschdino), teddy, desk (Tisch + Stuhl).

## Ausrichtung

Generierte Modelle haben unterschiedliche Vorderseiten. In `three/assets3d.ts` (`MODELS[...].yaw`) wird
gedreht, sodass Autos nach +X und Möbel zur Kamera (+Z) schauen. Prüfen mit dem Dev-Viewer:

```
npm run dev
http://localhost:5173/tools/viewer.html?model=/models/car-blitz.glb&yaw=0
```

## Neues Modell hinzufügen

```bash
scripts/fetch-model.sh <name> <glb-url> [texturgröße]   # → public/models/<name>.glb
```
Dann in `MODELS` eintragen. Fehlt eine Datei, nutzt das Spiel automatisch eine einfache Ersatzform.
