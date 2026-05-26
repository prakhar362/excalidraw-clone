import React, { useState, useEffect, useCallback } from 'react';
import { StyleSelector } from './StyleSelector';
import { sketchEnhancementService } from '../services/sketchEnhancementService';
import { CanvasUtils } from '../services/canvasUtils';
import { EnhancementStyle, ExcalidrawElement } from '../types/enhancement.types';
import { Loader2, Check, X, Sparkles, RefreshCw, Layers, ArrowRightLeft, FileDown } from 'lucide-react';
import { toast } from 'react-toastify';

interface EnhancementPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  excalidrawAPI: any;
  selectedIds: string[];
}

export const EnhancementPreview: React.FC<EnhancementPreviewProps> = ({
  isOpen,
  onClose,
  excalidrawAPI,
  selectedIds
}) => {
  const [style, setStyle] = useState<EnhancementStyle>('professional');
  const [useAI, setUseAI] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [enhancedElements, setEnhancedElements] = useState<ExcalidrawElement[] | null>(null);
  const [boundsInfo, setBoundsInfo] = useState<{ minX: number; minY: number; width: number; height: number; } | null>(null);
  const [replaceOriginal, setReplaceOriginal] = useState<boolean>(true);
  const [aiAvailable, setAiAvailable] = useState<boolean>(false);

  // Check if AI enhancement is enabled on backend
  useEffect(() => {
    sketchEnhancementService.getEnhancementInfo()
      .then(info => {
        const available = !!(info.controlnet_available || info.ai_enhancement_enabled);
        setAiAvailable(available);
        if (available) {
          setUseAI(true);
        }
      })
      .catch(err => {
        console.error('Error fetching enhancement capabilities:', err);
      });
  }, []);

  // Compute selection bounds and export original cropped selection on load
  useEffect(() => {
    if (!isOpen || !excalidrawAPI || selectedIds.length === 0) return;

    const prepareOriginal = async () => {
      try {
        setLoading(true);

        // 1. Calculate selection bounds
        const sceneElements = excalidrawAPI.getSceneElements();
        const selected = sceneElements.filter((el: any) => selectedIds.includes(el.id));

        if (selected.length === 0) {
          toast.error('No elements found in selection');
          onClose();
          return;
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        selected.forEach((el: any) => {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);

          if (el.points && el.points.length > 0) {
            const xs = el.points.map((p: number[]) => p[0]);
            const ys = el.points.map((p: number[]) => p[1]);
            maxX = Math.max(maxX, el.x + Math.max(...xs));
            maxY = Math.max(maxY, el.y + Math.max(...ys));
          } else {
            maxX = Math.max(maxX, el.x + (el.width || 0));
            maxY = Math.max(maxY, el.y + (el.height || 0));
          }
        });

        const width = maxX - minX;
        const height = maxY - minY;
        setBoundsInfo({ minX, minY, width, height });

        // 2. Extract cropped selection as PNG Blob
        const blob = await CanvasUtils.extractSelectionAsImage(excalidrawAPI, selectedIds);
        setOriginalBlob(blob);

        if (originalUrl) URL.revokeObjectURL(originalUrl);
        setOriginalUrl(URL.createObjectURL(blob));
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to capture selection: ' + err.message);
        onClose();
      } finally {
        setLoading(false);
      }
    };

    prepareOriginal();

    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [isOpen, excalidrawAPI, selectedIds]);

  // Trigger enhancement API
  const handleEnhance = useCallback(async () => {
    if (!originalBlob) return;

    setLoading(true);
    setPreviewUrl(null);
    setEnhancedElements(null);

    try {
      const result = await sketchEnhancementService.enhanceSketch({
        file: originalBlob,
        style,
        useAI,
        returnPreview: true,
        returnVectors: true
      });

      if (!result.success) {
        toast.error(result.message || 'Failed to enhance sketch');
        return;
      }

      if (result.preview) {
        setPreviewUrl(result.preview);
      }
      if (result.elements) {
        setEnhancedElements(result.elements);
      }
      toast.success('Enhancement complete!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Enhancement API error');
    } finally {
      setLoading(false);
    }
  }, [originalBlob, style, useAI]);

  // Run enhancement whenever style or AI option changes, once the original crop is ready
  useEffect(() => {
    if (originalBlob) {
      handleEnhance();
    }
  }, [originalBlob, style, useAI, handleEnhance]);

  // Insert elements to Excalidraw Canvas
  const handleApply = async () => {
    if (!excalidrawAPI || !enhancedElements || !boundsInfo) return;

    try {
      const existing = excalidrawAPI.getSceneElements();

      // Shift enhanced elements relative to original bounding box top-left
      // Subtract padding of 20 used in CanvasUtils.extractSelectionAsImage
      const padding = 20;
      const ox = boundsInfo.minX - padding;
      const oy = boundsInfo.minY - padding;

      const shifted = enhancedElements.map((el: any, i: number) => ({
        ...el,
        x: (el.x ?? 0) + ox,
        y: (el.y ?? 0) + oy,
        // Ensure unique IDs
        id: `enhanced_${Date.now()}_${i}`,
        seed: Math.floor(Math.random() * 1e6),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1e6),
        updated: Date.now()
      }));

      // Import native element converter if available
      let safeElements = shifted;
      try {
        const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
        safeElements = convertToExcalidrawElements(shifted);
      } catch (e) {
        console.warn('Fallback: injecting raw JSON elements');
      }

      let nextElements = [...existing];

      if (replaceOriginal) {
        // Remove original selected elements
        nextElements = existing.filter((el: any) => !selectedIds.includes(el.id));
      }

      excalidrawAPI.updateScene({
        elements: [...nextElements, ...safeElements]
      });

      toast.success(replaceOriginal ? '🎨 Original sketch replaced!' : '🎨 Clean sketch inserted!');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to apply elements: ' + err.message);
    }
  };

  // Insert enhanced sketch as a premium image element rather than vector elements
  const handleApplyAsImage = async () => {
    if (!excalidrawAPI || !previewUrl || !boundsInfo) return;

    try {
      const existing = excalidrawAPI.getSceneElements();

      const padding = 20;
      const ox = boundsInfo.minX - padding;
      const oy = boundsInfo.minY - padding;
      const w = boundsInfo.width + padding * 2;
      const h = boundsInfo.height + padding * 2;

      const fileId = `file_enhanced_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

      const isSvg = previewUrl.startsWith('data:image/svg+xml');
      const mimeType = isSvg ? 'image/svg+xml' : 'image/png';

      // 1. Add the file to Excalidraw's binary files store
      excalidrawAPI.addFiles([{
        id: fileId,
        dataURL: previewUrl,
        mimeType: mimeType,
        created: Date.now()
      }]);

      // 2. Create the Excalidraw Image element
      const imageElement = {
        id: `enhanced_img_${Date.now()}`,
        type: 'image',
        x: ox,
        y: oy,
        width: w,
        height: h,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'hachure',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 1e6),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1e6),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        fileId: fileId,
        status: 'saved', // Mark as saved so Excalidraw renders it immediately
        scale: [1, 1]
      };

      // Import native element converter if available
      let safeElements = [imageElement];
      try {
        const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
        safeElements = convertToExcalidrawElements([imageElement]);
      } catch (e) {
        console.warn('Fallback: injecting raw JSON image element');
      }

      let nextElements = [...existing];

      if (replaceOriginal) {
        // Remove original selected elements
        nextElements = existing.filter((el: any) => !selectedIds.includes(el.id));
      }

      excalidrawAPI.updateScene({
        elements: [...nextElements, ...safeElements]
      });

      toast.success(replaceOriginal ? '🎨 Rough sketch replaced with premium image!' : '🎨 Premium image inserted!');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to apply image: ' + err.message);
    }
  };

  const downloadPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `enhanced-${style}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

        {/* Modal Header */}
        <div className="bg-black px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base tracking-wide uppercase">Sketch Enhancement Studio</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 bg-white/10 hover:bg-white/20 transition-all text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex flex-col md:flex-row gap-6 overflow-y-auto min-h-0 flex-1">

          {/* Left panel: Controls & Settings */}
          <div className="w-full md:w-[320px] flex flex-col gap-4 shrink-0">
            <StyleSelector
              selectedStyle={style}
              onStyleChange={setStyle}
              disabled={loading}
            />

            {/* AI Sketch Beautifier Toggle */}
            {aiAvailable && (
              <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-black flex items-center gap-1.5 uppercase tracking-wider">
                    AI Sketch Beautifier
                  </span>

                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Uses cloud-powered AI to transform rough strokes into beautiful, clean, perfectly aligned shapes and curves.
                </p>
              </div>
            )}

            {/* Integration settings */}
            <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4 flex flex-col gap-3">
              <span className="text-xs font-bold text-black flex items-center gap-1.5 uppercase tracking-wider">
                Canvas Placement
              </span>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={replaceOriginal}
                    onChange={() => setReplaceOriginal(true)}
                    className="text-blue-600 focus:ring-blue-600 h-3.5 w-3.5"
                  />
                  Replace original rough sketch
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={!replaceOriginal}
                    onChange={() => setReplaceOriginal(false)}
                    className="text-blue-600 focus:ring-blue-600 h-3.5 w-3.5"
                  />
                  Place on top of original sketch
                </label>
              </div>
            </div>
          </div>

          {/* Right panel: Comparison Display */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <label className="text-xs font-bold text-slate-700">Comparative Preview:</label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-h-[280px]">

              {/* Original Sketch Crop */}
              <div className="border border-slate-200 bg-slate-50 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden group shadow-inner">
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-black text-white rounded text-[10px] font-bold z-10 uppercase tracking-wider">
                  Original
                </span>
                {originalUrl ? (
                  <img
                    src={originalUrl}
                    alt="Original cropped sketch"
                    className="max-h-[220px] object-contain rounded-xl select-none"
                  />
                ) : (
                  <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
                )}
              </div>

              {/* Enhanced Sketch Preview */}
              <div className="border border-slate-200 bg-slate-50 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-inner min-h-[220px]">
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-black text-white rounded text-[10px] font-bold z-10 uppercase tracking-wider">
                  Enhanced
                </span>

                {loading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-black animate-spin" />
                    <span className="text-[10px] font-bold text-black animate-pulse uppercase tracking-wider">
                      Processing sketch...
                    </span>
                  </div>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Enhanced preview"
                    className="max-h-[220px] object-contain rounded-xl select-none"
                  />
                ) : (
                  <div className="text-center text-slate-400 p-4">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 text-slate-300 animate-pulse" />
                    <p className="text-xs font-semibold">Awaiting enhancement</p>
                  </div>
                )}
              </div>

            </div>

            {/* Preview controls */}
            {previewUrl && (
              <div className="flex justify-end gap-2 shrink-0">
                <button
                  onClick={downloadPreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Save Image Preview
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-black rounded-md text-sm font-semibold transition uppercase tracking-wider"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {/* Previous vector strokes insert */}
            <button
              onClick={handleApply}
              disabled={loading || !enhancedElements}
              className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-black px-4 py-2 rounded-md text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
              title="Insert as editable Excalidraw vector shapes (may lose details)"
            >
              Place as Vector Strokes
            </button>

            {/* Premium High-Fidelity Image insert */}
            <button
              onClick={handleApplyAsImage}
              disabled={loading || !previewUrl}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-md text-sm font-semibold transition shadow-md cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
              title="Insert as a clean, pixel-perfect, high-fidelity image (Recommended)"
            >
              Place as Premium Image
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
