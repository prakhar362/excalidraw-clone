'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { useParams } from 'next/navigation';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then(mod => mod.Excalidraw),
  { ssr: false }
);

export default function CanvasPage() {
  const { roomId } = useParams();
  const wsRef = useRef<WebSocket | null>(null);
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const clientId = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) return;

    const ws = new WebSocket(`ws://localhost:8000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId: roomId.toString()
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Received message:', data);

        if (data.type === 'drawing' && data.clientId !== clientId.current) {
          console.log('[WS] Applying drawing update from clientId:', data.clientId, data.elements);
          const incomingElements: ExcalidrawElement[] = data.elements;
          excalidrawRef.current?.updateScene({ elements: incomingElements });
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
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
        ref={excalidrawRef}
        theme='light'
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            export: { saveFileToDisk: true },
            saveAsImage: true,
            saveToActiveFile: true
          }
        }}
      />
    </div>
  );
}
