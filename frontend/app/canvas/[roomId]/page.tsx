'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { RoomChat } from '@/components/RoomChat';
import { useParams } from 'next/navigation';
import { BACKEND_URL, WSS_URL } from '../../../config';
import { cn } from '@/lib/utils';

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
  const excalidrawAPIRef = useRef<any>(null); 
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientId = useRef<string>(Math.random().toString(36).slice(2));
  const userColor = useRef<string>(getRandomColor());
  const username = useRef<string>(''); 
  const sendElementsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPosition>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Initialize User Data from JWT (Fixes Name logic)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        
        setCurrentUserId(payload.userId);
        username.current = payload.name || "Anonymous User";
      } catch (e) {
        console.error("Token decode error", e);
      }
    }
  }, []);

  // 2. Load Drawing History
  useEffect(() => {
    if (!roomId) return;
    fetch(`${BACKEND_URL}/chats/${roomId}`)
      .then(res => res.json())
      .then(data => {
        const history = data.messages || [];
        const allElements: any[] = [];
        history.reverse().forEach((msg: any) => {
          try {
            const parsed = JSON.parse(msg.message);
            allElements.push(...parsed);
          } catch {}
        });

        const syncInitial = () => {
          if (excalidrawAPIRef.current) {
            excalidrawAPIRef.current.updateScene({ 
              elements: mergeElements([], allElements) 
            });
          } else {
            setTimeout(syncInitial, 500);
          }
        };
        syncInitial();
      });
  }, [roomId]);

  // 3. Stable WebSocket Lifecycle
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) return;

    const connect = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        return;
      }

      const ws = new WebSocket(`${WSS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join_room', roomId }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'drawing' && data.clientId !== clientId.current) {
            if (excalidrawAPIRef.current) {
              const incomingElements = Array.isArray(data.elements) ? data.elements : [data.elements];
              const currentElements = excalidrawAPIRef.current.getSceneElements();
              const merged = mergeElements(currentElements, incomingElements);
              excalidrawAPIRef.current.updateScene({ elements: merged });
            }
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
          console.error("WS Message Parse Error", e);
        }
      };

      ws.onclose = (e) => {
        if (!e.wasClean) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, "Unmounted");
        wsRef.current = null;
      }
    };
  }, [roomId]);

  // 4. Interaction Handlers
  const handleChange = (elements: readonly any[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (sendElementsTimer.current) clearTimeout(sendElementsTimer.current);
    sendElementsTimer.current = setTimeout(() => {
      wsRef.current?.send(JSON.stringify({
        type: 'drawing',
        roomId,
        elements,
        clientId: clientId.current,
      }));
    }, 100);
  };

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

  // 5. Original Save Logic
  const handleSaveToServer = async () => {
    const token = localStorage.getItem('token');
    const elements = excalidrawAPIRef.current?.getSceneElements();
    if (!token || !elements || !roomId) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`${BACKEND_URL}/chats/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `${token}` },
        body: JSON.stringify({ message: JSON.stringify(elements) })
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      }
    } catch (e) { setSaveStatus('idle'); }
  };

  // 6. Original Share Logic
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
    <div className="fixed inset-0 overflow-hidden bg-[#f0f0f0]">
      <Excalidraw
        excalidrawAPI={(api) => (excalidrawAPIRef.current = api)}
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

      {/* Buttons (Original UI Bottom Center) */}
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

      {/* Share Popup (Original UI) */}
      {showShare && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg shadow-xl p-4 w-72 z-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-blue-600">Share this canvas</span>
            <button onClick={handleCloseShare} className="text-lg text-slate-500 hover:text-slate-700">×</button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={typeof window !== 'undefined' ? window.location.href : ''}
              readOnly
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

      {/* Remote Cursor Overlay (Figma Style with Name) */}
      <div className="absolute inset-0 pointer-events-none z-40">
        {Object.values(remoteCursors).map((cursor) => (
          <div key={cursor.clientId} className="absolute transition-all duration-100 ease-out" style={{ left: cursor.x, top: cursor.y }}>
            <div className="relative">
              <div 
                className="absolute left-4 top-4 whitespace-nowrap px-2 py-1 rounded shadow-md text-[11px] font-bold text-white" 
                style={{ backgroundColor: cursor.color }}
              >
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
    </div>
  );
}

// Helpers
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