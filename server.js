const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('./')); // Serve frontend files

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get('/api/status', (req, res) => res.json({ status: 'online' }));

// ── IMAGE CONVERSION ──
app.post('/api/convert-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No image uploaded');
        const targetFormat = req.body.format || 'webp';

        let pipeline = sharp(req.file.buffer);
        
        if (targetFormat === 'webp') pipeline = pipeline.webp();
        else if (targetFormat === 'png') pipeline = pipeline.png();
        else if (targetFormat === 'jpg' || targetFormat === 'jpeg') pipeline = pipeline.jpeg();
        else if (targetFormat === 'avif') pipeline = pipeline.avif();

        const convertedBuffer = await pipeline.toBuffer();

        res.set({
            'Content-Type': `image/${targetFormat}`,
            'Content-Disposition': `attachment; filename="converted-image.${targetFormat}"`
        });
        res.send(convertedBuffer);
    } catch (err) {
        console.error('Conversion Error:', err.message);
        res.status(500).json({ error: 'Conversion failed' });
    }
});

// ── IMAGE ENHANCEMENT (HD GENERATOR) ──
app.post('/api/enhance-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No image uploaded');

        // Process directly in memory
        const enhancedBuffer = await sharp(req.file.buffer)
            .resize({ 
                width: 2500,
                withoutEnlargement: false,
                kernel: sharp.kernel.lanczos3 
            })
            .modulate({ brightness: 1.05, saturation: 1.1 })
            .sharpen()
            .jpeg({ quality: 90 })
            .toBuffer();

        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Disposition': 'attachment; filename="DAP-HD-Enhanced.jpg"'
        });
        res.send(enhancedBuffer);

    } catch (err) {
        console.error('Sharp Error:', err.message);
        res.status(500).json({ error: 'Image processing failed.' });
    }
});

// ── PDF COMPRESSION ──
app.post('/api/compress-pdf', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No PDF uploaded');

        // Load the source PDF
        const pdfDoc = await PDFDocument.load(req.file.buffer).catch(e => { throw new Error('Invalid PDF file'); });
        
        // --- REAL WORLD IMAGE OPTIMIZATION ---
        const enumerateXObjects = (obj) => {
            if (!obj || typeof obj !== 'object') return [];
            const xObjects = [];
            const dict = obj.dict || obj;
            if (dict instanceof Map && dict.has(require('pdf-lib').PDFName.of('XObject'))) {
                const xObjDict = dict.get(require('pdf-lib').PDFName.of('XObject'));
                if (xObjDict instanceof require('pdf-lib').PDFDict) {
                    xObjDict.entries().forEach(([name, ref]) => {
                        xObjects.push(ref);
                    });
                }
            }
            return xObjects;
        };

        // Deep Compression Logic: Downsample embedded images
        const images = [];
        const context = pdfDoc.context;
        for (const [ref, obj] of context.enumerateIndirectObjects()) {
            if (obj instanceof require('pdf-lib').PDFRawStream) {
                const dict = obj.dict;
                const subtype = dict.get(require('pdf-lib').PDFName.of('Subtype'));
                if (subtype && subtype.toString() === '/Image') {
                    try {
                        const originalData = obj.contents;
                        const width = dict.get(require('pdf-lib').PDFName.of('Width')).value;
                        const height = dict.get(require('pdf-lib').PDFName.of('Height')).value;
                        
                        // Use Sharp to shrink the image data
                        const compressedData = await sharp(originalData)
                            .jpeg({ quality: 50, progressive: true })
                            .toBuffer();
                            
                        if (compressedData.length < originalData.length) {
                            obj.contents = compressedData;
                            dict.set(require('pdf-lib').PDFName.of('Filter'), require('pdf-lib').PDFName.of('DCTDecode'));
                            dict.set(require('pdf-lib').PDFName.of('Length'), require('pdf-lib').PDFNumber.of(compressedData.length));
                        }
                    } catch (err) {
                        // Skip if not a compatible image format
                    }
                }
            }
        }

        // Final structural optimization
        pdfDoc.setProducer('DAP AI Engine');
        const compressedBytes = await pdfDoc.save({ 
            useObjectStreams: true,
            addDefaultPage: false 
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Compressed_${req.file.originalname}"`
        });
        res.send(Buffer.from(compressedBytes));

    } catch (err) {
        console.error('PDF Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`DAP Backend running at http://localhost:${PORT}`);
});
