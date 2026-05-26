export type EnhancementStyle = 'professional' | 'artistic' | 'clean' | 'minimal';

export interface EnhancementRequest {
  file?: Blob;
  imageUrl?: string;
  style: EnhancementStyle;
  useAI: boolean;
  returnVectors: boolean;
  returnPreview: boolean;
}

export interface EnhancementResult {
  success: boolean;
  style: EnhancementStyle;
  method: 'onnx-ml' | 'gemini-ai' | 'opencv' | 'controlnet';
  confidence: number;
  preview?: string;
  elements?: ExcalidrawElement[];
  element_count?: number;
  message: string;
}

export interface EnhancementInfo {
  onnx_ml_available: boolean;
  opencv_available: boolean;
  controlnet_available: boolean;
  ai_enhancement_enabled: boolean;
  styles: EnhancementStyle[];
  default_style: EnhancementStyle;
  max_image_size: number;
  enhancement_methods?: Record<string, string>;
  recommended_use: Record<EnhancementStyle, string>;
}

export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  points?: number[][];
  [key: string]: any; // other Excalidraw properties
}
