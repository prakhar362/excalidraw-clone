import axios from 'axios';

const ML_API_BASE = process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000';

export interface MLProcessResult {
  success: boolean;
  intent: string;
  confidence: number;
  result_type: string;
  elements: any[];
  message: string;
  text?: string;
  equation?: string;
  solution?: string[];
  steps?: string[];
  latex?: string;
}

export interface MLClassifyResult {
  success: boolean;
  intent: string;
  confidence: number;
  all_scores: Record<string, number>;
}

export class MLService {
  
  async processSelection(imageBlob: Blob, userPrompt?: string, forceIntent?: string): Promise<MLProcessResult> {
    const formData = new FormData();
    formData.append('file', imageBlob, 'sketch.png');
    
    if (userPrompt) {
      formData.append('user_prompt', userPrompt);
    }
    
    if (forceIntent) {
      formData.append('force_intent', forceIntent);
    }
    
    const response = await axios.post(`${ML_API_BASE}/api/ml/process`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 90000, // 90 seconds — Gemini Vision can take up to ~60s
    });
    
    return response.data;
  }
  
  async classifyIntent(imageBlob: Blob): Promise<MLClassifyResult> {
    const formData = new FormData();
    formData.append('file', imageBlob, 'sketch.png');
    
    const response = await axios.post(`${ML_API_BASE}/api/ml/classify`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 10000,
    });
    
    return response.data;
  }
  
  // Helper: Convert canvas selection to blob
  canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert canvas to blob'));
      }, 'image/png');
    });
  }
  
  // Helper: Extract selected elements as image
  async extractSelectionAsImage(
    excalidrawAPI: any,
    selectedElementIds: string[]
  ): Promise<Blob> {
    // Use Excalidraw's built-in export function
    try {
      const elements = excalidrawAPI.getSceneElements();
      const selectedElements = elements.filter((el: any) => 
        selectedElementIds.includes(el.id)
      );
      
      if (selectedElements.length === 0) {
        throw new Error('No elements selected');
      }

      // Use Excalidraw's exportToBlob function if available
      if (excalidrawAPI.exportToBlob) {
        const blob = await excalidrawAPI.exportToBlob({
          elements: selectedElements,
          mimeType: 'image/png',
          appState: {
            exportBackground: true,
            exportWithDarkMode: false,
          },
        });
        return blob;
      }

      // Fallback: manual canvas extraction
      const minX = Math.min(...selectedElements.map((el: any) => el.x));
      const minY = Math.min(...selectedElements.map((el: any) => el.y));
      const maxX = Math.max(...selectedElements.map((el: any) => el.x + (el.width || 0)));
      const maxY = Math.max(...selectedElements.map((el: any) => el.y + (el.height || 0)));
      
      const canvas = document.createElement('canvas');
      const padding = 20;
      canvas.width = maxX - minX + padding * 2;
      canvas.height = maxY - minY + padding * 2;
      
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw elements
      selectedElements.forEach((element: any) => {
        this.drawElement(ctx, element, minX - padding, minY - padding);
      });
      
      return this.canvasToBlob(canvas);
    } catch (error) {
      console.error('Error extracting selection:', error);
      throw error;
    }
  }
  
  private drawElement(ctx: CanvasRenderingContext2D, element: any, offsetX: number, offsetY: number) {
    ctx.strokeStyle = element.strokeColor || '#000000';
    ctx.lineWidth = element.strokeWidth || 2;
    
    const x = element.x - offsetX;
    const y = element.y - offsetY;
    
    if (element.type === 'line' || element.type === 'draw' || element.type === 'freedraw') {
      ctx.beginPath();
      const points = element.points || [];
      if (points.length > 0) {
        ctx.moveTo(x + points[0][0], y + points[0][1]);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(x + points[i][0], y + points[i][1]);
        }
        ctx.stroke();
      }
    } else if (element.type === 'rectangle') {
      ctx.strokeRect(x, y, element.width, element.height);
    } else if (element.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(x + element.width / 2, y + element.height / 2, 
                  element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
  async checkHealth(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const response = await axios.get(`${ML_API_BASE}/health`, { timeout: 5000 });
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('ML API health check failed:', error);
      return false;
    }
  }
}

export const mlService = new MLService();
