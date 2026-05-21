/**
 * imageService.ts
 *
 * Handles uploading pasted/inserted images to Cloudinary via the backend,
 * and patching Excalidraw image elements so they use permanent URLs instead
 * of ephemeral base64 dataURLs that break on page refresh.
 *
 * Flow:
 *   1. User pastes an image → Excalidraw creates an element with type:"image"
 *      and stores the raw file in its internal BinaryFiles map (fileId → dataURL).
 *   2. We detect new image elements, extract the dataURL from the files map,
 *      upload it to Cloudinary through our backend, and get back a permanent URL.
 *   3. We update the Excalidraw files map so the fileId now points to the
 *      Cloudinary URL instead of the base64 blob.
 *   4. On save, the element JSON contains the fileId; on load we restore the
 *      files map from the saved Cloudinary URLs so images render correctly.
 */

import { BACKEND_URL } from '@/config';

export interface UploadResult {
  success: boolean;
  url: string;
  publicId: string;
  width: number;
  height: number;
}

// ── Upload a single dataURL or Blob to Cloudinary via backend ─────────────────

export async function uploadImageToCloudinary(
  dataUrlOrBlob: string | Blob,
  token: string,
): Promise<UploadResult> {
  const formData = new FormData();

  if (typeof dataUrlOrBlob === 'string') {
    // Convert base64 dataURL → Blob
    const res  = await fetch(dataUrlOrBlob);
    const blob = await res.blob();
    formData.append('image', blob, 'canvas-image.png');
  } else {
    formData.append('image', dataUrlOrBlob, 'canvas-image.png');
  }

  const response = await fetch(`${BACKEND_URL}/upload-image`, {
    method:  'POST',
    headers: { Authorization: token },
    body:    formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
}

// ── Scan scene for new image elements and upload their dataURLs ───────────────

export async function syncImagesToCloudinary(
  excalidrawAPI: any,
  token: string,
  /** Track which fileIds we've already uploaded so we don't re-upload */
  uploadedIds: Set<string>,
): Promise<void> {
  const elements = excalidrawAPI.getSceneElements();
  const files    = excalidrawAPI.getFiles() as Record<string, { dataURL: string; mimeType: string }>;

  const imageElements = elements.filter((el: any) => el.type === 'image' && el.fileId);

  for (const el of imageElements) {
    const fileId = el.fileId as string;

    // Skip already-uploaded or already-Cloudinary files
    if (uploadedIds.has(fileId)) continue;
    const file = files[fileId];
    if (!file) continue;
    // Already a remote URL — nothing to do
    if (file.dataURL.startsWith('http')) {
      uploadedIds.add(fileId);
      continue;
    }

    try {
      console.log(`Uploading image ${fileId} to Cloudinary…`);
      const result = await uploadImageToCloudinary(file.dataURL, token);

      if (result.success) {
        // Patch the files map in Excalidraw so it uses the Cloudinary URL
        excalidrawAPI.addFiles([{
          id:       fileId,
          dataURL:  result.url,
          mimeType: file.mimeType,
          created:  Date.now(),
        }]);

        uploadedIds.add(fileId);
        console.log(`✅ Image ${fileId} → ${result.url}`);
      }
    } catch (err) {
      console.error(`Failed to upload image ${fileId}:`, err);
    }
  }
}

// ── Restore images from saved Cloudinary URLs on page load ───────────────────
// Call this after loading elements from the backend.
// The saved Chat messages contain element JSON with fileIds; we need to
// re-populate the Excalidraw files map with the Cloudinary URLs.

export async function restoreImagesFromElements(
  excalidrawAPI: any,
  elements: any[],
): Promise<void> {
  const imageElements = elements.filter(
    (el: any) => el.type === 'image' && el.fileId && el.cloudinaryUrl,
  );

  if (imageElements.length === 0) return;

  const filesToAdd = imageElements.map((el: any) => ({
    id:       el.fileId as string,
    dataURL:  el.cloudinaryUrl as string,
    mimeType: (el.mimeType as string) || 'image/png',
    created:  Date.now(),
  }));

  excalidrawAPI.addFiles(filesToAdd);
  console.log(`Restored ${filesToAdd.length} image(s) from Cloudinary`);
}
