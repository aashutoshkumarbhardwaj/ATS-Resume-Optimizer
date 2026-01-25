/**
 * PDF In-Place Editor
 * Applies minimal text mutations at original positions
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

let pdfjsLibPromise = null;

async function loadPdfJs() {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = import('pdfjs-dist/build/pdf.mjs');
    }
    return pdfjsLibPromise;
}

class PdfInPlaceEditor {
    /**
     * Extract text lines with positions from a PDF buffer
     */
    static async extractLines(pdfBytes) {
        const pdfjsLib = await loadPdfJs();
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        const pdf = await loadingTask.promise;
        const pages = [];

        for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
            const page = await pdf.getPage(pageIndex);
            const viewport = page.getViewport({ scale: 1.0 });
            const textContent = await page.getTextContent();

            const lines = [];

            for (const item of textContent.items) {
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const x = tx[4];
                const y = tx[5];
                const pdfY = viewport.height - y;
                const height = item.height || 10;
                const width = item.width || 0;

                const existingLine = lines.find(line => Math.abs(line.y - pdfY) <= 2);
                const lineItem = { text: item.str, x, width, height };

                if (existingLine) {
                    existingLine.items.push(lineItem);
                    existingLine.y = Math.max(existingLine.y, pdfY);
                    existingLine.height = Math.max(existingLine.height, height);
                } else {
                    lines.push({
                        y: pdfY,
                        height,
                        items: [lineItem]
                    });
                }
            }

            const normalized = lines
                .map(line => {
                    const items = line.items.sort((a, b) => a.x - b.x);
                    let text = '';
                    let lastX = null;
                    let minX = null;
                    let maxX = null;

                    for (const item of items) {
                        if (lastX !== null && item.x - lastX > 2) {
                            text += ' ';
                        }
                        text += item.text;
                        lastX = item.x + item.width;
                        minX = minX === null ? item.x : Math.min(minX, item.x);
                        maxX = maxX === null ? item.x + item.width : Math.max(maxX, item.x + item.width);
                    }

                    return {
                        text: text,
                        x: minX || 0,
                        y: line.y,
                        width: Math.max((maxX || 0) - (minX || 0), 1),
                        height: line.height || 10
                    };
                })
                .filter(line => line.text && line.text.trim().length > 0)
                .sort((a, b) => b.y - a.y);

            pages.push(normalized);
        }

        return pages;
    }

    /**
     * Apply text changes to a PDF buffer
     */
    static async applyChanges(pdfBytes, changes, options = {}) {
        const { allowShrinkFont = true } = options;
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        for (const change of changes) {
            const page = pages[change.page];
            const line = change.line;
            if (!page || !line) continue;

            const baseSize = Math.max(Math.floor(line.height), 8);
            let fontSize = baseSize;

            const originalWidth = line.width;
            const textWidth = font.widthOfTextAtSize(change.improved, fontSize);

            if (textWidth > originalWidth) {
                if (!allowShrinkFont) {
                    continue;
                }
                const ratio = originalWidth / textWidth;
                fontSize = Math.max(Math.floor(fontSize * ratio), 6);
            }

            page.drawRectangle({
                x: line.x,
                y: line.y - fontSize * 0.2,
                width: originalWidth,
                height: line.height * 1.2,
                color: rgb(1, 1, 1)
            });

            page.drawText(change.improved, {
                x: line.x,
                y: line.y,
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
                maxWidth: originalWidth
            });
        }

        return await pdfDoc.save();
    }
}

module.exports = PdfInPlaceEditor;
