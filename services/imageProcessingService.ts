import type { Area, GeneratePackageParams, ImageEditState, ProcessedPackageResult, ImageAnalysisResult } from '../types.js';

// Declare Uploadcare and Jimp global variables for TypeScript
declare var uploadcare: any;
declare var Jimp: any; // Jimp will be loaded globally via script tag in index.html

const PROBLEMATIC_CDN_HOSTS = ['ddfcdn.realtor.ca', 'mlsphotos.onregional.com'];
const LAST_IMAGE_OVERLAY_URL = 'https://cdn.prod.website-files.com/651d8cc426674e7695b3aaf4/683751a58e87589038656ccb_10.png';

// --- Low Resolution Detection Constants ---
const TARGET_DIMENSION_FOR_ANALYSIS = 1080;
const LOW_RESOLUTION_THRESHOLD_FACTOR = 0.8; // If dimensions are less than 80% of target

const getUploadcareUuid = (url: string): string | null => {
  const match = url.match(/ucarecdn\.com\/([a-f0-9-]+)/i);
  return match ? match[1] : null;
};

const getProxiedUrlViaUploadcare = (originalUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof uploadcare === 'undefined' || typeof uploadcare.fileFrom !== 'function') {
      return reject(new Error('Uploadcare widget is not loaded or `fileFrom` is not available.'));
    }
    const file = uploadcare.fileFrom('url', originalUrl);
    file.done((fileInfo: any) => {
      const cdnUrl = `https://ucarecdn.com/${fileInfo.uuid}/`;
      resolve(cdnUrl);
    }).fail((errorInfo: any) => {
      let message = `Uploadcare failed to process URL ${originalUrl}.`;
      if (errorInfo && typeof errorInfo.type === 'string') message += ` Type: ${errorInfo.type}.`;
      else if (errorInfo && typeof errorInfo === 'string') message += ` Details: ${errorInfo}.`;
      reject(new Error(message));
    });
  });
};

