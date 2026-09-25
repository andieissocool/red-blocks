# red-blocks

Ein kleines Three.js-Diorama in Rot und Schwarz: Auf einem Förderband mit sanften Kurven fahren Pakete von links nach rechts.
Per Drag & Drop (Maus oder Touch) nimmt man sie vom Band und schlichtet sie in den Lieferwagen auf der Straße.
Die Pakete rasten im Laderaum in einem Raster ein und stapeln sich. Ist der Wagen voll, fährt er ab und ein leerer kommt nach.
Der Zähler oben links zeigt, wie viele Pakete schon zugestellt sind.

## Entwicklung

```sh
npm install
npm run dev      # lokaler Dev-Server
npm run build    # Produktions-Build nach dist/
```

Ein Push auf `main` baut die Seite und veröffentlicht sie über GitHub Pages.
