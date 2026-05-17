/**
 * img-to-pdf.worker.js
 * Converts image files (JPG/PNG/WEBP) to a PDF using pdf-lib running locally.
 */

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type !== 'convert') return;

  try {
    self.postMessage({ type: 'status', message: 'Loading PDF library...' });

    // Load pdf-lib from the bundled local copy
    importScripts('../pdf-lib/pdf-lib.min.js');
    const { PDFDocument } = PDFLib;

    self.postMessage({ type: 'status', message: 'Creating PDF...' });

    const response = await fetch(msg.fileUri);
    const arrayBuffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const pdfDoc = await PDFDocument.create();

    let image;
    const uri = msg.fileUri.toLowerCase();
    if (uri.includes('.png')) {
      image = await pdfDoc.embedPng(uint8);
    } else {
      // default to jpg
      image = await pdfDoc.embedJpg(uint8);
    }

    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

    self.postMessage({ type: 'progress', percent: 80, message: 'Finalizing PDF...' });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    self.postMessage({ type: 'convert-complete', result: blob });
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err) });
  }
};
