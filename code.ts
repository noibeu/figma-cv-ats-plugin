// Plugin Figma pour exporter un CV en PDF ATS-compliant
// Stratégie hybride : Image PNG (rendu visuel exact) + Texte invisible (lisible par ATS)

interface ExportData {
  pngBytes: Uint8Array;
  frameWidth: number;
  frameHeight: number;
  textBlocks: TextBlock[];
}

interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  color: { r: number; g: number; b: number; a: number };
  sectionType?: string; // Type de section détecté
  isTitle?: boolean; // Est-ce un titre de section ?
}

// Afficher l'interface utilisateur
figma.showUI(__html__, { width: 320, height: 180 });

// Écouter les messages de l'UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'export-ats-pdf') {
    try {
      // Récupérer la sélection
      const selection = figma.currentPage.selection;

      if (selection.length === 0) {
        figma.notify('⚠️ Veuillez sélectionner une Frame');
        return;
      }

      // Prendre le premier élément sélectionné
      const node = selection[0];

      // Vérifier que c'est un node exportable (Frame, Component, etc.)
      if (!('exportAsync' in node)) {
        figma.notify('❌ Ce type de node ne peut pas être exporté');
        return;
      }

      figma.notify('🔄 Export en cours...');

      // 1. Exporter la Frame en image PNG haute résolution (2x)
      const pngBytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 2 }
      });

      // 2. Extraire les textes pour l'ATS
      const textBlocks = await extractTextBlocks([node]);

      // 3. Envoyer tout à l'UI pour générer le PDF
      figma.ui.postMessage({
        type: 'generate-pdf',
        data: {
          pngBytes: Array.from(pngBytes), // Convertir Uint8Array en Array pour le postMessage
          frameWidth: node.width,
          frameHeight: node.height,
          textBlocks: textBlocks
        }
      });

      figma.notify(`✅ Frame exportée (${textBlocks.length} textes extraits)`);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      figma.notify('❌ Erreur lors de l\'export');
    }
  }
};

/**
 * Détecte le type de section basé sur le contenu du texte
 */
function detectSectionType(text: string, fontSize: number, fontWeight: string): { type: string; isTitle: boolean } {
  const normalizedText = text.toLowerCase().trim();
  const isLargeAndBold = fontSize > 14 && fontWeight === 'bold';
  const isVeryLarge = fontSize > 20;

  // Nom du candidat (très grand texte en haut)
  if (isVeryLarge) {
    return { type: 'HEADER', isTitle: true };
  }

  // Titres de sections
  if (isLargeAndBold && text.length < 60) {
    if (/exp[ée]rience|work|emploi|career|professionnel/i.test(normalizedText)) {
      return { type: 'EXPERIENCE', isTitle: true };
    }
    if (/formation|education|dipl[ôo]me|studies|academic/i.test(normalizedText)) {
      return { type: 'EDUCATION', isTitle: true };
    }
    if (/comp[ée]tence|skills|technical|expertise|savoir/i.test(normalizedText)) {
      return { type: 'SKILLS', isTitle: true };
    }
    if (/contact|coordonn[ée]es|email|phone|t[ée]l[ée]phone|mobile/i.test(normalizedText)) {
      return { type: 'CONTACT', isTitle: true };
    }
    if (/langue|language|certif/i.test(normalizedText)) {
      return { type: 'LANGUAGES', isTitle: true };
    }
    if (/projet|project|r[ée]alisation/i.test(normalizedText)) {
      return { type: 'PROJECTS', isTitle: true };
    }
    if (/loisir|hobby|interest|passion/i.test(normalizedText)) {
      return { type: 'INTERESTS', isTitle: true };
    }

    return { type: 'SECTION_TITLE', isTitle: true };
  }

  return { type: 'CONTENT', isTitle: false };
}

/**
 * Extrait tous les blocs de texte d'un node Figma
 */
async function extractTextBlocks(nodes: readonly SceneNode[]): Promise<TextBlock[]> {
  const textBlocks: TextBlock[] = [];

  async function traverse(node: SceneNode) {
    if (node.type === 'TEXT') {
      const textNode = node as TextNode;

      try {
        // Charger la police
        if (textNode.fontName !== figma.mixed) {
          await figma.loadFontAsync(textNode.fontName as FontName);
        } else {
          const firstFont = textNode.getRangeFontName(0, 1) as FontName;
          await figma.loadFontAsync(firstFont);
        }

        // Extraire propriétés
        const fontSize = typeof textNode.fontSize === 'number' ? textNode.fontSize : 12;
        const fontWeight = typeof textNode.fontWeight === 'number' ?
          (textNode.fontWeight >= 600 ? 'bold' : 'normal') : 'normal';

        let fontStyle = 'normal';
        if (textNode.fontName !== figma.mixed) {
          const fontName = textNode.fontName as FontName;
          fontStyle = fontName.style.toLowerCase().includes('italic') ? 'italic' : 'normal';
        }

        let color = { r: 0, g: 0, b: 0, a: 1 };
        if (textNode.fills !== figma.mixed && Array.isArray(textNode.fills) && textNode.fills.length > 0) {
          const fill = textNode.fills[0];
          if (fill.type === 'SOLID') {
            color = {
              r: fill.color.r,
              g: fill.color.g,
              b: fill.color.b,
              a: fill.opacity !== undefined ? fill.opacity : 1
            };
          }
        }

        // Détecter le type de section
        const { type: sectionType, isTitle } = detectSectionType(
          textNode.characters,
          fontSize,
          fontWeight
        );

        textBlocks.push({
          text: textNode.characters,
          x: textNode.absoluteTransform[0][2],
          y: textNode.absoluteTransform[1][2],
          width: textNode.width,
          height: textNode.height,
          fontSize: fontSize,
          fontWeight: fontWeight,
          fontStyle: fontStyle,
          color: color,
          sectionType: sectionType,
          isTitle: isTitle
        });
      } catch (error) {
        console.warn(`Erreur texte "${textNode.characters}":`, error);
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        await traverse(child);
      }
    }
  }

  for (const node of nodes) {
    await traverse(node);
  }

  // Trier par position (haut → bas, gauche → droite)
  textBlocks.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.x - b.x;
  });

  return textBlocks;
}
