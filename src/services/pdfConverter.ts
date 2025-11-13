import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

/**
 * Converts a PDF file to an array of image URIs (one per page)
 * @param pdfFile - The PDF file to convert
 * @returns Array of image URIs as strings
 */
export async function convertPdfToImages(
  pdfFile: DocumentPicker.DocumentPickerAsset
): Promise<string[]> {
  if (Platform.OS === 'web') {
    return convertPdfToImagesWeb(pdfFile);
  } else {
    // For mobile platforms, we'll use a backend service or alternative method
    // For now, we'll throw an error suggesting a backend solution
    throw new Error(
      'PDF to image conversion on mobile requires a backend service. ' +
      'Please use a cloud function or backend API to convert PDFs to images.'
    );
  }
}

/**
 * Converts PDF to images on web platform using pdfjs-dist from CDN
 */
async function convertPdfToImagesWeb(
  pdfFile: DocumentPicker.DocumentPickerAsset
): Promise<string[]> {
  try {
    // Load pdfjs-dist from CDN to avoid module bundling issues
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('PDF conversion requires a browser environment');
    }

    // Check if pdfjs is already loaded
    let pdfjsLib: any = (window as any).pdfjsLib;
    
    if (!pdfjsLib) {
      // Load pdfjs from CDN
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      
      await new Promise<void>((resolve, reject) => {
        script.onload = () => {
          pdfjsLib = (window as any).pdfjsLib || (window as any).pdfjs;
          if (!pdfjsLib) {
            reject(new Error('Failed to load pdfjs library'));
            return;
          }
          // Set worker source
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          (window as any).pdfjsLib = pdfjsLib;
          resolve();
        };
        script.onerror = () => reject(new Error('Failed to load pdfjs script'));
        document.head.appendChild(script);
      });
    }

    // Read the PDF file
    const fileUri = pdfFile.uri;
    let arrayBuffer: ArrayBuffer;
    
    if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
      // Fetch from URL
      const response = await fetch(fileUri);
      arrayBuffer = await response.arrayBuffer();
    } else if (fileUri.startsWith('data:')) {
      // Handle data URI
      const base64Data = fileUri.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    } else {
      // Read from local file system
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    }

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const imageUris: string[] = [];

    // Convert each page to an image
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      // Set scale for high quality (2x for retina displays)
      const scale = 2;
      const viewport = page.getViewport({ scale });

      // Create a canvas to render the PDF page
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Convert canvas to image data URI
      const imageDataUri = canvas.toDataURL('image/png');
      imageUris.push(imageDataUri);
    }

    return imageUris;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw new Error(`Failed to convert PDF to images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Converts a data URI to a blob
 */
export function dataUriToBlob(dataUri: string): Blob {
  const byteString = atob(dataUri.split(',')[1]);
  const mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * Checks if a file is a PDF based on its MIME type or extension
 */
export function isPdfFile(file: DocumentPicker.DocumentPickerAsset): boolean {
  const mimeType = file.mimeType?.toLowerCase() || '';
  const fileName = file.name?.toLowerCase() || '';
  return mimeType === 'application/pdf' || fileName.endsWith('.pdf');
}