export const analyzeImageDimensionsAndStrips = async (originalUrl: string): Promise<ImageAnalysisResult> => {
    return new Promise(async (resolve) => {
        let urlToLoad = originalUrl;
        let wasProxiedByUploadcare = false;
        const analysisResult: ImageAnalysisResult = { 
            hasSignificantStrips: undefined, 
            isPotentiallyLowResolution: undefined,
            naturalWidth: undefined,
            naturalHeight: undefined,
        };

        const needsProxyDueToCDN = PROBLEMATIC_CDN_HOSTS.some(host => originalUrl.includes(host));
        let currentUuid = getUploadcareUuid(originalUrl);
        let baseUploadcareUrl: string | null = null;

        if (currentUuid) {
            baseUploadcareUrl = `https://ucarecdn.com/${currentUuid}/`;
        }

        if (!baseUploadcareUrl && needsProxyDueToCDN) {
            try {
                baseUploadcareUrl = await getProxiedUrlViaUploadcare(originalUrl);
                wasProxiedByUploadcare = true;
            } catch (proxyError) {
                console.error(`[Analysis] Uploadcare proxy failed for ${originalUrl}:`, proxyError);
                 analysisResult.hasSignificantStrips = true; 
                 analysisResult.isPotentiallyLowResolution = undefined; 
                resolve(analysisResult);
                return;
            }
        }
        
        if (baseUploadcareUrl) {
            urlToLoad = baseUploadcareUrl; 
        }

        const imgHtmlElement = new Image(); 
        imgHtmlElement.crossOrigin = 'anonymous'; 
        imgHtmlElement.onload = async () => { 
            if (typeof Jimp === 'undefined') {
                console.warn("[Analysis] Jimp is not available. Cannot perform strip or low-resolution detection. Flagging cautiously for strips.");
                analysisResult.hasSignificantStrips = true;
                analysisResult.isPotentiallyLowResolution = undefined;
                analysisResult.naturalWidth = imgHtmlElement.naturalWidth; // Store from HTMLImageElement if Jimp fails early
                analysisResult.naturalHeight = imgHtmlElement.naturalHeight;
                resolve(analysisResult); 
                return;
            }

            try {
                console.log(`[Analysis] Jimp: Reading image ${urlToLoad} (original: ${originalUrl})`);
                const jimpImage = await Jimp.read(urlToLoad);
                const width = jimpImage.getWidth();
                const height = jimpImage.getHeight();

                analysisResult.naturalWidth = width;
                analysisResult.naturalHeight = height;

                if (width === 0 || height === 0) {
                    console.warn(`[Analysis] Jimp loaded image ${urlToLoad} with zero dimensions.`);
                    analysisResult.hasSignificantStrips = false; 
                    analysisResult.isPotentiallyLowResolution = false;
                    resolve(analysisResult); 
                    return;
                }

                // --- Strip Detection ---
                const WHITE_THRESHOLD = 240; 
                const ALPHA_THRESHOLD = 128; 
                const STRIP_ROW_PIXEL_PERCENTAGE = 0.8; 
                const CHECK_ROW_COUNT_PERCENT = 0.10; 
                const MIN_CHECK_ROWS = 5;
                const checkRowCount = Math.max(MIN_CHECK_ROWS, Math.floor(height * CHECK_ROW_COUNT_PERCENT));
                const SAMPLE_POINTS_X_RATIOS = [0.1, 0.3, 0.5, 0.7, 0.9]; 

                let topStripRows = 0;
                for (let y = 0; y < checkRowCount; y++) {
                    if (y >= height) break;
                    let whitePixelsInRow = 0;
                    for (const xRatio of SAMPLE_POINTS_X_RATIOS) {
                        const x = Math.max(0, Math.min(width - 1, Math.floor(width * xRatio)));
                        const pixel = Jimp.intToRGBA(jimpImage.getPixelColor(x, y));
                        if (pixel.r >= WHITE_THRESHOLD && pixel.g >= WHITE_THRESHOLD && pixel.b >= WHITE_THRESHOLD && pixel.a >= ALPHA_THRESHOLD) {
                            whitePixelsInRow++;
                        }
                    }
                    if (whitePixelsInRow / SAMPLE_POINTS_X_RATIOS.length >= STRIP_ROW_PIXEL_PERCENTAGE) {
                        topStripRows++;
                    } else { break; }
                }

                let bottomStripRows = 0;
                for (let y = height - 1; y >= height - checkRowCount; y--) {
                    if (y < 0) break;
                    let whitePixelsInRow = 0;
                    for (const xRatio of SAMPLE_POINTS_X_RATIOS) {
                        const x = Math.max(0, Math.min(width - 1, Math.floor(width * xRatio)));
                        const pixel = Jimp.intToRGBA(jimpImage.getPixelColor(x, y));
                        if (pixel.r >= WHITE_THRESHOLD && pixel.g >= WHITE_THRESHOLD && pixel.b >= WHITE_THRESHOLD && pixel.a >= ALPHA_THRESHOLD) {
                            whitePixelsInRow++;
                        }
                    }
                    if (whitePixelsInRow / SAMPLE_POINTS_X_RATIOS.length >= STRIP_ROW_PIXEL_PERCENTAGE) {
                        bottomStripRows++;
                    } else { break; }
                }
                
                const SIGNIFICANT_STRIP_TOTAL_HEIGHT_PERCENTAGE = 0.05; 
                const totalStripHeightRatio = (topStripRows + bottomStripRows) / height;

                if (totalStripHeightRatio >= SIGNIFICANT_STRIP_TOTAL_HEIGHT_PERCENTAGE && (topStripRows > 0 || bottomStripRows > 0) ) {
                    console.log(`[Analysis Strips] FLAGGED: Image ${originalUrl}. Top: ${topStripRows}, Bottom: ${bottomStripRows}. Total: ${(totalStripHeightRatio*100).toFixed(1)}%`);
                    analysisResult.hasSignificantStrips = true;
                } else {
                    console.log(`[Analysis Strips] OK: Image ${originalUrl}. No significant strips. Top: ${topStripRows}, Bottom: ${bottomStripRows}`);
                    analysisResult.hasSignificantStrips = false;
                }

                // --- Low Resolution Detection ---
                if (width < TARGET_DIMENSION_FOR_ANALYSIS * LOW_RESOLUTION_THRESHOLD_FACTOR || 
                    height < TARGET_DIMENSION_FOR_ANALYSIS * LOW_RESOLUTION_THRESHOLD_FACTOR) {
                    analysisResult.isPotentiallyLowResolution = true;
                    console.log(`[Analysis LowRes] FLAGGED: Image ${originalUrl} (${width}x${height}) is smaller than threshold relative to ${TARGET_DIMENSION_FOR_ANALYSIS}px.`);
                } else {
                    analysisResult.isPotentiallyLowResolution = false;
                    console.log(`[Analysis LowRes] OK: Image ${originalUrl} (${width}x${height}) dimensions are sufficient.`);
                }
                // --- End Low Resolution Detection ---

                resolve(analysisResult);

            } catch (jimpError) {
                console.error(`[Analysis] Jimp processing failed for ${urlToLoad} (original: ${originalUrl}). Flagging cautiously. Error:`, jimpError);
                analysisResult.hasSignificantStrips = true; 
                analysisResult.isPotentiallyLowResolution = true; // Also flag as potentially low res if Jimp fails
                // Try to get dimensions from HTMLImageElement as fallback if Jimp failed after load
                analysisResult.naturalWidth = analysisResult.naturalWidth || imgHtmlElement.naturalWidth;
                analysisResult.naturalHeight = analysisResult.naturalHeight || imgHtmlElement.naturalHeight;
                resolve(analysisResult); 
            }
        };
        imgHtmlElement.onerror = (_event) => { 
            let errorMessage = `[Analysis] HTMLImageElement load for initial check failed for ${urlToLoad}.`;
            if (wasProxiedByUploadcare) {
                 errorMessage += ` (Original URL: ${originalUrl}, processed URL: ${urlToLoad}).`;
            }
            console.error(errorMessage, _event);
            if (analysisResult.hasSignificantStrips === undefined) analysisResult.hasSignificantStrips = true;
            if (analysisResult.isPotentiallyLowResolution === undefined) analysisResult.isPotentiallyLowResolution = true; // Flag as potentially low res
            // naturalWidth/Height will remain undefined if image load fails
            resolve(analysisResult); 
        };
        console.log(`[Analysis] Attempting to load image for analysis from: ${urlToLoad} (HTMLImageElement src set for onload/onerror)`);
        imgHtmlElement.src = urlToLoad;
    });
};


