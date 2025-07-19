'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { useParams } from 'next/navigation';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

export default function CanvasPage() {
  const { roomId } = useParams();
  const wsRef = useRef<WebSocket | null>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const clientId = useRef<string>(Math.random().toString(36).slice(2));
  const sendElements = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) return;

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
      console.log('📩 [WebSocket] Raw message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        console.log('📥 [WebSocket] Parsed message:', data);

        if (data.type === 'drawing' && data.clientId !== clientId.current) {
          console.log('🖌️ [Drawing] Incoming drawing from another client:', data.clientId);

          const incomingElements = Array.isArray(data.elements) ? data.elements : [data.elements];
          const currentElements = excalidrawAPI?.getSceneElements() || [];

          console.log('📊 [Merge] Current elements:', currentElements);
          console.log('📊 [Merge] Incoming elements:', incomingElements);

          const merged = mergeElements(currentElements, incomingElements);

          console.log('✅ [Apply] Merged scene elements:', merged);
          excalidrawAPI?.updateScene({ elements: merged });
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

  const handleChange = (elements: readonly ExcalidrawElement[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (sendElements.current) clearTimeout(sendElements.current);
    sendElements.current = setTimeout(() => {
      const payload = {
        type: 'drawing',
        roomId,
        elements,
        clientId: clientId.current,
      };
      console.log('📤 [Drawing] Sending elements to server:', payload);
      wsRef.current?.send(JSON.stringify(payload));
    }, 150);
  };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Excalidraw
        excalidrawAPI={(api) => {
          console.log('🔧 [Excalidraw] API ready');
          setExcalidrawAPI(api);
        }}
        theme="light"
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            export: { saveFileToDisk: true },
            saveAsImage: true,
            saveToActiveFile: true,
          },
        }}
      />
    </div>
  );
}

// 🔁 Manual merge logic to ensure collaborative drawing sync
function mergeElements(
  existing: readonly ExcalidrawElement[],
  incoming: ExcalidrawElement[]
): ExcalidrawElement[] {
  const map = new Map<string, ExcalidrawElement>();
  existing.forEach(el => map.set(el.id, el));

  for (const el of incoming) {
    const existingEl = map.get(el.id);
    if (!existingEl || el.version > existingEl.version) {
      map.set(el.id, el);
    }
  }

  return Array.from(map.values()).filter(el => !el.isDeleted);
}
