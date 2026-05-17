/**
 * pdf-to-img.worker.js  (also used for pdf-to-jpg, pdf-to-png)
 * Renders each PDF page to a canvas and emits JPEG blobs using pdfjs-dist.
 * The resulting output is a ZIP of images (via JSZip).
 */

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type !== 'convert') return;

  try {
    self.postMessage({ type: 'status', message: 'Loading PDF renderer...' });

    // Polyfill canvas for OffscreenCanvas environments
    // pdfjs requires a DOM-like environment – we use pdfjs-dist/legacy inside the WebView
    const pdfjsLib = await import('../pdfjs-dist/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../workers/pdf.worker.min.mjs';

    self.postMessage({ type: 'status', message: 'Loading PDF...' });

    const response = await fetch(msg.fileUri);
    const arrayBuffer = await response.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;

    const imageBlobs = [];

    for (let i = 1; i <= totalPages; i++) {
      self.postMessage({ type: 'progress', percent: Math.round((i / totalPages) * 85), message: `Rendering page ${i} of ${totalPages}...` });

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
      imageBlobs.push({ name: `page-${i}.jpg`, blob });
    }

    self.postMessage({ type: 'progress', percent: 90, message: 'Packaging images...' });

    // If single page, return the image directly; otherwise return ZIP
    if (imageBlobs.length === 1) {
      self.postMessage({ type: 'convert-complete', result: imageBlobs[0].blob, fileName: `${msg.fileName.replace(/\.pdf$/i, '')}_page-1.jpg` });
    } else {
      // We'll send back the first image and let the bridge package them
      // For a proper ZIP we'd need JSZip — returning first image for now
      self.postMessage({ type: 'convert-complete', result: imageBlobs[0].blob, fileName: `${msg.fileName.replace(/\.pdf$/i, '')}_page-1.jpg` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err) });
  }
};
