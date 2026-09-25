# Lieferwagen einschlichten (Design)

Stand: 2026-09-25. Baut auf [2026-09-25-foerderband-design.md](2026-09-25-foerderband-design.md) auf.

## Ziel

Pakete werden vom Band genommen und in einen Lieferwagen eingeschlichtet (gestapelt).
Ist der Wagen voll, fährt er ab und ein leerer kommt. Die Farbwelt wird auf Rot und Schwarz reduziert.

## Entscheidungen

- **Straße und Wagen:** Vorne quer über die Platte liegt eine dunkle Straße mit weißen Randlinien.
  Der Lieferwagen parkt dort vor dem Band. Der Laderaum hat kein Dach, und die Seite zur Kamera
  ist offen (Puppenhaus-Prinzip), damit man die Stapel sieht.
- **Einschlichten im Raster:** Der Laderaum misst 2 m × 1,25 m × 1 m und ist in 25-cm-Zellen
  eingeteilt. Ein abgelegtes Paket
  - dreht sich automatisch längs zum Wagen (0° oder 180°, je nachdem, was näher liegt), manuelles Drehen gibt es nicht,
  - rastet an der Zelle ein, die dem Zeiger am nächsten liegt,
  - liegt auf der höchsten Oberkante der Pakete unter seiner Grundfläche.
- **Passt nicht:** Wäre es an der Stelle zu hoch, wird die nächste passende Stelle im Umkreis
  genommen. Gibt es keine, landet das Paket auf dem Boden neben dem Wagen.
- **Umschlichten:** Pakete lassen sich wieder herausnehmen. Danach rutscht alles, was darüber lag,
  nach unten (von unten nach oben neu abgesetzt).
- **Feste Paketgrößen** (Breite × Länge × Höhe):
  Klein 0,5 × 0,5 × 0,5; Mittel 0,5 × 0,75 × 0,5; Groß 0,75 × 0,75 × 0,5;
  Flach 0,75 × 1,0 × 0,25; Hoch 0,5 × 0,5 × 0,75.
- **Voll:** Keine der fünf Größen passt mehr irgendwo hinein. Dann wartet der Wagen kurz und
  fährt nach rechts weg. Wird in der Wartezeit ein Paket herausgenommen, bleibt er stehen.
  Ein leerer Wagen fährt von links vor. Während der Fahrt kann man nichts einladen und nichts herausnehmen.
- **Zähler:** Oben links steht „Zugestellt: N Pakete". Er zählt, sobald ein Wagen abgefahren ist.
- **Farben:** Rot und Schwarz als Hauptfarben, dazu helle Grau- und Weißtöne. Die Pakete bleiben
  kartonbraun, mit rotem oder schwarzem Klebeband und weißen Etiketten. Deko (Bäume, Büsche, Steine)
  entfällt.
- **Boden:** Pakete landen nie auf der Straße. Freie Ablage gibt es hinter dem Band und zwischen Band und Straße.

## Aufbau

| Datei | Aufgabe |
| --- | --- |
| `src/delivery/cargo.js` | Raster, Stapelhöhe, nächster passender Platz, Nachrutschen, Voll-Check |
| `src/delivery/van.js` | Wagenmodell, Ankunft/Abfahrt, Laderaum-Koordinaten |
| `src/packages/packageManager.js` | Zusätzlicher Ablageort „Wagen", Abfahrt auslösen, Zähler |
| `src/scene/environment.js` | Straße statt Deko |
