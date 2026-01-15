'use client';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, MessageSquare, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { BACKEND_URL } from '@/config';
import { motion, AnimatePresence } from 'framer-motion';

export function RoomChat({ roomId, ws, currentUserId }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Connection Monitoring
  useEffect(() => {
    const checkConnection = () => {
      setIsReady(ws?.readyState === WebSocket.OPEN);
    };
    const timer = setInterval(checkConnection, 1000);
    return () => clearInterval(timer);
  }, [ws]);

  // Load History
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/rooms/${roomId}/messages`, {
          headers: { Authorization: localStorage.getItem('token') }
        });
        setMessages(res.data.messages || []);
      } catch (e) { console.error("History failed", e); }
    };
    if (roomId) loadHistory();
  }, [roomId]);

  // WebSocket Listener
  useEffect(() => {
    if (!ws) return;
    const handleWsMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat' && data.roomId === roomId) {
          setMessages((prev) => [...prev, data.message]);
        }
      } catch (e) {}
    };
    ws.addEventListener('message', handleWsMessage);
    return () => ws.removeEventListener('message', handleWsMessage);
  }, [ws, roomId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const sendMessage = () => {
    if (!input.trim() || !ws) return;

    if (ws.readyState !== WebSocket.OPEN) {
      // Add a temporary local "Error" message if sending fails
      const failedMsg = {
        userId: { _id: currentUserId, name: 'You' },
        content: input,
        error: true,
        tempId: Date.now()
      };
      setMessages((prev) => [...prev, failedMsg]);
      setInput('');
      return;
    }

    ws.send(JSON.stringify({
      type: 'chat',
      roomId,
      content: input
    }));
    setInput('');
  };

  return (
    <>
      <Button 
        variant="default" 
        size="icon" 
        className={cn(
          "fixed bottom-4 right-4 rounded-full shadow-2xl z-50 h-12 w-12 transition-all",
          isReady ? "bg-blue-600 hover:bg-blue-700" : "bg-neutral-500"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 w-80 h-[450px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-2xl rounded-xl flex flex-col z-50 overflow-hidden"
          >
            <div className="p-4 border-b bg-neutral-50 dark:bg-neutral-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm dark:text-white">Live Chat</h3>
                <span className={cn("h-2 w-2 rounded-full", isReady ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              </div>
              {!isReady && <span className="text-[10px] text-red-500 font-bold uppercase tracking-tight">Offline</span>}
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="flex flex-col gap-4">
                {messages.map((msg, idx) => {
                  const isMe = (msg.userId?._id || msg.userId) === currentUserId;
                  return (
                    <div key={msg.tempId || idx} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                      {!isMe && <span className="text-[10px] font-bold text-neutral-500 mb-1 ml-1">{msg.userId?.name}</span>}
                      <div className="flex items-center gap-2 max-w-[85%]">
                        {isMe && msg.error && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        <div className={cn(
                          "px-3 py-2 rounded-2xl text-sm break-words shadow-sm",
                          isMe 
                            ? (msg.error ? "bg-red-100 text-red-700 border border-red-200" : "bg-blue-600 text-white rounded-br-none") 
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-bl-none"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                      {msg.error && <span className="text-[9px] text-red-500 mt-1 mr-1">Failed to send</span>}
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="p-3 border-t bg-white dark:bg-neutral-900 flex gap-2">
              <Input 
                placeholder={isReady ? "Message..." : "Reconnecting..."}
                value={input} 
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                className="h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 border-none"
              />
              <Button size="icon" className="h-10 w-10 rounded-full shrink-0" onClick={sendMessage} disabled={!input.trim()}>
                {isReady ? <Send className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}