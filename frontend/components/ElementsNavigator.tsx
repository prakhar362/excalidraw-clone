'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  label?: { text?: string };
  strokeColor?: string;
  backgroundColor?: string;
  isDeleted?: boolean;
}

interface Props {
  excalidrawAPI: any;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const TYPE_ICON: Record<string, string> = {
  rectangle: '▬',
  ellipse: '⬭',
  diamond: '◆',
  line: '╱',
  arrow: '→',
  text: 'T',
  image: '🖼',
  frame: '⬜',
  freedraw: '✏',
};

const TYPE_COLOR: Record<string, string> = {
  rectangle: '#4f8ef7',
  ellipse: '#a855f7',
  diamond: '#f59e0b',
  line: '#64748b',
  arrow: '#10b981',
  text: '#ef4444',
  image: '#ec4899',
  frame: '#6366f1',
  freedraw: '#f97316',
};

function getLabel(el: ExcalidrawElement): string {
  if (el.type === 'text' && el.text) return el.text.slice(0, 30);
  if (el.label?.text) return el.label.text.slice(0, 30);
  return `${el.type} (${Math.round(el.x)}, ${Math.round(el.y)})`;
}

function groupByType(elements: ExcalidrawElement[]) {
  const groups: Record<string, ExcalidrawElement[]> = {};
  for (const el of elements) {
    if (!groups[el.type]) groups[el.type] = [];
    groups[el.type].push(el);
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function ElementsNavigator({ excalidrawAPI }: Props) {
  const [elements, setElements] = useState<ExcalidrawElement[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Poll the scene every 800ms to pick up changes */
  useEffect(() => {
    if (!excalidrawAPI) return;

    const refresh = () => {
      const raw: ExcalidrawElement[] = excalidrawAPI.getSceneElements() ?? [];
      setElements(raw.filter((el) => !el.isDeleted));
    };

    refresh();
    intervalRef.current = setInterval(refresh, 800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [excalidrawAPI]);

  /* Focus element on canvas when clicked */
  const focusElement = useCallback(
    (el: ExcalidrawElement) => {
      if (!excalidrawAPI) return;
      setSelectedId(el.id);

      // Select the element
      excalidrawAPI.updateScene({
        appState: { selectedElementIds: { [el.id]: true } },
      });

      // scrollTo uses raw canvas coordinates — safe, no schema requirements
      const appState = excalidrawAPI.getAppState?.();
      const zoom = appState?.zoom?.value ?? 1;
      const { width: vw = 800, height: vh = 600 } = appState ?? {};
      const cx = el.x + (el.width ?? 100) / 2;
      const cy = el.y + (el.height ?? 50) / 2;

      excalidrawAPI.scrollTo(
        // scrollX/scrollY are offsets so that the element centre lands in viewport centre
        -(cx - vw / (2 * zoom)),
        -(cy - vh / (2 * zoom))
      );
    },
    [excalidrawAPI]
  );

  const toggleGroup = (type: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filtered = elements.filter((el) =>
    getLabel(el).toLowerCase().includes(search.toLowerCase()) ||
    el.type.toLowerCase().includes(search.toLowerCase())
  );

  const groups = groupByType(filtered);
  const totalCount = elements.length;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Elements Navigator"
        className="navigator-toggle"
        style={{
          position: 'fixed',
          top: '50%',
          right: open ? 264 : 12,
          transform: 'translateY(-50%)',
          zIndex: 60,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
          transition: 'right 0.3s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {open ? '›' : '‹'}
        {!open && totalCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -6,
            right: -6,
            background: '#ef4444',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            borderRadius: '50%',
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 260,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
          zIndex: 59,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          borderLeft: '1px solid #e2e8f0',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 14px 10px',
          borderBottom: '1px solid #f1f5f9',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>
              🗂 Elements
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.25)',
              borderRadius: 20,
              padding: '1px 8px',
              fontSize: 11,
              fontWeight: 600,
            }}>
              {totalCount}
            </span>
          </div>
          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search elements…"
            style={{
              width: '100%',
              padding: '5px 9px',
              borderRadius: 8,
              border: 'none',
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {Object.keys(groups).length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: 12,
              padding: '32px 16px',
            }}>
              {search ? 'No elements match.' : 'Canvas is empty.\nStart drawing!'}
            </div>
          ) : (
            Object.entries(groups).map(([type, els]) => {
              const icon = TYPE_ICON[type] ?? '◉';
              const color = TYPE_COLOR[type] ?? '#64748b';
              const collapsed = collapsedGroups.has(type);

              return (
                <div key={type}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(type)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      background: color + '22',
                      color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {icon}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'capitalize' }}>
                      {type}
                    </span>
                    <span style={{
                      background: color + '22',
                      color,
                      borderRadius: 20,
                      padding: '0 6px',
                      fontSize: 10,
                      fontWeight: 700,
                    }}>
                      {els.length}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 10, marginLeft: 2 }}>
                      {collapsed ? '▸' : '▾'}
                    </span>
                  </button>

                  {/* Elements in group */}
                  {!collapsed && els.map((el) => {
                    const label = getLabel(el);
                    const isSelected = selectedId === el.id;

                    return (
                      <button
                        key={el.id}
                        onClick={() => focusElement(el)}
                        title={`${el.type}: ${label}\nPosition: (${Math.round(el.x)}, ${Math.round(el.y)})`}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '4px 12px 4px 28px',
                          background: isSelected ? color + '15' : 'none',
                          border: 'none',
                          borderLeft: isSelected ? `2px solid ${color}` : '2px solid transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'none';
                        }}
                      >
                        {/* Color swatch */}
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: el.strokeColor && el.strokeColor !== 'transparent' ? el.strokeColor : color,
                          border: '1px solid rgba(0,0,0,0.1)',
                          flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: 11,
                          color: '#374151',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 9, color: '#cbd5e1', flexShrink: 0 }}>
                          {Math.round(el.x)},{Math.round(el.y)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid #f1f5f9',
          fontSize: 10,
          color: '#94a3b8',
          textAlign: 'center',
        }}>
          Click any element to focus on canvas
        </div>
      </div>
    </>
  );
}
