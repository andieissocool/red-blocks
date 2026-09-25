# Förderband mit Paketen (Design)

Stand: 2026-09-25

## Ziel

Die Startseite zeigt eine 3D-Szene (Three.js) mit einem Förderband, auf dem Pakete
von links nach rechts fahren. Der Nutzer kann jedes Paket per Drag & Drop umsetzen.
Der Three.js-Starter (Würfel, Grid, OrbitControls) entfällt.

## Entscheidungen

- **Darstellung:** 3D mit Three.js, verspielter Low-Poly-Look als Diorama auf einer Holzplatte:
  warme Pastellfarben, weiche Schatten, ein paar Bäume, Steine und Büsche als Deko.
- **Kamera:** fest, schräg von oben. Der Abstand passt sich dem Seitenverhältnis an,
  sodass die ganze Strecke samt Häusern sichtbar ist.
- **Strecke:** offen, von links nach rechts. Gerade Stücke an beiden Enden, dazwischen eine
  sanfte S-Kurve, bei der Steigung und Krümmung an den Enden auf null auslaufen
  (engster Radius ca. 2, seitlicher Ausschlag ca. ±1,3).
- **Häuschen an beiden Enden:** Pakete entstehen versteckt im linken Haus und verschwinden im
  rechten. Die Häuser sind massive Körper mit dunkler Türöffnung. Was im Inneren liegt,
  wird automatisch verdeckt.
- **Verhalten auf dem Band:** Die Pakete halten Mindestabstand. Ist vorne kein Platz, wartet
  das hintere Paket (Stau), der Gurt läuft darunter weiter. Neue Pakete kommen in zufälligen
  Abständen, sobald am Anfang Platz ist. Beim Laden ist das Band schon gefüllt.
- **Drag & Drop:** Maus und Touch über Pointer Events. Ein angeklicktes Paket hebt sich an,
  bleibt unter dem Zeiger und neigt sich leicht in Bewegungsrichtung. Eine Markierung zeigt,
  wo es landet.
  - Loslassen über dem Band: Das Paket rastet an der nächsten freien Stelle ein (seitlicher
    Versatz und Drehung bleiben erhalten, soweit das Paket auf den Gurt passt) und fährt weiter.
  - Loslassen daneben: Das Paket fällt auf die Platte und bleibt liegen. Überlappt es mit dem
    Band, einem anderen Paket, einem Haus oder der Deko, wird es an die nächste freie Stelle
    geschoben.
- **Keine automatisierten Tests** (Wunsch des Nutzers). Die Prüfung erfolgt im Browser.

## Aufbau

| Datei | Aufgabe |
| --- | --- |
| `src/main.js` | Renderer, Kamera, Resize, Animationsschleife, Verdrahtung |
| `src/config.js` | Gemeinsame Maße, Farben und Tempo |
| `src/scene/environment.js` | Licht, Platte, Deko und deren Hindernisflächen |
| `src/conveyor/path.js` | Streckenkurve: Position/Richtung bei Streckenmeter `s`, nächster Punkt zu (x, z) |
| `src/conveyor/belt.js` | Gurt (laufende Rillen-Textur), Rahmen, Handläufe, Beine |
| `src/conveyor/house.js` | Häuschen an den Enden |
| `src/packages/package.js` | Paketmodell und dessen Bewegung (Nachziehen, Fallen, Neigen) |
| `src/packages/packageManager.js` | Erzeugen, Stau-Logik, Entfernen, Ablageplatz finden |
| `src/interaction/drag.js` | Raycasting, Hover, Ziehen, Ablage-Markierung |
| `src/utils/*.js` | Kleine Helfer (gedrehte Rechtecke, Mathe, Zufall) |

Vite-Konfiguration und das GitHub-Pages-Deployment bleiben unverändert.
