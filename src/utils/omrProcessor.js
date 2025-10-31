import loadOpenCV from "./opencvLoader";

export class OMRProcessor {
  constructor(opts = {}) {
    this.opts = {
      // default to A-D (four choices). You can override by passing opts.choices
      choices: opts.choices || ['A','B','C','D'],
      sampleRadiusPx: 10,
      sampleRadiusFrac: 0.08,      // NEW: fraction of cell to use for sampling (aligns with backend SAMPLE_R_FRAC)
      fillThreshold: 0.45, // fraction of dark pixels inside circle to consider "filled" (tune 0.35..0.6)
      multiThreshold: 0.30, // if two choices both above this -> treat as multiple
      idBlockFrac: { x: 0.06, y: 0.06, w: 0.42, h: 0.22 }, // rough top-left student number block (proportional)
      answersBlockFrac: { x: 0.06, y: 0.32, w: 0.88, h: 0.62 }, // answer area fallback
      DEBUG: !!opts.DEBUG,
      ...opts
    };
    this.cv = null;
  }

  async init() {
    if (!this.cv) {
      this.cv = await loadOpenCV();
    }
  }

  // This is the main method that should be called
  // change process signature to accept columns (vertical columns on sheet)
  async process(canvas, totalQuestions = 100, templateCoords = null, columns = 4) {
    // Validate total questions
    if (totalQuestions < 1 || totalQuestions > 1000) {
      throw new Error('Total questions must be between 1 and 1000');
    }

    // ensure image enhancements applied
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const enhanced = this.enhanceImage(imageData);
      if (enhanced) {
        try { ctx.putImageData(enhanced, 0, 0); }
        catch (e) { /* fallback ignored */ }
      }
    } catch (e) {
      // cross-origin canvas may throw; continue without enhancement
      if (this.opts.DEBUG) console.warn('enhanceImage skipped', e);
    }

    const results = { answers: [], raw: [], detail: [], studentNumber: null };

    // detect student number from top-left block (fallback heuristic)
    try {
      results.studentNumber = this.detectStudentNumber(canvas);
      if (this.opts.DEBUG) console.debug('Detected studentNumber', results.studentNumber);
    } catch (e) {
      if (this.opts.DEBUG) console.warn('detectStudentNumber failed', e);
      results.studentNumber = null;
    }

    // If template provided, use it -> (templateCoords handling left as-is)
    if (templateCoords && Array.isArray(templateCoords) && templateCoords.length) {
      for (let q = 0; q < templateCoords.length; q++) {
        const tpl = templateCoords[q];
        const choiceScores = [];
        for (let c = 0; c < tpl.choices.length; c++) {
          const ch = tpl.choices[c];
          const score = this.sampleCircleDarkness(ctx, ch.x, ch.y, ch.r || this.opts.sampleRadiusPx);
          choiceScores.push({ choice: this.opts.choices[c] || `?${c}`, score });
        }
        // interpret picks
        const picks = choiceScores.filter(s => s.score >= this.opts.multiThreshold).map(s => s.choice);
        let final;
        if (picks.length === 0) {
          const top = choiceScores.reduce((a,b)=> a.score>b.score?a:b);
          final = top.score >= this.opts.fillThreshold ? top.choice : '';
        } else if (picks.length === 1) {
          const single = picks[0];
          final = single;
        } else {
          final = picks.join(','); // multiple
        }
        results.answers[q] = final;
        results.detail[q] = { choiceScores, picks };
      }

      // debug: print first 10 questions detail to console
      if (this.DEBUG) console.debug('OMR template results detail', results.detail.slice(0, 10));
      return results;
    }

    // fallback grid approach: use 'columns' to compute rows (same strategy as backend)
    const choices = this.opts.choices.slice(0, Math.max(1, this.opts.choices.length));
    const cols = columns; // vertical columns on sheet (e.g. 4)
    const rows = Math.ceil(totalQuestions / cols); // rows per column
    const w = canvas.width;
    const h = canvas.height;

    const ansF = this.opts.answersBlockFrac;
    const marginX = Math.floor(w * ansF.x);
    const marginY = Math.floor(h * ansF.y);
    const usableW = Math.floor(w * ansF.w);
    const usableH = Math.floor(h * ansF.h);

    const cellW = usableW / cols;
    const cellH = usableH / rows;
    // compute bubble radius from relative fraction (aligns with backend SAMPLE_R_FRAC)
    const bubbleR = Math.max(5, Math.round(Math.min(cellW, cellH) * (this.opts.sampleRadiusFrac || 0.08)));

    const ctx2 = canvas.getContext('2d', { willReadFrequently: true });

