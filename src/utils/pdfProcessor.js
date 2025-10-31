import * as pdfjsLib from "pdfjs-dist";

/*
  Use local worker served from public/
  Make sure public/pdf.worker.min.js exists and restart the dev server.
*/
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export const processPDF = async (file, scale = 2.0) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const results = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    const renderCtx = { canvasContext: ctx, viewport };
    await page.render(renderCtx).promise;
    // ensure canvas is fully painted before returning
    results.push({
      pageNumber: pageNum,
      canvas,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return results;
};