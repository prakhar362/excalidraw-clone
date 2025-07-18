'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { useParams } from 'next/navigation';

// Dynamically import Excalidraw
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

export default function CanvasPage() {
  const { roomId } = useParams();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) return;

    const ws = new WebSocket(`ws://localhost:8000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      setIsConnected(true);

      ws.send(JSON.stringify({
        type: 'join_room',
        roomId: roomId.toString()
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // handle incoming stroke/chat etc.
      console.log("📨 Received:", data);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("❌ WebSocket closed");
    };

    return () => {
      ws.close();
    };
  }, [roomId]);

  const handleChange = async (elements: readonly any[]) => {
    const message = {
      type: 'chat',
      roomId: roomId?.toString(),
      message: JSON.stringify(elements), // send drawing data as chat message
    };

    const ws = wsRef.current;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }

    // Save to HTTP layer
    try {
      await fetch(`http://localhost:5000/chats/${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ message: JSON.stringify(elements) }),
      });
    } catch (err) {
      console.error("❌ Failed to send HTTP chat:", err);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Excalidraw
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
