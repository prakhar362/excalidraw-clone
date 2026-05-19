'use client';

import React, { useState, useEffect } from 'react';
import { mlService } from '@/lib/mlService';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Brain, Calculator, Type, Image as ImageIcon, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface MLToolbarProps {
  excalidrawAPI: any;
}

interface MathResult {
  equation: string;
  solution: string[];
  steps: string[];
  latex?: string;
}

export const MLToolbar: React.FC<MLToolbarProps> = ({ excalidrawAPI }) => {
  const [processing, setProcessing]     = useState(false);
  const [status, setStatus]             = useState('');
  const [isHealthy, setIsHealthy]       = useState(false);
  const [mathResult, setMathResult]     = useState<MathResult | null>(null);

  useEffect(() => {
    mlService.checkHealth().then(setIsHealthy);
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Place the solution as Excalidraw text in the centre of the view    */
  /* ------------------------------------------------------------------ */
  const placeMathOnCanvas = async (result: MathResult) => {
    if (!excalidrawAPI) return;

    const appState  = excalidrawAPI.getAppState();
    // Centre of visible viewport in scene coords
    const cx = appState.scrollX !== undefined
      ? -appState.scrollX + window.innerWidth  / 2 / appState.zoom.value
      : 400;
    const cy = appState.scrollY !== undefined
      ? -appState.scrollY + window.innerHeight / 2 / appState.zoom.value
      : 300;

    const lines = [
      `📐 ${result.equation}`,
      `✅  x = ${result.solution.join(', ')}`,
    ];

    const newTextEls = lines.map((text, i) => ({
      id:          `math-text-${Date.now()}-${i}`,
      type:        'text' as const,
      x:           cx - 120,
      y:           cy - 40 + i * 50,
      width:       300,
      height:      40,
      text:        text || " ",
      fontSize:    i === 0 ? 22 : 28,
      fontFamily:  1,
      textAlign:   'left' as const,
      verticalAlign: 'middle' as const,
      strokeColor: i === 0 ? '#6366f1' : '#16a34a',
      backgroundColor: 'transparent',
      fillStyle:   'solid' as const,
      strokeWidth: 1,
      roughness:   0,
      opacity:     100,
      groupIds:    [],
      roundness:   null,
      boundElements: [],
      link:        null,
      locked:      false,
    }));

    try {
      const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
      const aiElements = convertToExcalidrawElements(newTextEls);

      excalidrawAPI.updateScene({
        elements: [...excalidrawAPI.getSceneElements(), ...aiElements],
      });
    } catch (err) {
      console.error("Error placing elements via API, falling back to manual insertion", err);
      // Fallback
      excalidrawAPI.updateScene({
        elements: [...excalidrawAPI.getSceneElements(), ...newTextEls.map(el => ({
          ...el,
          version: 1,
          versionNonce: Math.floor(Math.random() * 100000),
          isDeleted: false,
          updated: Date.now(),
          seed: Math.floor(Math.random() * 100000),
        }))]
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Main handler                                                        */
  /* ------------------------------------------------------------------ */
  const handleEnhance = async (forceIntent?: string) => {
    const selectedIds = Object.keys(excalidrawAPI.getAppState().selectedElementIds || {});
    if (selectedIds.length === 0) {
      toast.error('Please select elements first');
      return;
    }

    setProcessing(true);
    setMathResult(null);
    setStatus('Extracting selection…');

    try {
      const imageBlob = await mlService.extractSelectionAsImage(excalidrawAPI, selectedIds);
      setStatus('Processing with AI…');
      const result = await mlService.processSelection(imageBlob, undefined, forceIntent);

      if (result.success) {
        if (result.result_type === 'math_solution' && result.solution) {
          // Show the dedicated math panel AND place text on canvas
          const mr: MathResult = {
            equation: result.equation || '',
            solution: result.solution,
            steps:    result.steps   || [],
            latex:    result.latex,
          };
          setMathResult(mr);
          placeMathOnCanvas(mr);
          toast.success('✅ Equation solved!');
        } else {
          // Non-math: add elements to canvas safely
          const elements = excalidrawAPI.getSceneElements();
          
          // Find original position to place the new sketch near it
          const selectedElements = elements.filter((el: any) => selectedIds.includes(el.id));
          const minX = selectedElements.length > 0 ? Math.min(...selectedElements.map((el: any) => el.x)) : 0;
          const minY = selectedElements.length > 0 ? Math.min(...selectedElements.map((el: any) => el.y)) : 0;

          const newElements = result.elements.map((el: any) => ({
            ...el,
            x: el.x + minX + 50, // Offset by 50px from original so they don't exactly overlap
            y: el.y + minY + 50,
            groupIds: [],
            boundElements: [],
          }));

          try {
            const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
            const safeElements = convertToExcalidrawElements(newElements);
            excalidrawAPI.updateScene({ elements: [...elements, ...safeElements] });
          } catch (err) {
            console.error("Fallback injection for sketch", err);
            excalidrawAPI.updateScene({ elements: [...elements, ...newElements.map((el: any) => ({
              ...el,
              version: 1,
              versionNonce: Math.floor(Math.random() * 100000),
              isDeleted: false,
              updated: Date.now(),
              seed: Math.floor(Math.random() * 100000),
            }))]});
          }

          if (result.result_type === 'recognized_text' && result.text) {
            toast.info(`Recognized: ${result.text}`);
          } else {
            toast.success(result.message);
          }
        }
      } else {
        toast.error(result.message || 'Processing failed');
      }

      setStatus('');
    } catch (error: any) {
      console.error('ML error:', error);
      toast.error(error.message || 'Processing failed');
      setStatus('');
    } finally {
      setProcessing(false);
    }
  };

  const handleClassify = async () => {
    const selectedIds = Object.keys(excalidrawAPI.getAppState().selectedElementIds || {});
    if (selectedIds.length === 0) { toast.error('Please select elements'); return; }
    setProcessing(true);
    try {
      const imageBlob = await mlService.extractSelectionAsImage(excalidrawAPI, selectedIds);
      const result    = await mlService.classifyIntent(imageBlob);
      if (result.success) {
        toast.info(`Detected: ${result.intent} (${(result.confidence * 100).toFixed(1)}%)`);
      }
    } catch { toast.error('Classification failed'); }
    finally { setProcessing(false); }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                              */
  /* ------------------------------------------------------------------ */
  if (!isHealthy) {
    return (
      <div className="fixed top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-lg z-50">
        <p className="text-sm text-yellow-800">⚠️ ML API unavailable</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="fixed top-4 right-4 bg-white rounded-xl p-4 shadow-xl z-50 border border-gray-100 w-[220px]">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-gray-800 mb-1">🤖 AI Enhancement</h3>

          <Button onClick={() => handleEnhance()} disabled={processing} className="w-full text-sm h-9">
            {processing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
              : <><Sparkles className="mr-2 h-4 w-4" />Auto Enhance</>}
          </Button>

          <div className="grid grid-cols-2 gap-1.5">
            <Button onClick={() => handleEnhance('artistic_sketch')} disabled={processing} variant="outline" size="sm" className="text-xs h-8">
              <ImageIcon className="mr-1 h-3 w-3" />Sketch
            </Button>
            <Button onClick={() => handleEnhance('mathematical')} disabled={processing} variant="outline" size="sm" className="text-xs h-8">
              <Calculator className="mr-1 h-3 w-3" />Math
            </Button>
            <Button onClick={() => handleEnhance('handwriting')} disabled={processing} variant="outline" size="sm" className="text-xs h-8">
              <Type className="mr-1 h-3 w-3" />Text
            </Button>
            <Button onClick={handleClassify} disabled={processing} variant="outline" size="sm" className="text-xs h-8">
              <Brain className="mr-1 h-3 w-3" />Detect
            </Button>
          </div>

          {status && (
            <div className="text-xs text-indigo-600 animate-pulse font-medium mt-1">{status}</div>
          )}

          <p className="text-[10px] text-gray-400 mt-1">Select elements, then click</p>
        </div>
      </div>

      {/* ── Math Result Panel ── */}
      {mathResult && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: '440px',
            animation: 'slideDown 0.25s ease-out',
          }}
        >
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
          <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Calculator className="h-5 w-5" />
                <span className="font-bold text-sm">Math Solution</span>
              </div>
              <button
                onClick={() => setMathResult(null)}
                className="text-white/70 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Equation */}
              <div className="bg-indigo-50 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-indigo-400 font-medium uppercase tracking-wide mb-1">Equation</p>
                <p className="text-xl font-mono font-bold text-indigo-700">{mathResult.equation}</p>
              </div>

              {/* Solution */}
              <div className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3">
                <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-green-500 font-medium uppercase tracking-wide">Solution</p>
                  <p className="text-2xl font-bold text-green-700 font-mono">
                    x = {mathResult.solution.join(', ')}
                  </p>
                </div>
              </div>

              {/* Steps */}
              {mathResult.steps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Steps</p>
                  <ol className="space-y-1">
                    {mathResult.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-indigo-400 font-bold w-4 flex-shrink-0">{i + 1}.</span>
                        <span className="font-mono">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Place on canvas button */}
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
    </>
  );
};
