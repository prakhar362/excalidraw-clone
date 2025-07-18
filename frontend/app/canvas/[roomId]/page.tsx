'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { useParams } from 'next/navigation';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then(mod => mod.Excalidraw),
  { ssr: false }
);

export default function CanvasPage() {
  const { roomId } = useParams();
  const wsRef = useRef<WebSocket | null>(null);
  const excalidrawRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const clientId = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) return;

    const ws = new WebSocket(`ws://localhost:8000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('✅ WebSocket connected');
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'drawing' && data.clientId !== clientId.current) {
        const incomingElements = Array.isArray(data.elements) ? data.elements : [data.elements];
        const currentElements = excalidrawRef.current?.getSceneElements() || [];
        const merged = mergeElements(currentElements, incomingElements);
        excalidrawRef.current?.updateScene({ elements: merged });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [roomId]);

  const sendElements = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (elements: readonly ExcalidrawElement[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (sendElements.current) clearTimeout(sendElements.current);
    sendElements.current = setTimeout(() => {
      console.log('[WS] Sending elements:', elements, 'from clientId:', clientId.current);
      wsRef.current?.send(JSON.stringify({
        type: 'drawing',
        roomId: roomId?.toString(),
        elements,
        clientId: clientId.current
      }));
    }, 150);
  };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Excalidraw
        ref={(instance) => { excalidrawRef.current = instance; }}
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

// ✅ Manual merge logic by version & deletion flag
function mergeElements(
  existing: readonly ExcalidrawElement[],
  incoming: ExcalidrawElement[]
): ExcalidrawElement[] {
  const mergedMap = new Map<string, ExcalidrawElement>();

  // Add existing elements to map
  for (const el of existing) {
    mergedMap.set(el.id, el);
  }

  // Merge or replace with incoming ones
  for (const newEl of incoming) {
    const existingEl = mergedMap.get(newEl.id);
    if (!existingEl || newEl.version > existingEl.version) {
      mergedMap.set(newEl.id, newEl);
    }
  }

  // Filter out deleted elements
  return Array.from(mergedMap.values()).filter(el => !el.isDeleted);
}