interface LoadImageOptions {
  sharpness?: number; // 0-20
}

interface LoadImageResult {
  img: HTMLImageElement;
}

const loadImage = (originalUrl: string, options?: LoadImageOptions): Promise<LoadImageResult> => {
  return new Promise(async (resolve, reject) => {
    let urlToLoad = originalUrl;
    let baseUploadcareUrl: string | null = null;
    let wasProcessedByUploadcare = false;

    const needsProxyDueToCDN = PROBLEMATIC_CDN_HOSTS.some(host => originalUrl.includes(host));
    const needsUploadcareSharpness = !!(options?.sharpness && options.sharpness > 0);
    
    let currentUuid = getUploadcareUuid(originalUrl);

    if (currentUuid) {
        baseUploadcareUrl = `https://ucarecdn.com/${currentUuid}/`;
    }

    if ((needsUploadcareSharpness && !baseUploadcareUrl) || (needsProxyDueToCDN && !baseUploadcareUrl)) {
        try {
            baseUploadcareUrl = await getProxiedUrlViaUploadcare(originalUrl);
            wasProcessedByUploadcare = true; 
        } catch (proxyError) {
            return reject(new Error(`Image proxying via Uploadcare failed for ${originalUrl}. Details: ${(proxyError as Error).message}`));
        }
    }
    
    if (baseUploadcareUrl) {
        urlToLoad = baseUploadcareUrl; 
        let transformations = '';
        if (options?.sharpness && options.sharpness > 0 && options.sharpness <= 20) {
            transformations += `-/sharp/${options.sharpness}/`;
            wasProcessedByUploadcare = true; 
        }
        if (transformations) {
            urlToLoad += transformations; 
        }
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      resolve({ img }); 
    };
    img.onerror = (_event) => {
      let errorMessage = `Image load failed for ${urlToLoad}.`;
      if (wasProcessedByUploadcare) {
        errorMessage += ` (Original URL: ${originalUrl}, processed URL for loading: ${urlToLoad}).`;
      }
      errorMessage += ` This could be due to a network issue, an invalid image URL, or a Cross-Origin Resource Sharing (CORS) restriction.`;
      reject(new Error(errorMessage));
    };
    img.src = urlToLoad;
  });
};

const getDefaultCrop = (imgWidth: number, imgHeight: number): Area => {
  const size = Math.min(imgWidth, imgHeight);
  return {
    x: (imgWidth - size) / 2,
    y: (imgHeight - size) / 2,
    width: size,
    height: size,
  };
};

