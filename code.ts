// Figma plugin to export CV designs to ATS-compliant PDF
// Hybrid strategy: PNG image (exact visual rendering) + Structured text (ATS-readable)

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
  sectionType?: string; // Detected section type
  isTitle?: boolean; // Is it a section title?
}

// Show the user interface
figma.showUI(__html__, { width: 320, height: 180 });

// Listen to UI messages
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'export-ats-pdf') {
    try {
      // Get the selection
      const selection = figma.currentPage.selection;

      if (selection.length === 0) {
        figma.notify('⚠️ Please select a Frame');
        return;
      }

      // Take the first selected element
      const node = selection[0];

      // Check if it's an exportable node (Frame, Component, etc.)
      if (!('exportAsync' in node)) {
        figma.notify('❌ This node type cannot be exported');
        return;
      }

      figma.notify('🔄 Exporting...');

      // 1. Export the Frame as high-resolution PNG image (2x)
      const pngBytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 2 }
      });

      // 2. Extract text blocks for ATS
      const textBlocks = await extractTextBlocks([node]);

      // 3. Send everything to UI to generate PDF
      figma.ui.postMessage({
        type: 'generate-pdf',
        data: {
          pngBytes: Array.from(pngBytes), // Convert Uint8Array to Array for postMessage
          frameWidth: node.width,
          frameHeight: node.height,
          textBlocks: textBlocks
        }
      });

      figma.notify(`✅ Frame exported (${textBlocks.length} texts extracted)`);
    } catch (error) {
      console.error('Export error:', error);
      figma.notify('❌ Export error');
    }
  }
};

/**
 * Detects section type based on text content
 */
function detectSectionType(text: string, fontSize: number, fontWeight: string): { type: string; isTitle: boolean } {
  const normalizedText = text.toLowerCase().trim();
  const isLargeAndBold = fontSize > 14 && fontWeight === 'bold';
  const isVeryLarge = fontSize > 20;

  // Candidate name (very large text at the top)
  if (isVeryLarge) {
    return { type: 'HEADER', isTitle: true };
  }

  // Section titles
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
 * Extracts all text blocks from Figma nodes
 */
async function extractTextBlocks(nodes: readonly SceneNode[]): Promise<TextBlock[]> {
  const textBlocks: TextBlock[] = [];

  async function traverse(node: SceneNode) {
    if (node.type === 'TEXT') {
      const textNode = node as TextNode;

      try {
        // Load the font
        if (textNode.fontName !== figma.mixed) {
          await figma.loadFontAsync(textNode.fontName as FontName);
        } else {
          const firstFont = textNode.getRangeFontName(0, 1) as FontName;
          await figma.loadFontAsync(firstFont);
        }

        // Extract properties
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

        // Detect section type
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
        console.warn(`Text error "${textNode.characters}":`, error);
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

  // Sort by position (top → bottom, left → right)
  textBlocks.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.x - b.x;
  });

  return textBlocks;
}