    for (let q = 0; q < totalQuestions; q++) {
      // map question index to (col,row) same as backend
      const col = Math.floor(q / rows);
      const row = q % rows;
      const baseX = marginX + col * cellW + cellW * 0.5;
      const baseY = marginY + row * cellH + cellH * 0.5;

      const choiceScores = [];
      // horizontal spacing between choices
      const spacing = Math.min(cellW * 0.8, cellH * 0.8) / (choices.length + 0.5);
      const startX = baseX - ((choices.length - 1) * spacing) / 2;

      for (let c = 0; c < choices.length; c++) {
        const cx = startX + c * spacing;
        const cy = baseY;
        const score = this.sampleCircleDarkness(ctx2, cx, cy, bubbleR);
        choiceScores.push({ choice: choices[c], score, cx, cy, r: bubbleR });
      }

      // sort descending by score
      const sorted = [...choiceScores].sort((a,b) => b.score - a.score);
      const top = sorted[0];
      const second = sorted[1] || { score: 0 };

      let final = '';
      if (top.score >= this.opts.fillThreshold && (top.score - second.score > (this.opts.multiThreshold*0.5))) {
        // single clear pick
        final = top.choice;
      } else {
        // check for multi-marks (any above multiThreshold)
        const picks = choiceScores.filter(s => s.score >= this.opts.multiThreshold).map(s => s.choice);
        if (picks.length === 1 && choiceScores.find(s => s.choice === picks[0]).score >= this.opts.fillThreshold) {
          final = picks[0];
        } else if (picks.length > 1) {
          final = picks.join(','); // multiple
        } else {
          final = ''; // unanswered
        }
      }

      results.answers[q] = final || '';
      results.detail[q] = choiceScores;
    }

    if (this.opts.DEBUG) {
      console.debug('OMR fallback results detail (first 20)', results.detail.slice(0,20));
    }

    return results;
  }

  // helper: sample circle average darkness (0..1)
  sampleCircleDarkness(ctx, cx, cy, r) {
    const x0 = Math.max(0, Math.floor(cx - r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const w = Math.min(ctx.canvas.width - x0, Math.ceil(r * 2));
    const h = Math.min(ctx.canvas.height - y0, Math.ceil(r * 2));
    if (w <= 0 || h <= 0) return 0;
    const img = ctx.getImageData(x0, y0, w, h);
    let sumLum = 0;
    let count = 0;
    const r2 = r * r;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const dx = xx + x0 - cx;
        const dy = yy + y0 - cy;
        if ((dx*dx + dy*dy) <= r2) {
          const idx = (yy * w + xx) * 4;
          // luminance
          const R = img.data[idx], G = img.data[idx+1], B = img.data[idx+2];
          const lum = 0.299 * R + 0.587 * G + 0.114 * B;
          sumLum += lum;
          count++;
        }
      }
    }
    if (!count) return 0;
    const avgLum = sumLum / count;
    const darkness = 1 - (avgLum / 255);
    return Math.max(0, Math.min(1, darkness));
  }

  // Basic image enhancement (grayscale + contrast stretch)
  enhanceImage(imageData) {
    try {
      const data = new Uint8ClampedArray(imageData.data);
      const width = imageData.width;
      const height = imageData.height;

      // convert to grayscale + contrast stretch
      // compute min/max luminance
      let minL = 255, maxL = 0;
      const lum = new Float32Array((data.length / 4));
      let li = 0;
      for (let i = 0; i < data.length; i += 4) {
        const g = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
        lum[li++] = g;
        if (g < minL) minL = g;
        if (g > maxL) maxL = g;
      }
      const contrast = (maxL - minL) < 10 ? 1.6 : 1.2;
      li = 0;
      for (let i = 0; i < data.length; i += 4) {
        let v = lum[li++];
        // stretch then apply mild gamma
        v = Math.round(((v - minL) / Math.max(1, (maxL - minL))) * 255);
        v = Math.round(128 + (v - 128) * contrast);
        v = Math.max(0, Math.min(255, v));
        data[i] = data[i+1] = data[i+2] = v;
      }

      return new ImageData(data, width, height);
    } catch (e) {
      if (this.opts.DEBUG) console.warn('enhanceImage error', e);
      return null;
    }
  }

  // detect student number from a top-left block (returns string of digits or null)
  // detectStudentNumber: use sampleRadiusFrac for ID cell radius
  detectStudentNumber(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const w = canvas.width, h = canvas.height;
    const f = this.opts.idBlockFrac;
    const x0 = Math.floor(w * f.x);
    const y0 = Math.floor(h * f.y);
    const bw = Math.floor(w * f.w);
    const bh = Math.floor(h * f.h);

    // basic bounds check
    if (bw <= 0 || bh <= 0) return null;

    const idImg = ctx.getImageData(x0, y0, bw, bh);
    // draw id area to an offscreen canvas for easier sampling by sampleCircleDarkness
    const off = document.createElement('canvas');
    off.width = bw; off.height = bh;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.putImageData(idImg, 0, 0);

    const cols = 11;
    const rows = 10;
    const cellW = bw / cols;
    const cellH = bh / rows;
    // radius relative to cell size
    const r = Math.max(6, Math.round(Math.min(cellW, cellH) * (this.opts.sampleRadiusFrac || 0.08)));

    const digits = [];
    for (let col = 0; col < cols; col++) {
      const scores = [];
      for (let row = 0; row < rows; row++) {
        const cx = Math.floor(col * cellW + cellW * 0.5);
        const cy = Math.floor(row * cellH + cellH * 0.5);
        const score = this.sampleCircleDarkness(octx, cx, cy, r);
        scores.push(score);
      }
      // pick max score as marked digit if above threshold (lower threshold for ID)
      const maxIdx = scores.indexOf(Math.max(...scores));
      const maxVal = scores[maxIdx];
      if (maxVal >= (this.opts.fillThreshold * 0.8)) {
        digits.push(String(maxIdx));
      } else {
        digits.push('?'); // uncertain
      }
      if (this.opts.DEBUG && col < 10) {
        console.debug(`ID col ${col}: scores=${scores}, maxIdx=${maxIdx}, maxVal=${maxVal}`);
      }
    }

    const studentId = digits.join('').replace(/^\?+|\?+$/g,'');
    return studentId || null;
  }
}