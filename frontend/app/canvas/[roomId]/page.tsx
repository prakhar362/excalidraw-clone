'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';
import '@excalidraw/excalidraw/index.css';
import { RoomChat } from '@/components/RoomChat';
import { useParams } from 'next/navigation';
import { BACKEND_URL, WSS_URL } from '../../../config';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { mlService } from '@/lib/mlService';
import { syncImagesToCloudinary, restoreImagesFromElements, uploadImageToCloudinary } from '@/lib/imageService';

// HuggingFace Space root — pinged on load to wake the container
const HF_SPACE_ROOT = 'https://sanprakhar362-paddleocr.hf.space/';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);
const MLToolbar = dynamic(
  () => import('@/components/MLToolbar').then((mod) => mod.MLToolbar),
  { ssr: false }
);
const ElementsNavigator = dynamic(
  () => import('@/components/ElementsNavigator').then((mod) => mod.ElementsNavigator),
  { ssr: false }
);

interface CursorPosition {
  x: number; y: number; clientId: string; color: string; username: string;
}

export default function CanvasPage() {
  const { roomId } = useParams();

  const wsRef               = useRef<WebSocket | null>(null);
  const excalidrawAPIRef    = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientId            = useRef<string>(Math.random().toString(36).slice(2));
  const userColor           = useRef<string>(getRandomColor());
  const username            = useRef<string>('');
  const sendElementsTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadedImageIds    = useRef<Set<string>>(new Set());
  const imageSyncTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPosition>>({});
  const [saveStatus,    setSaveStatus]    = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showShare,     setShowShare]     = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [showAIModal,   setShowAIModal]   = useState(false);
  const [aiPrompt,      setAiPrompt]      = useState('');
  const [aiLoading,     setAiLoading]     = useState(false);

  // ── 1. JWT decode ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      setCurrentUserId(payload.userId);
      username.current = payload.name || 'Anonymous User';
    } catch (e) { console.error('Token decode error', e); }
  }, []);

  // ── 2. Warm-up: ML backend health + HF Space ping ─────────────────────
  useEffect(() => {
    mlService.checkHealth()
      .then(ok => { if (ok) toast.success('🤖 ML Backend Connected', { autoClose: 2000 }); })
      .catch(() => {});

    // Fire-and-forget — wakes the HF container so first Text request is fast
    fetch(HF_SPACE_ROOT, { method: 'GET', mode: 'no-cors' }).catch(() => {});
  }, []);

  // ── 3. Load drawing history + restore Cloudinary images ───────────────
  useEffect(() => {
    if (!roomId) return;
    fetch(`${BACKEND_URL}/chats/${roomId}`)
      .then(r => r.json())
      .then(async data => {
        if (!data.messages || data.messages.length === 0) return;

        // The messages are sorted newest first, so index 0 is the latest save!
        const latestMsg = data.messages[0];
        let latestElements: any[] = [];
        try {
          latestElements = JSON.parse(latestMsg.message);
        } catch (e) {
          console.error("Failed to parse latest message elements", e);
        }

        const apply = async () => {
          if (!excalidrawAPIRef.current) { setTimeout(apply, 500); return; }

          // Pre-populate the files map from the elements' Cloudinary URLs
          const imageElements = latestElements.filter(
            (el: any) => el.type === 'image' && el.fileId && el.cloudinaryUrl
          );
          const filesRecord: Record<string, any> = {};
          imageElements.forEach((el: any) => {
            filesRecord[el.fileId] = {
              id:       el.fileId,
              dataURL:  el.cloudinaryUrl,
              mimeType: el.mimeType || 'image/png',
              created:  Date.now(),
            };
          });

          // Atomically update elements and files in the scene state
          excalidrawAPIRef.current.updateScene({
            elements: latestElements,
            files: filesRecord,
          });

          await restoreImagesFromElements(excalidrawAPIRef.current, latestElements);
        };
        apply();
      });
  }, [roomId]);

  // ── 4. WebSocket lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) return;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING ||
          wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(`${WSS_URL}?token=${token}`);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'join_room', roomId }));
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'drawing' && data.clientId !== clientId.current && excalidrawAPIRef.current) {
            excalidrawAPIRef.current.updateScene({
              elements: mergeElements(excalidrawAPIRef.current.getSceneElements(), data.elements),
            });
          }
          if (data.type === 'cursor' && data.clientId !== clientId.current) {
            setRemoteCursors(prev => ({
              ...prev,
              [data.clientId]: { x: data.pointer.x, y: data.pointer.y, clientId: data.clientId, color: data.color || '#000000', username: data.username },
            }));
          }
        } catch {}
      };
      ws.onclose = (e) => { if (!e.wasClean) reconnectTimeoutRef.current = setTimeout(connect, 3000); };
    };

    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close(1000, 'Unmounted');
    };
  }, [roomId]);

  // ── 5. onChange: WS broadcast + debounced Cloudinary image sync ────────
  const handleChange = useCallback((elements: readonly any[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (sendElementsTimer.current) clearTimeout(sendElementsTimer.current);
      sendElementsTimer.current = setTimeout(() => {
        wsRef.current?.send(JSON.stringify({ type: 'drawing', roomId, elements, clientId: clientId.current }));
      }, 100);
    }

    const token = localStorage.getItem('token');
    if (token && excalidrawAPIRef.current) {
      if (imageSyncTimer.current) clearTimeout(imageSyncTimer.current);
      imageSyncTimer.current = setTimeout(() => {
        syncImagesToCloudinary(excalidrawAPIRef.current, token, uploadedImageIds.current)
          .catch(err => console.error('Image sync error:', err));
      }, 2000);
    }
  }, [roomId]);

  const handlePointerUpdate = (payload: any) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'cursor', clientId: clientId.current, roomId,
      pointer: payload.pointer, color: userColor.current, username: username.current,
    }));
  };

  // ── 6. AI Magic ────────────────────────────────────────────────────────
  const generateFromAI = async () => {
    if (!aiPrompt.trim() || !excalidrawAPIRef.current) return;
    setAiLoading(true);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `Act as an Excalidraw Architect. Transform the following description into a valid JSON array of ExcalidrawElementSkeleton objects. OUTPUT ONLY RAW JSON — no markdown, no explanation.

Rules:
- Use convertToExcalidrawElements Skeleton API format
- Every element must have absolute x and y values
- Spread elements across at least 1500 units wide
- Minimum 250px horizontal and 200px vertical gap between shapes
- For arrows: set x/y to match the start element, use start/end id bindings
- Use professional muted colors (#a5d8ff info, #c0eb75 success, #ffc9c9 error)

User Request: ${aiPrompt}` }] }],
          }),
        }
      );
      const data = await res.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiText) throw new Error('Empty AI response');
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Invalid AI Response');
      const parsedJson = JSON.parse(jsonMatch[0]);
      const fixedJson = parsedJson.map((el: any) => {
        if (el.type === 'arrow' && el.start?.id && el.end?.id) {
          const src = parsedJson.find((s: any) => s.id === el.start.id);
          const tgt = parsedJson.find((t: any) => t.id === el.end.id);
          if (src && tgt) return { ...el, x: src.x + (src.width || 100) / 2, y: src.y + (src.height || 50) / 2, points: [[0, 0], [tgt.x - src.x, tgt.y - src.y]] };
        }
        return el;
      });
      const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
      const aiElements = convertToExcalidrawElements(fixedJson, { regenerateIds: false });
      excalidrawAPIRef.current.updateScene({
        elements: mergeElements(excalidrawAPIRef.current.getSceneElements(), aiElements),
      });
      setShowAIModal(false);
      setAiPrompt('');
    } catch { alert('AI Generation Failed'); }
    finally { setAiLoading(false); }
  };

  // ── 7. Save — embeds Cloudinary URLs into image elements ──────────────
  const handleSaveToServer = async () => {
    const token    = localStorage.getItem('token');
    const elements = excalidrawAPIRef.current?.getSceneElements();
    if (!token || !elements || !roomId) return;
    setSaveStatus('saving');
    try {
      const files = excalidrawAPIRef.current?.getFiles() ?? {};
      
      // Perform uploads for any base64 images in the scene first in parallel
      const enriched = await Promise.all(elements.map(async (el: any) => {
        if (el.type === 'image' && el.fileId) {
          const f = files[el.fileId];
          if (f) {
            if (f.dataURL?.startsWith('http')) {
              return { ...el, cloudinaryUrl: f.dataURL, mimeType: f.mimeType };
            } else if (f.dataURL?.startsWith('data:')) {
              try {
                console.log(`[Save] Uploading image ${el.fileId} to Cloudinary...`);
                const result = await uploadImageToCloudinary(f.dataURL, token);
                if (result.success) {
                  // Add it to Excalidraw files
                  excalidrawAPIRef.current.addFiles([{
                    id:       el.fileId,
                    dataURL:  result.url,
                    mimeType: f.mimeType,
                    created:  Date.now(),
                  }]);
                  uploadedImageIds.current.add(el.fileId);
                  console.log(`[Save] ✅ Image ${el.fileId} successfully uploaded -> ${result.url}`);
                  return { ...el, cloudinaryUrl: result.url, mimeType: f.mimeType };
                }
              } catch (err) {
                console.error(`[Save] Failed to upload image ${el.fileId}:`, err);
              }
            }
          }
          // If no file found in files map, check if the element already has a cloudinaryUrl
          if (el.cloudinaryUrl) {
            return el;
          }
        }
        return el;
      }));

      const res = await fetch(`${BACKEND_URL}/chats/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ message: JSON.stringify(enriched) }),
      });
      if (res.ok) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500); }
    } catch (e) {
      console.error("Save error:", e);
      setSaveStatus('idle');
    }
  };

  const handleShare    = () => { setShowShare(true); setCopied(false); };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setShowShare(false), 1000);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#f0f0f0]">
      <Excalidraw
        excalidrawAPI={(api) => { excalidrawAPIRef.current = api; setExcalidrawAPI(api); }}
        theme="light"
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        UIOptions={{ canvasActions: { loadScene: true, export: { saveFileToDisk: true }, saveAsImage: true } }}
      />

      {/* Bottom bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-slate-200">
        <button onClick={() => setShowAIModal(true)} className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition shadow-sm">
          AI Magic ✨
        </button>
        <button
          onClick={handleSaveToServer}
          disabled={saveStatus === 'saving'}
          className={`text-sm font-semibold rounded-lg px-4 py-1.5 shadow transition-all duration-200
            ${saveStatus === 'saved' ? 'bg-yellow-300 text-slate-800' : 'bg-blue-600 text-white'}
            ${saveStatus === 'saving' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'}`}
        >
          {saveStatus === 'saved' ? 'Saved!' : 'Save'}
        </button>
        <button onClick={handleShare} className="text-sm font-semibold text-blue-600 border border-blue-600 rounded-lg px-4 py-1.5 bg-white hover:bg-blue-50 transition-all shadow-sm">
          Share
        </button>
      </div>

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white p-6 rounded-2xl w-[450px] shadow-2xl">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Generate with AI</h3>
            <textarea
              autoFocus value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-purple-500 outline-none transition h-32 text-sm"
              placeholder="e.g. A system architecture with a load balancer, two servers and a database..."
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowAIModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button disabled={aiLoading} onClick={generateFromAI} className="bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-semibold disabled:bg-purple-300 transition">
                {aiLoading ? 'Thinking...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Popup */}
      {showShare && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg shadow-xl p-4 w-72 z-50">
          <div className="flex justify-between items-center mb-2 text-sm font-semibold text-blue-600">
            <span>Share Link</span>
            <button onClick={() => setShowShare(false)}>×</button>
          </div>
          <div className="flex gap-2">
            <input readOnly value={typeof window !== 'undefined' ? window.location.href : ''} className="flex-1 text-xs px-2 py-1.5 rounded border bg-slate-50" />
            <button onClick={handleCopyLink} className={`text-xs px-3 py-1.5 rounded font-medium text-white ${copied ? 'bg-green-500' : 'bg-blue-600'}`}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Cursor Overlay */}
      <div className="absolute inset-0 pointer-events-none z-40">
        {Object.values(remoteCursors).map((cursor) => (
          <div key={cursor.clientId} className="absolute transition-all duration-100 ease-out" style={{ left: cursor.x, top: cursor.y }}>
            <div className="relative">
              <div className="absolute left-4 top-4 whitespace-nowrap px-2 py-1 rounded shadow-md text-[11px] font-bold text-white" style={{ backgroundColor: cursor.color }}>
                {cursor.username}
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" fill={cursor.color} stroke="white" strokeWidth="2"/>
              </svg>
            </div>
          </div>
        ))}
      </div>

      <RoomChat roomId={roomId} ws={wsRef.current} currentUserId={currentUserId} />
      {excalidrawAPI && <MLToolbar excalidrawAPI={excalidrawAPI} />}
      {excalidrawAPI && <ElementsNavigator excalidrawAPI={excalidrawAPI} />}

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="light" />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mergeElements(existing: readonly any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  existing.forEach(el => map.set(el.id, el));
  incoming.forEach(el => {
    const prev = map.get(el.id);
    if (!prev || el.version > prev.version) map.set(el.id, el);
  });
  return Array.from(map.values()).filter(el => !el.isDeleted);
}

function getRandomColor(): string {
  const colors = ['#FF4C4C', '#4CFF4C', '#4C4CFF', '#FFAA00', '#00CFFF', '#FF00DD', '#7C3AED'];
  return colors[Math.floor(Math.random() * colors.length)];
}
