import axios, { AxiosError } from 'axios';
import {
  EnhancementRequest,
  EnhancementResult,
  EnhancementInfo,
  EnhancementStyle
} from '../types/enhancement.types';

const ML_API_BASE = process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000';

export class SketchEnhancementService {
  
  /**
   * Enhance a single sketch
   */
  async enhanceSketch(request: EnhancementRequest): Promise<EnhancementResult> {
    const formData = new FormData();
    if (request.file) {
      formData.append('file', request.file, 'sketch.png');
    }
    if (request.imageUrl) {
      formData.append('image_url', request.imageUrl);
    }
    formData.append('style', request.style);
    formData.append('use_ai', String(request.useAI));
    formData.append('return_vectors', String(request.returnVectors));
    formData.append('return_preview', String(request.returnPreview));
    
    try {
      const response = await axios.post<EnhancementResult>(
        `${ML_API_BASE}/api/ml/enhance-sketch`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 seconds
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            console.log(`Upload progress: ${percentCompleted}%`);
          },
        }
      );
      
      return response.data;
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ detail: string }>;
        throw new Error(
          axiosError.response?.data?.detail || 'Enhancement failed'
        );
      }
      throw error;
    }
  }
  
  /**
   * Enhance multiple sketches in batch
   */
  async enhanceSketchBatch(
    files: Blob[],
    style: EnhancementStyle,
    useAI: boolean = false
  ) {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append('files', file, `sketch_${index}.png`);
    });
    
    formData.append('style', style);
    formData.append('use_ai', String(useAI));
    
    const response = await axios.post(
      `${ML_API_BASE}/api/ml/enhance-sketch-batch`,
      formData,
      {
        timeout: 120000, // 2 minutes
      }
    );
    
    return response.data;
  }
  
  /**
   * Get enhancement capabilities
   */
  async getEnhancementInfo(): Promise<EnhancementInfo> {
    const response = await axios.get<EnhancementInfo>(
      `${ML_API_BASE}/api/ml/enhancement-info`
    );
    return response.data;
  }
}

export const sketchEnhancementService = new SketchEnhancementService();
