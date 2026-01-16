'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { RoomChat } from '@/components/RoomChat';
import { useParams } from 'next/navigation';
import { BACKEND_URL, WSS_URL } from '../../../config';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';

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

  /* AI STATE */
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // 1. Initialize User Data from JWT
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

  // 3. WebSocket Lifecycle
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
              const currentElements = excalidrawAPIRef.current.getSceneElements();
              const merged = mergeElements(currentElements, data.elements);
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
        } catch (e) {}
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
      if (wsRef.current) wsRef.current.close(1000, "Unmounted");
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

  // 5. AI Magic Logic
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
            contents: [{
              role: 'user',
              parts: [{
                text: `Act as an Excalidraw Architect. Your sole purpose is to transform natural language descriptions into a valid JSON array of ExcalidrawElementSkeleton objects.



🛑 STRICT OUTPUT RULES:

OUTPUT ONLY RAW JSON. No markdown formatting, no code blocks (unless requested), no preamble, and no post-explanation.



FORMAT: Use the convertToExcalidrawElements Skeleton API format.



COORDINATES: Every element must have absolute x and y values. Calculate these logically to prevent overlapping unless requested.



🛠 ELEMENT CONSTRUCTION GUIDE:

1. Basic Shapes (Rectangle, Ellipse, Diamond)

Use type: "rectangle" | "ellipse" | "diamond".



Attributes: width, height, backgroundColor, strokeWidth, strokeColor.



Styles: strokeStyle ("solid", "dashed", "dotted") and fillStyle ("solid", "cross-hatch").



Example: { "type": "diamond", "x": 550, "y": 250, "width": 200, "height": 100, "backgroundColor": "#a5d8ff", "strokeStyle": "dashed" }



2. Text Elements

Use type: "text".



Attributes: text, fontSize, strokeColor.



Example: { "type": "text", "x": 100, "y": 150, "text": "Label", "fontSize": 20 }



3. Text Containers (Shapes with Labels)

To put text inside a shape, use the label property.



Required: label: { text: "..." }.



Optional: textAlign ("left", "center", "right"), verticalAlign ("top", "middle"), fontSize, strokeColor.



Example: { "type": "rectangle", "x": 180, "y": 150, "label": { "text": "Header", "textAlign": "left", "verticalAlign": "top" } }



4. Lines and Arrows

Use type: "line" | "arrow".



Arrowheads: startArrowhead and endArrowhead (e.g., "dot", "triangle", "arrow", "bar").



Labels: Arrows can also take a label object just like shapes.



Example: { "type": "arrow", "x": 100, "y": 100, "label": { "text": "Flow" }, "endArrowhead": "triangle" }



5. Element Binding (Connections)

To connect an arrow between two elements, use the start and end objects.



Binding by ID: Assign a unique id to shapes and reference them in the arrow.



Binding by Type: If IDs are not used, use type within the start/end objects.



Example: { "type": "arrow", "start": { "id": "rect1" }, "end": { "id": "diam1" }, "label": { "text": "Yes" } }



6. Frames

Group elements using type: "frame".



Attributes: name, children: ["id1", "id2"].



🎨 DESIGN PRINCIPLES:

Spacing: Maintain at least 600-1000 units of padding between distinct shapes.

Color Palette: Use professional, muted hex codes (e.g., #c0eb75 for success, #ffc9c9 for errors, #a5d8ff for info).

Flowcharts: Always use diamond for decision nodes and rectangle for process steps and use labelled arrows for flows.



### CRITICAL INSTRUCTIONS FOR ARROWS:

1. ARROW COORDINATES: Every arrow MUST have an "x" and "y" property. Set them equal to the "x" and "y" of the 'start' element.
2. BINDING: Use "start": { "id": "source_id" } and "end": { "id": "target_id" }.
3. UNIQUE IDS: Assign every rectangle/ellipse a unique "id" (e.g., "api_gateway") so arrows can bind to them.
4. LABELS: Use the "label" object inside arrows for text.
5. For every 'arrow' type, set the 'x' and 'y' properties to exactly match the 'x' and 'y' of the element it is starting from. Do not leave them as 0

### EXAMPLE ARROW STRUCTURE:

{

  "id": "arrow_1",

  "type": "arrow",

  "x": 100, // Must match start element x

  "y": 150, // Must match start element y

  "start": { "id": "node_a" },

  "end": { "id": "node_b" },

  "label": { "text": "Flow" }

}

### SPATIAL LAYOUT INSTRUCTIONS:

1. SPREAD OUT: Use a coordinate space of at least 1500 units wide.
2. NO CROWDING: Maintain a minimum horizontal gap of 250 units and vertical gap of 200 units between any two shapes.
3. LAYERED ARCHITECTURE:
   - Row 1 (y=100): Clients/Users
   - Row 2 (y=350): Gateway/Load Balancer
   - Row 3 (y=600): Microservices
   - Row 4 (y=850): Databases/Storage
4. ALIGNMENT: Group related items vertically. For example, if a service uses a specific DB, place the DB directly below that service (same x-coordinate).

5. ARROWS: Always include 'start' and 'end' bindings with the correct element 'id'.
User Request: ${aiPrompt}`
              }]
            }]
          }),
        }
      );

      const data = await res.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const jsonMatch = aiText.match(/\[.*\]/s);
      if (!jsonMatch) throw new Error("Invalid AI Response");
      
      const parsedJson = JSON.parse(jsonMatch[0]);
      
      // Fix arrow positions
      const fixedJson = parsedJson.map((el: any) => {
        if (el.type === "arrow" && el.start?.id && el.end?.id) {
          const source = parsedJson.find((s: any) => s.id === el.start.id);
          const target = parsedJson.find((t: any) => t.id === el.end.id);
          if (source && target) {
            return {
              ...el,
              x: source.x + (source.width || 100) / 2,
              y: source.y + (source.height || 50) / 2,
              points: [[0, 0], [target.x - source.x, target.y - source.y]]
            };
          }
        }
        return el;
      });

      const aiElements = convertToExcalidrawElements(fixedJson, { regenerateIds: false });
      const currentElements = excalidrawAPIRef.current.getSceneElements();
      const merged = mergeElements(currentElements, aiElements);

      excalidrawAPIRef.current.updateScene({ elements: merged });
      setShowAIModal(false);
      setAiPrompt('');
    } catch (e) {
      alert('AI Generation Failed');
    } finally {
      setAiLoading(false);
    }
  };

  // 6. Original Functionalities (Save/Share)
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

  const handleShare = () => { setShowShare(true); setCopied(false); };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setShowShare(false), 1000);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#f0f0f0]">
      <Excalidraw
        excalidrawAPI={(api) => (excalidrawAPIRef.current = api)}
        theme="light"
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        UIOptions={{ 
          canvasActions: { loadScene: true, export: { saveFileToDisk: true }, saveAsImage: true },
        }}
      />

      {/* Unified Bottom UI */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-slate-200">
        <button 
          onClick={() => setShowAIModal(true)} 
          className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition shadow-sm"
        >
          AI Magic ✨
        </button>

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
          className="text-sm font-semibold text-blue-600 border border-blue-600 rounded-lg px-4 py-1.5 bg-white hover:bg-blue-50 transition-all shadow-sm"
        >
          Share
        </button>
      </div>

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white p-6 rounded-2xl w-[450px] shadow-2xl">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Generate with AI</h3>
            <textarea
              autoFocus
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-purple-500 outline-none transition h-32 text-sm"
              placeholder="e.g. A system architecture with a load balancer, two servers and a database..."
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowAIModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                disabled={aiLoading}
                onClick={generateFromAI}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-semibold disabled:bg-purple-300 transition"
              >
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