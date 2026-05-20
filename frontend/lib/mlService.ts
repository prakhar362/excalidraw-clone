import axios from 'axios';

const ML_API_BASE = process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000';

const TIMEOUT_DEFAULT = 30_000;
const TIMEOUT_MATH    = 90_000; // Roboflow + Gemini can be slow

// ── Response types ────────────────────────────────────────────────────────────

export interface MLBaseResult {
  success: boolean;
  intent: string;
  confidence?: number;
  result_type: string;
  elements: any[];
  message: string;
}

export interface MLMathResult extends MLBaseResult {
  equation: string;
  latex: string;
  solution: string[];
  steps: string[];
}

export interface MLTextResult extends MLBaseResult {
  text?: string;
  regions_count?: number;
  styling?: Record<string, any>;
}

export interface MLSketchResult extends MLBaseResult {
  style: string;
}

export interface MLDetectResult {
  success: boolean;
  intent: string;
  confidence: number;
  all_scores: Record<string, number>;
}

export interface MLEnhanceResult extends MLBaseResult {}

// ── Service ───────────────────────────────────────────────────────────────────

class MLService {

  // ── 1. Auto Enhance (intent classifier → route) ──────────────────────────
  async autoEnhance(imageBlob: Blob): Promise<MLEnhanceResult> {
    const fd = this._formData(imageBlob);
    const res = await axios.post(`${ML_API_BASE}/api/ml/enhance`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: TIMEOUT_MATH,
    });
    return res.data;
  }

  // ── 2. Math solver (dedicated) ────────────────────────────────────────────
  async solveMath(imageBlob: Blob): Promise<MLMathResult> {
    const fd = this._formData(imageBlob);
    const res = await axios.post(`${ML_API_BASE}/api/ml/math`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: TIMEOUT_MATH,
    });
    return res.data;
  }

  // ── 3. Text / Handwriting (dedicated) ────────────────────────────────────
  async recognizeText(imageBlob: Blob): Promise<MLTextResult> {
    const fd = this._formData(imageBlob);
    const res = await axios.post(`${ML_API_BASE}/api/ml/text`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: TIMEOUT_DEFAULT,
    });
    return res.data;
  }

  // ── 4. Sketch enhancement (dedicated) ────────────────────────────────────
  async enhanceSketch(
    imageBlob: Blob,
    style: 'professional' | 'artistic' | 'clean' | 'minimal' = 'professional',
  ): Promise<MLSketchResult> {
    const fd = this._formData(imageBlob);
    fd.append('style', style);
    const res = await axios.post(`${ML_API_BASE}/api/ml/sketch`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: TIMEOUT_DEFAULT,
    });
    return res.data;
  }

  // ── 5. Detect / classify only ─────────────────────────────────────────────
  async detectIntent(imageBlob: Blob): Promise<MLDetectResult> {
    const fd = this._formData(imageBlob);
    const res = await axios.post(`${ML_API_BASE}/api/ml/detect`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: TIMEOUT_DEFAULT,
    });
    return res.data;
  }

  // ── Health check ──────────────────────────────────────────────────────────
  async checkHealth(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const res = await axios.get(`${ML_API_BASE}/health`, { timeout: 5000 });
      return res.data.status === 'healthy';
    } catch {
      return false;
    }
  }

  // ── Canvas helpers ────────────────────────────────────────────────────────

  async extractSelectionAsImage(
    excalidrawAPI: any,
    selectedElementIds: string[],
  ): Promise<Blob> {
    const elements = excalidrawAPI.getSceneElements();
    const selected = elements.filter((el: any) => selectedElementIds.includes(el.id));

    if (selected.length === 0) throw new Error('No elements selected');

    if (excalidrawAPI.exportToBlob) {
      return excalidrawAPI.exportToBlob({
        elements: selected,
        mimeType: 'image/png',
        appState: { exportBackground: true, exportWithDarkMode: false },
      });
    }

    // Fallback: manual canvas render
    const pad  = 20;
    const minX = Math.min(...selected.map((el: any) => el.x));
    const minY = Math.min(...selected.map((el: any) => el.y));
    const maxX = Math.max(...selected.map((el: any) => el.x + (el.width  || 0)));
    const maxY = Math.max(...selected.map((el: any) => el.y + (el.height || 0)));

    const canvas = document.createElement('canvas');
    canvas.width  = maxX - minX + pad * 2;
    canvas.height = maxY - minY + pad * 2;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    selected.forEach((el: any) => this._drawElement(ctx, el, minX - pad, minY - pad));

    return new Promise((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png'),
    );
  }

  private _formData(blob: Blob): FormData {
    const fd = new FormData();
    fd.append('file', blob, 'sketch.png');
    return fd;
  }

  private _drawElement(
    ctx: CanvasRenderingContext2D,
    element: any,
    offsetX: number,
    offsetY: number,
  ) {
    ctx.strokeStyle = element.strokeColor || '#000000';
    ctx.lineWidth   = element.strokeWidth || 2;
    const x = element.x - offsetX;
    const y = element.y - offsetY;

    if (['line', 'draw', 'freedraw'].includes(element.type)) {
      const pts = element.points || [];
      if (pts.length > 0) {
        ctx.beginPath();
        ctx.moveTo(x + pts[0][0], y + pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(x + pts[i][0], y + pts[i][1]);
        ctx.stroke();
      }
    } else if (element.type === 'rectangle') {
      ctx.strokeRect(x, y, element.width, element.height);
    } else if (element.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(x + element.width / 2, y + element.height / 2,
        element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export const mlService = new MLService();