export const generateClientSidePackage = async (params: GeneratePackageParams): Promise<ProcessedPackageResult> => {
  const { orderedSelectedImageUrls, imageEditStates, overlay, targetWidth, targetHeight } = params;
  
  const successfulImages: string[] = [];
  const failedImageOriginalUrls: string[] = [];
  const imageAnalysisPostGeneration: { [originalUrl: string]: ImageAnalysisResult } = {};


  for (let i = 0; i < orderedSelectedImageUrls.length; i++) {
    const originalUrl = orderedSelectedImageUrls[i];
    const editState: ImageEditState | undefined = imageEditStates[originalUrl];
    const isLastImage = i === orderedSelectedImageUrls.length - 1;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error(`Failed to get canvas context for image ${originalUrl}.`);
      failedImageOriginalUrls.push(originalUrl);
      imageAnalysisPostGeneration[originalUrl] = { hasSignificantStrips: undefined, isPotentiallyLowResolution: undefined }; 
      const errorCanvas = document.createElement('canvas');
      errorCanvas.width = targetWidth; errorCanvas.height = targetHeight;
      const errorCtx = errorCanvas.getContext('2d');
      if(errorCtx){
          errorCtx.fillStyle = 'lightgray'; errorCtx.fillRect(0,0,targetWidth,targetHeight);
          errorCtx.fillStyle = 'red'; errorCtx.textAlign = 'center'; errorCtx.font = 'bold 16px Arial';
          errorCtx.fillText('Context Error', targetWidth/2, targetHeight/2 -10);
          const dn = originalUrl.substring(originalUrl.lastIndexOf('/') + 1).substring(0,25);
          errorCtx.fillText(dn, targetWidth/2, targetHeight/2 + 10);
          successfulImages.push(errorCanvas.toDataURL('image/png'));
      } else { successfulImages.push(''); }
      continue;
    }

    try {
      ctx.fillStyle = 'white'; 
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const loadImageOpts: LoadImageOptions = { sharpness: editState?.sharpness };
      const { img: mainImage } = await loadImage(originalUrl, loadImageOpts); 
      
      imageAnalysisPostGeneration[originalUrl] = { 
        hasSignificantStrips: !!editState?.croppedAreaPixels ? false : undefined, // if edited, strips are assumed handled
        isPotentiallyLowResolution: undefined // Not re-checked here, relies on initial analysis
      };

      let sourceRect: Area;

      if (editState?.croppedAreaPixels) {
        sourceRect = editState.croppedAreaPixels;
      } else {
        sourceRect = getDefaultCrop(mainImage.naturalWidth, mainImage.naturalHeight);
      }
        
      ctx.drawImage(
        mainImage,
        sourceRect.x,
        sourceRect.y,
        sourceRect.width,
        sourceRect.height,
        0,
        0,
        targetWidth,
        targetHeight
      );
      
      if (i === 0 && overlay) {
        let overlayUrlToLoad: string | undefined = undefined;
        let brandingType: string = '';

        if (overlay.agent?.overlayImage) {
          overlayUrlToLoad = overlay.agent.overlayImage;
          brandingType = 'agent';
        } else if (overlay.team?.overlayLogo) { 
          overlayUrlToLoad = overlay.team.overlayLogo;
          brandingType = 'team';
        }

        if (overlayUrlToLoad) {
          try {
            const { img: brandingOverlayImage } = await loadImage(overlayUrlToLoad); 
            ctx.drawImage(brandingOverlayImage, 0, 0, targetWidth, targetHeight);
          } catch (e) { 
            console.error(`Failed to load/draw ${brandingType} overlay image (${overlayUrlToLoad}):`, e);
          }
        }
      }

      if (isLastImage) {
        try {
          const { img: fixedLastImageOverlay } = await loadImage(LAST_IMAGE_OVERLAY_URL); 
          ctx.drawImage(fixedLastImageOverlay, 0, 0, targetWidth, targetHeight);
        } catch (e) {
          console.error(`[Last Image Overlay] Failed to load/draw last image overlay (${LAST_IMAGE_OVERLAY_URL}):`, e);
        }
      }
      successfulImages.push(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error(`Error processing image ${originalUrl}:`, err);
      failedImageOriginalUrls.push(originalUrl);
      imageAnalysisPostGeneration[originalUrl] = { 
        ...imageAnalysisPostGeneration[originalUrl], 
        hasSignificantStrips: undefined, // Undetermined if error
        isPotentiallyLowResolution: undefined // Undetermined if error
      }; 

      ctx.fillStyle = 'lightgray';
      ctx.fillRect(0,0,targetWidth,targetHeight);
      ctx.fillStyle = 'red';
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('Error Processing Image', targetWidth/2, targetHeight/2 -10);
      
      ctx.font = '12px Arial';
      let textToDisplay = originalUrl.substring(originalUrl.lastIndexOf('/') + 1);
      if (textToDisplay.length > 25) {
        textToDisplay = textToDisplay.substring(0,25) + "...";
      }
      ctx.fillText(textToDisplay, targetWidth/2, targetHeight/2 + 10);
      successfulImages.push(canvas.toDataURL('image/png'));
    }
  }
  return { successfulImages, failedImageOriginalUrls, imageAnalysis: imageAnalysisPostGeneration };
};