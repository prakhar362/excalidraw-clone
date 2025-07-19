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

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (!token || !roomId) return;

    // Get username from localStorage or use a default
    username.current = storedUsername || `User-${clientId.current.slice(0, 4)}`;

    const ws = new WebSocket(`ws://localhost:8000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ [WebSocket] Connected');
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId,
      }));
      console.log('📤 [WebSocket] Sent join_room for', roomId);
    };

    ws.onmessage = (event) => {
      //console.log('📩 [WebSocket] Raw message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        //console.log('📥 [WebSocket] Parsed message:', data);

        if (data.type === 'drawing' && data.clientId !== clientId.current) {
          //console.log('🖌️ [Drawing] Incoming drawing from another client:', data.clientId);

          const incomingElements = Array.isArray(data.elements) ? data.elements : [data.elements];
          const currentElements = excalidrawAPI?.getSceneElements() || [];

          //console.log('📊 [Merge] Current elements:', currentElements);
          //console.log('📊 [Merge] Incoming elements:', incomingElements);

          const merged = mergeElements(currentElements, incomingElements);

          //console.log('✅ [Apply] Merged scene elements:', merged);
          excalidrawAPI?.updateScene({ elements: merged });
        }

        if (data.type === 'cursor' && data.clientId !== clientId.current) {
          //console.log('🖱️ [Cursor] Position from:', data.clientId, data.pointer,data.username);
          
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
        console.error('❌ [WebSocket] Failed to parse or apply message:', e);
      }
    };

    ws.onerror = (err) => {
      console.error('❌ [WebSocket] Error:', err);
    };

    ws.onclose = () => {
      console.warn('⚠️ [WebSocket] Connection closed');
    };

    return () => {
      ws.close();
      console.log('🛑 [WebSocket] Closed on cleanup');
    };
  }, [roomId, excalidrawAPI]);

  const handleChange = (elements: readonly any[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (sendElements.current) clearTimeout(sendElements.current);
    sendElements.current = setTimeout(() => {
      const payload = {
        type: 'drawing',
        roomId,
        elements,
        clientId: clientId.current,
      };
      //console.log('📤 [Drawing] Sending elements to server:', payload);
      wsRef.current?.send(JSON.stringify(payload));
    }, 150);
  };

  const handlePointerUpdate = (payload: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const cursorPayload = {
      type: 'cursor',
      clientId: clientId.current,
      roomId,
      pointer: payload.pointer,
      color: userColor.current,
      username: username.current,
    };

    wsRef.current.send(JSON.stringify(cursorPayload));
    //console.log('📤 [Cursor] Sent pointer update:', cursorPayload);
  };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Excalidraw
        excalidrawAPI={(api) => {
          //console.log('🔧 [Excalidraw] API ready');
          setExcalidrawAPI(api);
        }}
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
        }}
      />
      
      {/* Custom cursor overlay */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        pointerEvents: 'none',
        zIndex: 1000 
      }}>
        {Object.values(remoteCursors).map((cursor) => (
          <div
            key={cursor.clientId}
            style={{
              position: 'absolute',
              left: cursor.x,
              top: cursor.y,
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: cursor.color,
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-25px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: cursor.color,
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                fontWeight: 'bold',
              }}
            >
              {cursor.username}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 🔁 Manual merge logic to ensure collaborative drawing sync
function mergeElements(
  existing: readonly any[],
  incoming: any[]
): any[] {
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

// 🎨 Generate random color for cursor
function getRandomColor(): string {
  const colors = ['#FF4C4C', '#4CFF4C', '#4C4CFF', '#FFAA00', '#00CFFF', '#FF00DD'];
  return colors[Math.floor(Math.random() * colors.length)];
}
