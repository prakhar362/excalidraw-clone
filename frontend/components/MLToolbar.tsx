'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { mlService } from '@/lib/mlService';
import { Loader2, Sparkles, Brain, Calculator, Type, Image as ImageIcon, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { EnhancementPreview } from './EnhancementPreview';

interface MLToolbarProps {
  excalidrawAPI: any;
}

interface MathResult {
  equation: string;
  solution: string[];
  steps: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSelectedIds(api: any): string[] {
  return Object.keys(api.getAppState().selectedElementIds || {});
}

async function addElementsToCanvas(api: any, rawElements: any[], offsetX = 0, offsetY = 0) {
  const existing = api.getSceneElements();
  const shifted = rawElements.map((el: any) => ({
    ...el,
    x: (el.x ?? 0) + offsetX,
    y: (el.y ?? 0) + offsetY,
  }));

  try {
    const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
    const safe = convertToExcalidrawElements(shifted);
    api.updateScene({ elements: [...existing, ...safe] });
  } catch {
    // fallback: inject with minimal required fields
    api.updateScene({
      elements: [
        ...existing,
        ...shifted.map((el: any) => ({
          ...el,
          version: 1,
          versionNonce: Math.floor(Math.random() * 1e6),
          isDeleted: false,
          updated: Date.now(),
          seed: Math.floor(Math.random() * 1e6),
          groupIds: el.groupIds ?? [],
          boundElements: el.boundElements ?? [],
          link: el.link ?? null,
          locked: el.locked ?? false,
        })),
      ],
    });
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MLToolbar: React.FC<MLToolbarProps> = ({ excalidrawAPI }) => {
  const [processing, setProcessing] = useState(false);
  const [activeBtn, setActiveBtn] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [isHealthy, setIsHealthy] = useState(false);
  const [mathResult, setMathResult] = useState<MathResult | null>(null);

  // Sketch enhancement modal states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    mlService.checkHealth().then(setIsHealthy);
  }, []);

  // ── Place math solution text on canvas ──────────────────────────────
  const placeMathOnCanvas = useCallback(async (result: MathResult) => {
    if (!excalidrawAPI) return;
    const appState = excalidrawAPI.getAppState();
    const zoom = appState.zoom?.value ?? 1;
    const cx = -appState.scrollX + window.innerWidth / 2 / zoom;
    const cy = -appState.scrollY + window.innerHeight / 2 / zoom;

    const textEls = [
      { text: result.equation, color: '#6366f1', size: 22, dy: -40 },
      { text: `x = ${result.solution.join(', ')}`, color: '#16a34a', size: 28, dy: 20 },
    ].map(({ text, color, size, dy }, i) => ({
      id: `math-${Date.now()}-${i}`,
      type: 'text' as const,
      x: cx - 120,
      y: cy + dy,
      width: 320,
      height: size * 1.5,
      text,
      fontSize: size,
      fontFamily: 1,
      textAlign: 'left' as const,
      verticalAlign: 'middle' as const,
      strokeColor: color,
      backgroundColor: 'transparent',
      fillStyle: 'solid' as const,
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
    }));

    await addElementsToCanvas(excalidrawAPI, textEls);
  }, [excalidrawAPI]);

  // ── Generic runner ───────────────────────────────────────────────────
  const run = useCallback(async (
    label: string,
    fn: (blob: Blob) => Promise<any>,
    onSuccess: (result: any) => void,
    waitMsg = 'Processing…',
  ) => {
    const ids = getSelectedIds(excalidrawAPI);
    if (ids.length === 0) { toast.error('Select elements first'); return; }

    setProcessing(true);
    setActiveBtn(label);
    setStatusMsg(waitMsg);
    setMathResult(null);

    try {
      const blob = await mlService.extractSelectionAsImage(excalidrawAPI, ids);
      const result = await fn(blob);

      if (!result.success) {
        toast.error(result.message || 'Processing failed');
        return;
      }

      onSuccess(result);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || err.message || 'Processing failed');
    } finally {
      setProcessing(false);
      setActiveBtn(null);
      setStatusMsg('');
    }
  }, [excalidrawAPI]);

  // ── Button handlers — each calls its own dedicated endpoint ─────────

  // Auto Enhance → /api/ml/enhance (intent classifier decides)
  const handleAutoEnhance = () => run('enhance', mlService.autoEnhance.bind(mlService), async (result) => {
    if (result.result_type === 'math_solution') {
      const mr = { equation: result.equation, solution: result.solution, steps: result.steps };
      setMathResult(mr);
      await placeMathOnCanvas(mr);
      toast.success('✅ Equation solved!');
    } else if (result.result_type?.includes('text')) {
      await addElementsToCanvas(excalidrawAPI, result.elements);
      toast.success(result.message);
    } else {
      const sel = excalidrawAPI.getSceneElements().filter((el: any) =>
        getSelectedIds(excalidrawAPI).includes(el.id));
      const ox = sel.length ? Math.min(...sel.map((e: any) => e.x)) + 60 : 0;
      const oy = sel.length ? Math.min(...sel.map((e: any) => e.y)) + 60 : 0;
      await addElementsToCanvas(excalidrawAPI, result.elements, ox, oy);
      toast.success(result.message);
    }
  });

  // Math → /api/ml/math
  const handleMath = () => run('math', mlService.solveMath.bind(mlService), async (result) => {
    if (!result.success) { toast.error(result.message); return; }
    const mr = { equation: result.equation, solution: result.solution, steps: result.steps };
    setMathResult(mr);
    await placeMathOnCanvas(mr);
    toast.success(`✅ Solved: ${result.equation} → ${result.solution.join(', ')}`);
  });

  // Text → /api/ml/text  (no client timeout — HF cold start can take ~2 min)
  const handleText = () => run(
    'text',
    mlService.recognizeText.bind(mlService),
    async (result) => {
      await addElementsToCanvas(excalidrawAPI, result.elements);
      toast.success(`✨ Recognized: "${result.text}"`);
    },
    '🔥 Waking up AI… may take ~2 min on first use',
  );

  // Sketch → open advanced enhancement preview modal
  const handleSketch = () => {
    const ids = getSelectedIds(excalidrawAPI);
    if (ids.length === 0) {
      toast.error('Select elements first');
      return;
    }
    setSelectedIds(ids);
    setPreviewOpen(true);
  };

  // Detect → /api/ml/detect  (fast — pure OpenCV heuristics, no HF call)
  const handleDetect = () => run(
    'detect',
    mlService.detectIntent.bind(mlService),
    (result) => {
      toast.info(`🔍 Detected: ${result.intent} (${(result.confidence * 100).toFixed(0)}%)`);
    },
    '🔍 Detecting…',
  );

  // ── Render ───────────────────────────────────────────────────────────

  const btnBase = 'flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold h-8 px-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed border';
  const btnPrimary = `${btnBase} bg-blue-600 hover:bg-blue-700 text-white border-blue-600`;
  const btnOutline = `${btnBase} bg-white hover:bg-gray-50 text-gray-700 border-gray-200`;

  const Spinner = () => <Loader2 className="h-3.5 w-3.5 animate-spin" />;

  if (!isHealthy) {
    return (
      <div className="fixed top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 shadow z-50">
        <p className="text-xs text-yellow-700 font-medium">⚠️ ML API offline</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Toolbar panel ── */}
      <div className="fixed top-4 right-4 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 w-[210px]">
        <p className="text-xs font-bold text-gray-700 mb-3">SketchCalibur AI Tools</p>

        {/* Auto Enhance — full width */}
        <button
          onClick={handleAutoEnhance}
          disabled={processing}
          className={`${btnPrimary} w-full mb-2`}
        >
          {activeBtn === 'enhance' ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
          Auto Enhance
        </button>

        {/* 2×2 grid of dedicated buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={handleSketch} disabled={processing} className={btnOutline}>
            {activeBtn === 'sketch' ? <Spinner /> : <ImageIcon className="h-3.5 w-3.5" />}
            Sketch
          </button>
          <button onClick={handleMath} disabled={processing} className={btnOutline}>
            {activeBtn === 'math' ? <Spinner /> : <Calculator className="h-3.5 w-3.5" />}
            Math
          </button>
          <button onClick={handleText} disabled={processing} className={btnOutline}>
            {activeBtn === 'text' ? <Spinner /> : <Type className="h-3.5 w-3.5" />}
            Text
          </button>
          <button onClick={handleDetect} disabled={processing} className={btnOutline}>
            {activeBtn === 'detect' ? <Spinner /> : <Brain className="h-3.5 w-3.5" />}
            Detect
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-3 text-center">Select elements → click</p>
        {statusMsg && (
          <p className="text-[10px] text-amber-600 font-medium mt-1 text-center leading-tight">
            {statusMsg}
          </p>
        )}
      </div>

      {/* ── Math result panel ── */}
      {mathResult && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[420px]"
          style={{ animation: 'slideDown .2s ease-out' }}>
          <style>{`
            @keyframes slideDown {
              from { opacity:0; transform:translateX(-50%) translateY(-16px); }
              to   { opacity:1; transform:translateX(-50%) translateY(0); }
            }
          `}</style>

          <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Calculator className="h-4 w-4" />
                <span className="font-bold text-sm">Math Solution</span>
              </div>
              <button onClick={() => setMathResult(null)} className="text-white/70 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {/* Equation */}
              <div className="bg-indigo-50 rounded-xl px-4 py-3 text-center">
                <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest mb-1">Equation</p>
                <p className="text-xl font-mono font-bold text-indigo-700">{mathResult.equation}</p>
              </div>

              {/* Solution */}
              <div className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3">
                <CheckCircle2 className="h-7 w-7 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-green-500 font-semibold uppercase tracking-widest">Solution</p>
                  <p className="text-2xl font-bold text-green-700 font-mono">
                    x = {mathResult.solution.join(', ')}
                  </p>
                </div>
              </div>

              {/* Steps */}
              {mathResult.steps.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Steps</p>
                  <ol className="space-y-1">
                    {mathResult.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-indigo-400 font-bold w-4 shrink-0">{i + 1}.</span>
                        <span className="font-mono">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <button
                onClick={() => { placeMathOnCanvas(mathResult); setMathResult(null); }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 rounded-xl transition"
              >
                📌 Place on Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Sketch Enhancement Studio Modal */}
      <EnhancementPreview
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        excalidrawAPI={excalidrawAPI}
        selectedIds={selectedIds}
      />
    </>
  );
};
