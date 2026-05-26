import { ExcalidrawElement } from '../types/enhancement.types';

export class CanvasUtils {
  
  /**
   * Extract selected elements as a single image blob
   */
  static async extractSelectionAsImage(
    excalidrawAPI: any,
    selectedElementIds: string[]
  ): Promise<Blob> {
    
    const elements = excalidrawAPI.getSceneElements();
    const selectedElements = elements.filter((el: ExcalidrawElement) =>
      selectedElementIds.includes(el.id)
    );
    
    if (selectedElements.length === 0) {
      throw new Error('No elements selected');
    }

    if (selectedElements.length === 1 && selectedElements[0].type === 'image') {
      const singleEl = selectedElements[0] as any;
      if (singleEl.fileId) {
        const files = typeof excalidrawAPI.getFiles === 'function' ? excalidrawAPI.getFiles() : {};
        const file = files[singleEl.fileId];
        if (file && file.dataURL) {
          try {
            console.log("Directly extracting single image element from dataURL:", file.dataURL.substring(0, 100));
            if (file.dataURL.includes('.svg') || file.dataURL.startsWith('data:image/svg+xml')) {
              console.log("Image is SVG. Rendering to PNG blob in browser...");
              const pngBlob = await new Promise<Blob>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = singleEl.width || img.naturalWidth || 500;
                    canvas.height = singleEl.height || img.naturalHeight || 500;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                      reject(new Error("Failed to get canvas context"));
                      return;
                    }
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                      if (blob) resolve(blob);
                      else reject(new Error("Failed to export SVG canvas to blob"));
                    }, 'image/png');
                  } catch (err) {
                    reject(err);
                  }
                };
                img.onerror = (e) => reject(new Error("Failed to load SVG image"));
                img.src = file.dataURL;
              });
              return pngBlob;
            } else {
              const response = await fetch(file.dataURL);
              const blob = await response.blob();
              if (blob) return blob;
            }
          } catch (e) {
            console.warn("Failed to fetch image directly:", e);
          }
        }
      }
    }

    try {
      // Use official high-fidelity Excalidraw export to image utility
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements: selectedElements,
        files: typeof excalidrawAPI.getFiles === 'function' ? excalidrawAPI.getFiles() : {},
        mimeType: 'image/png',
        appState: {
          exportBackground: true,
          exportWithDarkMode: false
        }
      });
      if (blob) return blob;
    } catch (err) {
      console.warn('Failed to export using @excalidraw/excalidraw exportToBlob. Falling back to manual rendering.', err);
    }
    
    // Fallback: Calculate bounding box and draw manually
    const bounds = this.calculateBounds(selectedElements);
    
    // Create temporary canvas
    const canvas = document.createElement('canvas');
    const padding = 20;
    canvas.width = bounds.width + padding * 2;
    canvas.height = bounds.height + padding * 2;
    
    const ctx = canvas.getContext('2d')!;
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw elements
    selectedElements.forEach((element: ExcalidrawElement) => {
      this.drawElement(
        ctx,
        element,
        bounds.minX - padding,
        bounds.minY - padding
      );
    });
    
    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/png');
    });
  }
  
  /**
   * Calculate bounding box of elements
   */
  private static calculateBounds(elements: ExcalidrawElement[]) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    elements.forEach((el) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });
    
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
  
  /**
   * Draw a single element on canvas
   */
  private static drawElement(
    ctx: CanvasRenderingContext2D,
    element: ExcalidrawElement,
    offsetX: number,
    offsetY: number
  ) {
    ctx.save();
    
    ctx.strokeStyle = element.strokeColor || '#000000';
    ctx.fillStyle = element.backgroundColor || 'transparent';
    ctx.lineWidth = element.strokeWidth || 2;
    ctx.globalAlpha = (element.opacity || 100) / 100;
    
    const x = element.x - offsetX;
    const y = element.y - offsetY;
    
    switch (element.type) {
      case 'line':
      case 'draw':
        this.drawLine(ctx, element, x, y);
        break;
      case 'rectangle':
        ctx.strokeRect(x, y, element.width, element.height);
        if (element.backgroundColor !== 'transparent') {
          ctx.fillRect(x, y, element.width, element.height);
        }
        break;
      case 'ellipse':
        this.drawEllipse(ctx, element, x, y);
        break;
      case 'arrow':
        this.drawLine(ctx, element, x, y);
        break;
      case 'text':
        this.drawText(ctx, element, x, y);
        break;
    }
    
    ctx.restore();
  }
  
  private static drawLine(
    ctx: CanvasRenderingContext2D,
    element: any,
    x: number,
    y: number
  ) {
    const points = element.points || [];
    
    if (points.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(x + points[0][0], y + points[0][1]);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(x + points[i][0], y + points[i][1]);
    }
    
    ctx.stroke();
  }
  
  private static drawEllipse(
    ctx: CanvasRenderingContext2D,
    element: ExcalidrawElement,
    x: number,
    y: number
  ) {
    ctx.beginPath();
    ctx.ellipse(
      x + element.width / 2,
      y + element.height / 2,
      element.width / 2,
      element.height / 2,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    
    if (element.backgroundColor !== 'transparent') {
      ctx.fill();
    }
  }
  
  private static drawText(
    ctx: CanvasRenderingContext2D,
    element: any,
    x: number,
    y: number
  ) {
    ctx.font = `${element.fontSize || 20}px ${this.getFontFamily(element.fontFamily)}`;
    ctx.fillStyle = element.strokeColor || '#000000';
    ctx.fillText(element.text || '', x, y + (element.fontSize || 20));
  }
  
  private static getFontFamily(fontFamily: number): string {
    const fonts = ['Virgil', 'Helvetica', 'Cascadia'];
    return fonts[fontFamily - 1] || 'Helvetica';
  }
}
