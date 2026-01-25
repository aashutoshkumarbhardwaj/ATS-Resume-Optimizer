/**
 * Resume Improve Service
 * Applies mutation-only changes to original files
 */

const fs = require('fs').promises;
const path = require('path');
const FileUploadService = require('./fileUploadService');
const DocumentGenerator = require('./documentGenerator');
const PdfInPlaceEditor = require('./pdfInPlaceEditor');

class ResumeImproveService {
    static downloads = new Map();

    static storeDownload(filePath) {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        this.downloads.set(id, filePath);
        return id;
    }

    static getDownloadPath(id) {
        return this.downloads.get(id);
    }

    static buildLineDiffs(originalLines, improvedLines, maxWordsAddedPerLine) {
        const changes = [];
        const limit = Math.min(originalLines.length, improvedLines.length);

        for (let i = 0; i < limit; i++) {
            const original = originalLines[i] || '';
            const improved = improvedLines[i] || '';

            if (!original || !improved || original === improved) continue;

            const originalWords = original.split(/\s+/).filter(Boolean).length;
            const improvedWords = improved.split(/\s+/).filter(Boolean).length;
            const added = improvedWords - originalWords;

            if (added > maxWordsAddedPerLine) {
                continue;
            }

            changes.push({ original, improved, lineIndex: i });
        }

        return changes;
    }

    static async improveFile(file, options = {}) {
        const {
            optimizedText = '',
            maxWordsAddedPerLine = 3,
            allowShrinkFont = true
        } = options;

        const format = FileUploadService.getFileFormat(file.mimetype, file.originalname);
        const outputDir = path.join(__dirname, '../../temp');
        await fs.mkdir(outputDir, { recursive: true });

        const fileBuffer = await fs.readFile(file.path);

        if (format === 'PDF') {
            const linesByPage = await PdfInPlaceEditor.extractLines(fileBuffer);
            const originalLines = linesByPage.flatMap(lines => lines.map(line => line.text));
            const improvedLines = optimizedText.split(/\r?\n/);

            const diffs = this.buildLineDiffs(originalLines, improvedLines, Number(maxWordsAddedPerLine) || 3);

            const changes = [];
            let globalIndex = 0;
            for (let pageIndex = 0; pageIndex < linesByPage.length; pageIndex++) {
                const lines = linesByPage[pageIndex];
                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    const match = diffs.find(diff => diff.lineIndex === globalIndex);
                    if (match) {
                        changes.push({
                            page: pageIndex,
                            line: lines[lineIndex],
                            original: match.original,
                            improved: match.improved
                        });
                    }
                    globalIndex++;
                }
            }

            const updatedBytes = await PdfInPlaceEditor.applyChanges(fileBuffer, changes, {
                allowShrinkFont: Boolean(allowShrinkFont)
            });

            const filename = `Resume_Improved_${Date.now()}.pdf`;
            const outputPath = path.join(outputDir, filename);
            await fs.writeFile(outputPath, updatedBytes);

            return {
                filePath: outputPath,
                changes: changes.map(change => ({
                    page: change.page + 1,
                    original: change.original,
                    improved: change.improved
                }))
            };
        }

        if (format === 'DOCX') {
            const outputPath = await DocumentGenerator.generateDOCXFromText(
                optimizedText,
                `Resume_Improved_${Date.now()}`
            );

            return {
                filePath: outputPath,
                changes: []
            };
        }

        throw new Error('Unsupported file type. PDF or DOCX required.');
    }
}

module.exports = ResumeImproveService;
