# Plugin Figma : Export CV en PDF ATS-Compliant

Plugin Figma qui exporte des designs de CV en PDF avec du **texte réel** (pas d'images), optimisé pour les systèmes ATS (Applicant Tracking Systems).

## ✨ Fonctionnalités

- ✅ Extraction automatique de tous les textes du design Figma
- ✅ Export en PDF avec texte **copiable, sélectionnable et indexable**
- ✅ Polices standards ATS-compliant (Helvetica/Arial)
- ✅ Conservation des styles (gras, italique, tailles)
- ✅ Ordre de lecture intelligent (haut → bas, gauche → droite)
- ✅ Adaptation automatique au format A4
- ✅ Métadonnées PDF optimisées pour les ATS

## 🚀 Installation

### 1. Installer les dépendances

```bash
npm install
```

### 2. Compiler le TypeScript

```bash
npm run build
```

Cela génère le fichier `code.js` nécessaire au plugin.

### 3. Charger le plugin dans Figma

1. Ouvrez Figma Desktop
2. Allez dans **Menu → Plugins → Development → Import plugin from manifest...**
3. Sélectionnez le fichier `manifest.json` de ce dossier
4. Le plugin "CV ATS Export" apparaît dans vos plugins

## 📖 Utilisation

1. Ouvrez votre design de CV dans Figma
2. Sélectionnez les frames/éléments à exporter (ou laissez vide pour exporter toute la page)
3. Lancez le plugin : **Menu → Plugins → Development → CV ATS Export**
4. Cliquez sur **"Exporter en PDF ATS"**
5. Le fichier `cv-ats.pdf` se télécharge automatiquement

## 🔧 Structure du code

### `code.ts` (Logique principale)

- **`extractTextBlocks()`** : Parcourt récursivement tous les nodes Figma et extrait les textes avec leurs propriétés (position, taille, style, couleur)
- **`generateATSPDF()`** : Crée un PDF avec `pdf-lib` en insérant chaque texte aux bonnes coordonnées avec les bonnes polices

### Exemple d'extraction d'un texte Figma

```typescript
if (node.type === 'TEXT') {
  const textNode = node as TextNode;

  // Charger la police pour accéder aux propriétés
  await figma.loadFontAsync(textNode.fontName as FontName);

  // Extraire les propriétés
  const text = textNode.characters;
  const fontSize = typeof textNode.fontSize === 'number' ? textNode.fontSize : 12;
  const fontWeight = textNode.fontWeight >= 600 ? 'bold' : 'normal';

  // Position absolue sur la page
  const x = textNode.absoluteTransform[0][2];
  const y = textNode.absoluteTransform[1][2];
}
```

### Exemple d'insertion dans le PDF

```typescript
// Choisir la police (Helvetica, HelveticaBold, etc.)
const font = block.fontWeight === 'bold' ? helveticaBoldFont : helveticaFont;

// Convertir coordonnées Figma → PDF
const pdfX = marginX + (block.x - minX) * scale;
const pdfY = height - marginY - (block.y - minY) * scale - fontSize;

// Insérer le texte
page.drawText(block.text, {
  x: pdfX,
  y: pdfY,
  size: fontSize,
  font: font,
  color: rgb(block.color.r, block.color.g, block.color.b)
});
```

## 📝 Fichiers

- **`manifest.json`** : Configuration du plugin Figma
- **`code.ts`** : Code TypeScript principal (logique d'extraction et génération PDF)
- **`ui.html`** : Interface utilisateur du plugin
- **`tsconfig.json`** : Configuration TypeScript
- **`package.json`** : Dépendances (pdf-lib, types Figma)

## 🛠️ Modifications possibles

### Changer le format de page

Dans `generateATSPDF()`, modifiez la ligne :

```typescript
const page = pdfDoc.addPage([595, 842]); // A4
// Lettre US : [612, 792]
```

### Changer les marges

```typescript
const marginX = 50; // Marges horizontales (en points)
const marginY = 50; // Marges verticales
```

### Ajouter d'autres polices

```typescript
const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
```

### Filtrer certains textes

Dans `extractTextBlocks()`, ajoutez une condition :

```typescript
if (textNode.characters.includes('NE PAS EXPORTER')) {
  return; // Ignorer ce texte
}
```

## ⚠️ Limitations

- Les images/formes ne sont **pas exportées** (focus sur le texte pour ATS)
- Les polices exotiques sont remplacées par Helvetica
- Les effets visuels (ombres, flous) ne sont pas conservés

## 📦 Dépendances

- **pdf-lib** : Génération de PDF avec texte réel
- **@figma/plugin-typings** : Types TypeScript pour l'API Figma

## 📄 Licence

MIT
