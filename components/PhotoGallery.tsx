

import React from 'react';
import type { ImageEditState, ImageAnalysisResult } from '../types';
import { PhotoIcon } from './icons/PhotoIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

interface PhotoGalleryProps {
  photos: string[];
  selectedImages: string[];
  imageEditStates: { [url: string]: ImageEditState };
  initialImageAnalyses?: { [url: string]: ImageAnalysisResult };
  onImageSelect: (url: string) => void;
  onImageEdit: (url: string) => void; // For manual edit
  onImageAutoAdjust: (url: string) => void; // For automatic adjustment
  maxSelections: number;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  selectedImages,
  imageEditStates,
  initialImageAnalyses,
  onImageSelect,
  onImageEdit,
  onImageAutoAdjust,
  maxSelections
}) => {
  if (photos.length === 0) {
    return <p className="text-slate-500">No photos available for this listing.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {photos.map((url: string, index: number) => {
        const isSelected = selectedImages.includes(url);
        const isDisabled = !isSelected && selectedImages.length >= maxSelections;
        const selectionOrder = isSelected ? selectedImages.indexOf(url) + 1 : 0;
        
        const analysis = initialImageAnalyses?.[url];
        const editState = imageEditStates[url];

        // Note: hasSignificantStrips and isPotentiallyLowResolution in initialImageAnalyses are cleared 
        // by handleSaveImageCrop in App.tsx after an edit or auto-adjust.
        const showShapeWarning = analysis?.hasSignificantStrips === true && !editState?.croppedAreaPixels;
        const showLowResolutionWarning = analysis?.isPotentiallyLowResolution === true && !editState?.croppedAreaPixels;
        
        let warningText = "";
        let warningTitle = "";

        if (showShapeWarning && showLowResolutionWarning) {
            warningText = "Shape & Low Res?";
            warningTitle = "Image dimensions are not square and its original resolution is low. Review shape, strips, and potential quality loss for 1:1 format. Use 'Edit Image' (will auto-adjust shape).";
        } else if (showShapeWarning) {
            warningText = "Adjust Shape";
            warningTitle = "This image's dimensions are not square. It might include added borders or require significant cropping for a 1:1 post. Use 'Edit Image' to select the best 1:1 content (will auto-adjust shape).";
        } else if (showLowResolutionWarning) {
            warningText = "Low Res?";
            warningTitle = "This image's original dimensions are small. Upscaling to 1080x1080 may reduce quality. Use 'Edit Image' to assess (manual edit).";
        }
        
        const hasBeenEditedOrAdjusted = editState?.croppedAreaPixels !== null && editState?.croppedAreaPixels !== undefined;
        const wasAutoAdjusted = editState?.autoAdjusted === true;

        let tagTextToShow = "";
        let tagColorClass = "";
        let tagTitleAttribute = "";

        if (wasAutoAdjusted) {
            tagTextToShow = "Auto-Adjusted";
            tagColorClass = "bg-green-500 text-white";
            tagTitleAttribute = "Image automatically adjusted for optimal 1:1 display.";
        } else if (hasBeenEditedOrAdjusted) { // Manually edited
            tagTextToShow = "Edited";
            tagColorClass = "bg-green-500 text-white";
            tagTitleAttribute = "Custom crop applied.";
        } else if (warningText) { // Not edited, but has warning
            tagTextToShow = warningText;
            tagColorClass = "bg-yellow-400 text-yellow-800";
            tagTitleAttribute = warningTitle;
        }
        
        const ariaLabelDetails = [
          `Select image ${index + 1}`,
          isSelected ? `, selected as number ${selectionOrder}` : '',
          tagTextToShow ? `, status: ${tagTextToShow}` : '',
          tagTitleAttribute ? `, details: ${tagTitleAttribute.toLowerCase()}` : ''
        ].join('');
        
        const editButtonAriaLabel = `Edit image ${index + 1}${showShapeWarning ? ' (will attempt auto-adjustment for shape)' : (showLowResolutionWarning ? ' (manual edit for low resolution)' : '')}`;

        return (
          <div
            key={url + index}
            className={`relative group rounded-lg overflow-hidden border-4 
                        ${isSelected ? 'border-sky-500 shadow-xl' : 'border-transparent'} 
                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} 
                        transition-all duration-200 ease-in-out aspect-square`}
            onClick={() => !isDisabled && onImageSelect(url)}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if(!isDisabled) onImageSelect(url);
              }
            }}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            aria-pressed={isSelected}
            aria-label={ariaLabelDetails}
          >
            <img
              src={url}
              alt={`Listing photo ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => (e.currentTarget.src = 'https://picsum.photos/seed/placeholder/400/400')} // Fallback
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity duration-300 flex flex-col items-center justify-center">
              {isSelected && (
                <>
                  <div className="absolute top-2 left-2 bg-sky-600 bg-opacity-90 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold z-10" aria-hidden="true">
                    {selectionOrder}
                  </div>
                  <div className="absolute top-2 right-2 p-1 bg-sky-500 rounded-full text-white">
                    <CheckCircleIcon className="w-6 h-6" />
                  </div>
                </>
              )}
               {isSelected && (
                 <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => { 
                        e.stopPropagation(); 
                        if (showShapeWarning) { // Auto-adjust only if shape warning is present
                            onImageAutoAdjust(url);
                        } else { // Otherwise, (e.g. only low-res warning, or no warning) open manual editor
                            onImageEdit(url);
                        }
                    }}
                    className="absolute bottom-2 right-2 p-2 bg-white text-slate-700 rounded-full shadow-md hover:bg-slate-100 transition-colors"
                    aria-label={editButtonAriaLabel}
                  >
                    <PencilSquareIcon className="w-5 h-5" />
                  </button>
               )}
                {isSelected && tagTextToShow && (
                  <div 
                    className={`absolute bottom-2 left-2 p-1 text-xs px-2 rounded-full flex items-center ${tagColorClass}`}
                    title={tagTitleAttribute}
                  >
                    {(!hasBeenEditedOrAdjusted && (showShapeWarning || showLowResolutionWarning)) && <ExclamationTriangleIcon className="w-3 h-3 mr-1" />}
                    {tagTextToShow}
                  </div>
                )}
            </div>
            {!isSelected && !isDisabled && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                 <div className="p-2 bg-white bg-opacity-80 rounded-md text-slate-700 text-sm">Select Image</div>
              </div>
            )}
             {isDisabled && (
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="p-2 bg-black bg-opacity-60 rounded-md text-white text-xs">Max selection reached</div>
              </div>
            )}
          </div>
        );
      })}
       {photos.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center text-slate-500 py-10">
            <PhotoIcon className="w-16 h-16 mb-4 text-slate-400" />
            <p>No photos found for this listing.</p>
        </div>
      )}
    </div>
  );
};
