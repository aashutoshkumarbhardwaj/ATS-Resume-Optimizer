/**
 * Document Generator Service
 * Generates downloadable resume documents in various formats
 */

const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

class DocumentGenerator {
    /**
     * Generate document in specified format
     */
    static async generate(resumeData, format, template = 'professional', jobTitle = 'Position') {
        const timestamp = Date.now();
        const filename = `Resume_Optimized_${jobTitle.replace(/\s+/g, '_')}_${timestamp}`;
        
        let filePath;
        
        switch (format.toLowerCase()) {
            case 'pdf':
                filePath = await this.generatePDF(resumeData, template, filename);
                break;
            case 'docx':
                filePath = await this.generateDOCX(resumeData, template, filename);
                break;
            case 'txt':
                filePath = await this.generateTXT(resumeData, filename);
                break;
            default:
                throw new Error('Unsupported format. Use PDF, DOCX, or TXT.');
        }

        return {
            filePath,
            filename: path.basename(filePath),
            format: format.toUpperCase()
        };
    }

    /**
     * Generate PDF document
     */
    static async generatePDF(resumeData, template, filename) {
        const templates = this.getTemplates();
        const templateConfig = templates[template] || templates.professional;

        const outputDir = path.join(__dirname, '../../temp');
        await fs.mkdir(outputDir, { recursive: true });
        
        const filePath = path.join(outputDir, `${filename}.pdf`);

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: {
                    top: templateConfig.margins.top * 72,
                    bottom: templateConfig.margins.bottom * 72,
                    left: templateConfig.margins.left * 72,
                    right: templateConfig.margins.right * 72
                }
            });

            const stream = require('fs').createWriteStream(filePath);
            doc.pipe(stream);

            // Set font
            doc.font('Helvetica');

            // Contact Information
            if (resumeData.contact.name) {
                doc.fontSize(20)
                   .fillColor(templateConfig.colors.primary)
                   .text(resumeData.contact.name, { align: 'center' });
                doc.moveDown(0.5);
            }

            const contactParts = [];
            if (resumeData.contact.email) contactParts.push(resumeData.contact.email);
            if (resumeData.contact.phone) contactParts.push(resumeData.contact.phone);
            if (resumeData.contact.location) contactParts.push(resumeData.contact.location);
            
            if (contactParts.length > 0) {
                doc.fontSize(10)
                   .fillColor(templateConfig.colors.accent)
                   .text(contactParts.join(' | '), { align: 'center' });
            }

            if (resumeData.contact.linkedin) {
                doc.fontSize(10)
                   .fillColor(templateConfig.colors.accent)
                   .text(resumeData.contact.linkedin, { align: 'center', link: `https://${resumeData.contact.linkedin}` });
            }

            doc.moveDown(1);

            // Summary
            if (resumeData.summary) {
                this.addPDFSection(doc, 'PROFESSIONAL SUMMARY', templateConfig);
                doc.fontSize(10)
                   .fillColor(templateConfig.colors.primary)
                   .text(resumeData.summary, { align: 'justify' });
                doc.moveDown(1);
            }

            // Experience
            if (resumeData.experience && resumeData.experience.length > 0) {
                this.addPDFSection(doc, 'EXPERIENCE', templateConfig);
                
                resumeData.experience.forEach((exp, index) => {
                    doc.fontSize(12)
                       .fillColor(templateConfig.colors.primary)
                       .font('Helvetica-Bold')
                       .text(exp.title, { continued: false });
                    
                    doc.fontSize(11)
                       .font('Helvetica')
                       .fillColor(templateConfig.colors.accent)
                       .text(`${exp.company}${exp.startDate ? ` | ${exp.startDate} - ${exp.endDate}` : ''}`, { continued: false });
                    
                    doc.moveDown(0.3);

                    exp.bullets.forEach(bullet => {
                        doc.fontSize(10)
                           .fillColor(templateConfig.colors.primary)
                           .list([bullet], {
                               bulletRadius: 2,
                               textIndent: 20,
                               bulletIndent: 10
                           });
                    });

                    if (index < resumeData.experience.length - 1) {
                        doc.moveDown(0.5);
                    }
                });

                doc.moveDown(1);
            }

            // Education
            if (resumeData.education && resumeData.education.length > 0) {
                this.addPDFSection(doc, 'EDUCATION', templateConfig);
                
                resumeData.education.forEach(edu => {
                    let eduText = '';
                    if (edu.degree) eduText += edu.degree;
                    if (edu.field) eduText += ` in ${edu.field}`;
                    
                    doc.fontSize(11)
                       .fillColor(templateConfig.colors.primary)
                       .font('Helvetica-Bold')
                       .text(eduText);
                    
                    let institutionText = '';
                    if (edu.institution) institutionText += edu.institution;
                    if (edu.graduationDate) institutionText += ` | ${edu.graduationDate}`;
                    
                    doc.fontSize(10)
                       .font('Helvetica')
                       .fillColor(templateConfig.colors.accent)
                       .text(institutionText);
                    
                    doc.moveDown(0.5);
                });

                doc.moveDown(0.5);
            }

            // Skills
            if (resumeData.skills && resumeData.skills.length > 0) {
                this.addPDFSection(doc, 'SKILLS', templateConfig);
                doc.fontSize(10)
                   .fillColor(templateConfig.colors.primary)
                   .text(resumeData.skills.join(', '), { align: 'justify' });
                doc.moveDown(1);
            }

            // Certifications
            if (resumeData.certifications && resumeData.certifications.length > 0) {
                this.addPDFSection(doc, 'CERTIFICATIONS', templateConfig);
                resumeData.certifications.forEach(cert => {
                    doc.fontSize(10)
                       .fillColor(templateConfig.colors.primary)
                       .list([cert], {
                           bulletRadius: 2,
                           textIndent: 20,
                           bulletIndent: 10
                       });
                });
            }

            doc.end();

            stream.on('finish', () => resolve(filePath));
            stream.on('error', reject);
        });
    }

    /**
     * Add section header to PDF
     */
    static addPDFSection(doc, title, templateConfig) {
        doc.fontSize(14)
           .fillColor(templateConfig.colors.primary)
           .font('Helvetica-Bold')
           .text(title);
        
        doc.moveTo(doc.x, doc.y)
           .lineTo(doc.page.width - doc.page.margins.right, doc.y)
           .strokeColor(templateConfig.colors.accent)
           .lineWidth(1)
           .stroke();
        
        doc.moveDown(0.5);
        doc.font('Helvetica');
    }

    /**
     * Generate DOCX document
     */
    static async generateDOCX(resumeData, template, filename) {
        const outputDir = path.join(__dirname, '../../temp');
        await fs.mkdir(outputDir, { recursive: true });
        
        const filePath = path.join(outputDir, `${filename}.docx`);

        const sections = [];

        // Contact Information
        if (resumeData.contact.name) {
            sections.push(
                new Paragraph({
                    text: resumeData.contact.name,
                    heading: HeadingLevel.TITLE,
                    alignment: 'center',
                    spacing: { after: 100 }
                })
            );
        }

        const contactParts = [];
        if (resumeData.contact.email) contactParts.push(resumeData.contact.email);
        if (resumeData.contact.phone) contactParts.push(resumeData.contact.phone);
        if (resumeData.contact.location) contactParts.push(resumeData.contact.location);
        if (resumeData.contact.linkedin) contactParts.push(resumeData.contact.linkedin);

        if (contactParts.length > 0) {
            sections.push(
                new Paragraph({
                    text: contactParts.join(' | '),
                    alignment: 'center',
                    spacing: { after: 200 }
                })
            );
        }

        // Summary
        if (resumeData.summary) {
            sections.push(
                new Paragraph({
                    text: 'PROFESSIONAL SUMMARY',
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 200, after: 100 }
                })
            );
            sections.push(
                new Paragraph({
                    text: resumeData.summary,
                    spacing: { after: 200 }
                })
            );
        }

        // Experience
        if (resumeData.experience && resumeData.experience.length > 0) {
            sections.push(
                new Paragraph({
                    text: 'EXPERIENCE',
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 200, after: 100 }
                })
            );

            resumeData.experience.forEach(exp => {
                sections.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: exp.title,
                                bold: true,
                                size: 24
                            })
                        ],
                        spacing: { after: 50 }
                    })
                );

                sections.push(
                    new Paragraph({
                        text: `${exp.company}${exp.startDate ? ` | ${exp.startDate} - ${exp.endDate}` : ''}`,
                        spacing: { after: 100 }
                    })
                );

                exp.bullets.forEach(bullet => {
                    sections.push(
                        new Paragraph({
                            text: bullet,
                            bullet: { level: 0 },
                            spacing: { after: 50 }
                        })
                    );
                });

                sections.push(new Paragraph({ text: '', spacing: { after: 100 } }));
            });
        }

        // Education
        if (resumeData.education && resumeData.education.length > 0) {
            sections.push(
                new Paragraph({
                    text: 'EDUCATION',
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 200, after: 100 }
                })
            );

            resumeData.education.forEach(edu => {
                let eduText = '';
                if (edu.degree) eduText += edu.degree;
                if (edu.field) eduText += ` in ${edu.field}`;

                sections.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: eduText,
                                bold: true
                            })
                        ],
                        spacing: { after: 50 }
                    })
                );

                let institutionText = '';
                if (edu.institution) institutionText += edu.institution;
                if (edu.graduationDate) institutionText += ` | ${edu.graduationDate}`;

                sections.push(
                    new Paragraph({
                        text: institutionText,
                        spacing: { after: 100 }
                    })
                );
            });
        }

        // Skills
        if (resumeData.skills && resumeData.skills.length > 0) {
            sections.push(
                new Paragraph({
                    text: 'SKILLS',
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 200, after: 100 }
                })
            );
            sections.push(
                new Paragraph({
                    text: resumeData.skills.join(', '),
                    spacing: { after: 200 }
                })
            );
        }

        // Certifications
        if (resumeData.certifications && resumeData.certifications.length > 0) {
            sections.push(
                new Paragraph({
                    text: 'CERTIFICATIONS',
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 200, after: 100 }
                })
            );

            resumeData.certifications.forEach(cert => {
                sections.push(
                    new Paragraph({
                        text: cert,
                        bullet: { level: 0 },
                        spacing: { after: 50 }
                    })
                );
            });
        }

        const doc = new Document({
            sections: [{
                properties: {},
                children: sections
            }]
        });

        const buffer = await Packer.toBuffer(doc);
        await fs.writeFile(filePath, buffer);

        return filePath;
    }

    /**
     * Generate TXT document
     */
    static async generateTXT(resumeData, filename) {
        const outputDir = path.join(__dirname, '../../temp');
        await fs.mkdir(outputDir, { recursive: true });
        
        const filePath = path.join(outputDir, `${filename}.txt`);

        let text = '';

        // Contact Information
        if (resumeData.contact.name) {
            text += `${resumeData.contact.name}\n`;
        }
        
        const contactParts = [];
        if (resumeData.contact.email) contactParts.push(resumeData.contact.email);
        if (resumeData.contact.phone) contactParts.push(resumeData.contact.phone);
        if (resumeData.contact.location) contactParts.push(resumeData.contact.location);
        if (resumeData.contact.linkedin) contactParts.push(resumeData.contact.linkedin);
        
        if (contactParts.length > 0) {
            text += contactParts.join(' | ') + '\n\n';
        }

        // Summary
        if (resumeData.summary) {
            text += 'PROFESSIONAL SUMMARY\n';
            text += '='.repeat(50) + '\n';
            text += resumeData.summary + '\n\n';
        }

        // Experience
        if (resumeData.experience && resumeData.experience.length > 0) {
            text += 'EXPERIENCE\n';
            text += '='.repeat(50) + '\n\n';
            
            resumeData.experience.forEach(exp => {
                text += `${exp.title}\n`;
                text += `${exp.company}${exp.startDate ? ` | ${exp.startDate} - ${exp.endDate}` : ''}\n`;
                
                exp.bullets.forEach(bullet => {
                    text += `• ${bullet}\n`;
                });
                text += '\n';
            });
        }

        // Education
        if (resumeData.education && resumeData.education.length > 0) {
            text += 'EDUCATION\n';
            text += '='.repeat(50) + '\n\n';
            
            resumeData.education.forEach(edu => {
                let eduText = '';
                if (edu.degree) eduText += edu.degree;
                if (edu.field) eduText += ` in ${edu.field}`;
                text += eduText + '\n';
                
                let institutionText = '';
                if (edu.institution) institutionText += edu.institution;
                if (edu.graduationDate) institutionText += ` | ${edu.graduationDate}`;
                text += institutionText + '\n\n';
            });
        }

        // Skills
        if (resumeData.skills && resumeData.skills.length > 0) {
            text += 'SKILLS\n';
            text += '='.repeat(50) + '\n';
            text += resumeData.skills.join(', ') + '\n\n';
        }

        // Certifications
        if (resumeData.certifications && resumeData.certifications.length > 0) {
            text += 'CERTIFICATIONS\n';
            text += '='.repeat(50) + '\n';
            resumeData.certifications.forEach(cert => {
                text += `• ${cert}\n`;
            });
        }

        await fs.writeFile(filePath, text.trim(), 'utf-8');

        return filePath;
    }

    /**
     * Get template configurations
     */
    static getTemplates() {
        return {
            professional: {
                font: 'Arial',
                fontSize: 11,
                margins: { top: 0.5, bottom: 0.5, left: 0.75, right: 0.75 },
                colors: { primary: '#000000', accent: '#333333' }
            },
            modern: {
                font: 'Calibri',
                fontSize: 11,
                margins: { top: 0.5, bottom: 0.5, left: 0.75, right: 0.75 },
                colors: { primary: '#1a1a1a', accent: '#0066cc' }
            }
        };
    }

    /**
     * Clean up old temporary files
     */
    static async cleanupOldFiles() {
        try {
            const tempDir = path.join(__dirname, '../../temp');
            const files = await fs.readdir(tempDir);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtimeMs > maxAge) {
                    await fs.unlink(filePath);
                    console.log(`Cleaned up old file: ${file}`);
                }
            }
        } catch (error) {
            console.error('Error cleaning up old files:', error);
        }
    }
}

module.exports = DocumentGenerator;
