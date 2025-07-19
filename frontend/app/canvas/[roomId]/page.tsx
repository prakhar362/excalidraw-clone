'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { useParams } from 'next/navigation';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

interface CursorPosition {
  x: number;
  y: number;
  clientId: string;
  color: string;
  username: string;
}

export default function CanvasPage() {
  const { roomId } = useParams();
  const wsRef = useRef<WebSocket | null>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const clientId = useRef<string>(Math.random().toString(36).slice(2));
  const sendElements = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userColor = useRef<string>(getRandomColor());
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPosition>>({});
  const username = useRef<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // ---------------------- Load Drawing on Mount ----------------------
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (!token || !roomId) return;

    username.current = storedUsername || `User-${clientId.current.slice(0, 4)}`;

    fetch(`http://localhost:5000/chats/${roomId}`)
      .then(res => res.json())
      .then(data => {
        const history = data.messages || [];
        const allElements: any[] = [];

        for (let msg of history.reverse()) {
          try {
            const parsed = JSON.parse(msg.message);
            allElements.push(...parsed);
          } catch {}
        }

        if (excalidrawAPI) {
          excalidrawAPI.updateScene({ elements: mergeElements([], allElements) });
        } else {
          const interval = setInterval(() => {
            if (excalidrawAPI) {
              excalidrawAPI.updateScene({ elements: mergeElements([], allElements) });
              clearInterval(interval);
            }
          }, 300);
        }
      });
  }, [roomId, excalidrawAPI]);

  // ---------------------- WebSocket ----------------------
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) return;

    const ws = new WebSocket(`ws://localhost:8000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join_room', roomId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'drawing' && data.clientId !== clientId.current) {
          const incomingElements = Array.isArray(data.elements) ? data.elements : [data.elements];
          const currentElements = excalidrawAPI?.getSceneElements() || [];
          const merged = mergeElements(currentElements, incomingElements);
          excalidrawAPI?.updateScene({ elements: merged });
        }

        if (data.type === 'cursor' && data.clientId !== clientId.current) {
          setRemoteCursors(prev => ({
            ...prev,
            [data.clientId]: {
              x: data.pointer.x,
              y: data.pointer.y,
              clientId: data.clientId,
              color: data.color || '#000000',
              username: data.username,
            },
          }));
        }
      } catch (e) {
        console.error('WebSocket Error:', e);
      }
    };

    ws.onerror = console.error;
    ws.onclose = () => console.warn('WebSocket closed');

    return () => ws.close();
  }, [roomId, excalidrawAPI]);

  // ---------------------- Drawing Change Sync ----------------------
  const handleChange = (elements: readonly any[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (sendElements.current) clearTimeout(sendElements.current);

    sendElements.current = setTimeout(() => {
      wsRef.current?.send(JSON.stringify({
        type: 'drawing',
        roomId,
        elements,
        clientId: clientId.current,
      }));
    }, 150);
  };

  // ---------------------- Pointer Sync ----------------------
  const handlePointerUpdate = (payload: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'cursor',
      clientId: clientId.current,
      roomId,
      pointer: payload.pointer,
      color: userColor.current,
      username: username.current,
    }));
  };

  // ---------------------- Save Drawing to DB ----------------------
  const handleSaveToServer = async () => {
    const token = localStorage.getItem('token');
    const elements = excalidrawAPI?.getSceneElements();
    if (!token || !elements || !roomId) return;

    setSaveStatus('saving');
    try {
      const res = await fetch(`http://localhost:5000/chats/${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${token}`
        },
        body: JSON.stringify({ message: JSON.stringify(elements) })
      });

      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (e) {
      console.error('Save error:', e);
      setSaveStatus('idle');
    }
  };

  // ---------------------- Share Logic ----------------------
  const handleShare = () => {
    setShowShare(true);
    setCopied(false);
  };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setShowShare(false), 1000);
  };
  const handleCloseShare = () => setShowShare(false);

  return (
    <div className="fixed inset-0">
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        theme="light"
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            export: { saveFileToDisk: true },
            saveAsImage: true,
            saveToActiveFile: true,
          },
          dockedSidebarBreakpoint: 0,
        }}
      />

      {/* Buttons (bottom center) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg">
        <button
          onClick={handleSaveToServer}
          disabled={saveStatus === 'saving'}
          className={`text-sm font-semibold rounded-lg px-4 py-1.5 shadow transition-all duration-200
            ${saveStatus === 'saved' ? 'bg-yellow-300 text-slate-800' : 'bg-blue-600 text-white'}
            ${saveStatus === 'saving' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'}
          `}
        >
          {saveStatus === 'saved' ? 'Saved!' : 'Save'}
        </button>

        <button
          onClick={handleShare}
          className="text-sm font-semibold text-blue-600 border border-blue-600 rounded-lg px-4 py-1.5 bg-white hover:bg-blue-50 shadow transition-all duration-200"
        >
          Share
        </button>

        {saveStatus === 'saved' && (
          <span className="text-xs font-medium text-slate-700 bg-yellow-200 px-2.5 py-1 rounded-md shadow-sm">
            Saved to DB!
          </span>
        )}
      </div>

      {/* Share Popup */}
      {showShare && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg shadow-xl p-4 w-72 z-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-blue-600">Share this canvas</span>
            <button onClick={handleCloseShare} className="text-lg text-slate-500 hover:text-slate-700">×</button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={window.location.href}
              readOnly
              onFocus={(e) => e.target.select()}
              className="flex-1 text-sm px-2.5 py-1.5 rounded-md border border-slate-300 bg-slate-100 text-slate-700"
            />
            <button
              onClick={handleCopyLink}
              className={`text-sm px-3 py-1.5 rounded-md font-medium shadow transition-all duration-200
                ${copied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}
              `}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Cursor Indicators */}
      <div className="absolute inset-0 pointer-events-none z-50">
        {Object.values(remoteCursors).map((cursor) => (
          <div
            key={cursor.clientId}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: cursor.x, top: cursor.y }}
          >
            <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-2 py-1 rounded bg-opacity-80 shadow" style={{ backgroundColor: cursor.color }}>
              {cursor.username}
            </div>
            <div className="w-4 h-4 rounded-full border-2 border-white shadow" style={{ backgroundColor: cursor.color }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// 🔁 Merge helper
function mergeElements(existing: readonly any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  existing.forEach(el => map.set(el.id, el));
  for (const el of incoming) {
    const existingEl = map.get(el.id);
    if (!existingEl || el.version > existingEl.version) {
      map.set(el.id, el);
    }
  }
  return Array.from(map.values()).filter(el => !el.isDeleted);
}

// 🎨 Cursor color generator
function getRandomColor(): string {
  const colors = ['#FF4C4C', '#4CFF4C', '#4C4CFF', '#FFAA00', '#00CFFF', '#FF00DD'];
  return colors[Math.floor(Math.random() * colors.length)];
}
