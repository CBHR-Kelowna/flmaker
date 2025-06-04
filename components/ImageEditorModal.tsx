import React, { useState, useCallback } from 'react';
import { default as Cropper } from 'react-easy-crop'; // Changed import
import type { Point, Area, ImageEditState } from '../types.js'; // Assuming these types are correctly defined
import { Button } from './Button.js';
import { XMarkIcon } from './icons/XMarkIcon.js';
import { CheckIcon } from './icons/CheckIcon.js';
import { ArrowPathIcon } from './icons/ArrowPathIcon.js'; // For reset
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon.js';


interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  aspect: number;
  onSave: (url: string, crop: Point, zoom: number, croppedAreaPixels: Area, sharpness?: number) => void;
  initialState?: ImageEditState;
  originalImageHasProblematicAspectRatio?: boolean;
  isPotentiallyLowResolution?: boolean;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  aspect,
  onSave,
  initialState,
  originalImageHasProblematicAspectRatio,
  isPotentiallyLowResolution,
}) => {
  const [crop, setCrop] = useState<Point>(initialState?.crop || { x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(initialState?.zoom || 1);
  const [sharpness, setSharpness] = useState<number>(initialState?.sharpness || 0); // Default to 0 (no sharpening)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(initialState?.croppedAreaPixels || null);

  const onCropComplete = useCallback((_croppedArea: Area, currentCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(currentCroppedAreaPixels);
  }, []);

  const handleSave = () => {
    const sharpnessToSave = sharpness === 0 ? undefined : sharpness; // Don't save 0
    if (croppedAreaPixels) {
      onSave(imageSrc, crop, zoom, croppedAreaPixels, sharpnessToSave);
    } else {
      // Fallback if onCropComplete hasn't fired or if image loads very fast and user clicks save.
      // Try to create a default center crop based on image dimensions.
      const img = new Image();
      img.onload = () => {
        const { naturalWidth, naturalHeight } = img;
        const size = Math.min(naturalWidth, naturalHeight);
        const fallbackCroppedAreaPixels: Area = {
            x: (naturalWidth - size) / 2,
            y: (naturalHeight - size) / 2,
            width: size,
            height: size,
        };
        onSave(imageSrc, {x:0, y:0}, 1, fallbackCroppedAreaPixels, sharpnessToSave);
      };
      img.onerror = () => {
         // If image fails to load here (unlikely if it displayed in cropper), send null.
         // Consider if initial state's croppedAreaPixels should be used if available.
         console.error("Failed to load image for default crop calculation. CroppedAreaPixels will be null if not set previously.");
         onSave(imageSrc, crop, zoom, initialState?.croppedAreaPixels || (null as any), sharpnessToSave);
      }
      img.src = imageSrc;
    }
  };
  
  const handleReset = () => {
    setCrop(initialState?.crop || { x: 0, y: 0 });
    setZoom(initialState?.zoom || 1);
    setSharpness(initialState?.sharpness || 0);
    setCroppedAreaPixels(initialState?.croppedAreaPixels || null); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-700">Edit Image (1080x1080)</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close image editor">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="relative flex-grow p-1 bg-slate-200 min-h-[300px] sm:min-h-[400px] md:min-h-[500px]">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              cropShape="rect"
              showGrid={true}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">Image loading or not available.</div>
          )}
        </div>
        
        <div className="p-4 space-y-3">
            {originalImageHasProblematicAspectRatio && (
              <div className="p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-yellow-600" />
                  <p className="font-semibold">Review Image Shape</p>
                </div>
                <p className="text-sm mt-1">
                  This image's file dimensions are not perfectly square. This could be due to its original shape or because borders (like white strips) were added by the image source.
                  Please adjust the crop carefully to select the best 1:1 content area, ensuring important details are included and unwanted strips are removed.
                </p>
              </div>
            )}
            {isPotentiallyLowResolution && (
              <div className="p-3 bg-amber-100 border-l-4 border-amber-500 text-amber-700 rounded-md">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-amber-600" />
                  <p className="font-semibold">Review Image Resolution</p>
                </div>
                <p className="text-sm mt-1">
                  This image's original dimensions are small. Upscaling it to 1080x1080 for the social media post may result in reduced quality or blurriness.
                  Review the preview carefully. If a higher resolution version of this photo is available, consider using that. Otherwise, adjust the crop and sharpness to achieve the best possible result.
                </p>
              </div>
            )}
            <div className="flex items-center space-x-3">
                <label htmlFor="zoom" className="text-sm font-medium text-slate-700 w-16">Zoom:</label>
                <input
                    id="zoom"
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.01}
                    aria-label="Zoom image"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setZoom(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
                <span className="text-sm text-slate-600 w-10 text-right">{zoom.toFixed(2)}</span>
            </div>
            <div className="flex items-center space-x-3">
                <label htmlFor="sharpness" className="text-sm font-medium text-slate-700 w-16">Sharpness:</label>
                <input
                    id="sharpness"
                    type="range"
                    value={sharpness}
                    min={0} // 0 means no sharpening
                    max={20}
                    step={1}
                    aria-label="Adjust image sharpness"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSharpness(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
                <span className="text-sm text-slate-600 w-10 text-right">{sharpness}</span>
            </div>
             <p className="text-xs text-slate-500 italic">
                Note: Sharpness effect is applied during final package generation and not live previewed here.
            </p>
        </div>

        <div className="flex justify-end items-center p-4 border-t border-slate-200 space-x-3">
          <Button onClick={handleReset} variant="secondary" size="medium" aria-label="Reset crop and sharpness settings">
            <ArrowPathIcon className="w-5 h-5 mr-1" /> Reset
          </Button>
          <Button onClick={onClose} variant="secondary" size="medium">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="primary" size="medium" disabled={!croppedAreaPixels && !initialState?.croppedAreaPixels} aria-label="Save crop and sharpness settings">
            <CheckIcon className="w-5 h-5 mr-1" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
};