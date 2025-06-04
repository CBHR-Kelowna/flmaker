
import React, { useState, useEffect } from 'react';
import type { Listing } from '../types';
import { Button } from './Button';
import { LoadingIcon } from './icons/LoadingIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ClipboardDocumentIcon } from './icons/ClipboardDocumentIcon';
import { SparklesIcon } from './icons/SparklesIcon'; // Assuming you have this or similar
import { generateInstagramPostDescription } from '../services/aiService';

interface InstagramDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing | null;
  agentName: string | null;
}

export const InstagramDescriptionModal: React.FC<InstagramDescriptionModalProps> = ({
  isOpen,
  onClose,
  listing,
  agentName,
}) => {
  const [description, setDescription] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    // Reset state when modal opens with a new listing or closes
    if (isOpen) {
      setDescription('');
      setError(null);
      setIsCopied(false);
      // Optionally, auto-generate when opened if listing is present
      // if (listing) handleGenerateDescription(); 
    }
  }, [isOpen, listing]);

  const handleGenerateDescription = async () => {
    if (!listing) {
      setError("No listing data available to generate description.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setDescription('');
    setIsCopied(false);

    try {
      const result = await generateInstagramPostDescription(listing, agentName);
      setDescription(result);
    } catch (err) {
      setError((err as Error).message || "An unknown error occurred during generation.");
      console.error("Instagram Description Generation Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (description) {
      navigator.clipboard.writeText(description).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
      }).catch(err => {
        console.error("Failed to copy text: ", err);
        setError("Failed to copy description to clipboard.");
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="instaModalTitle">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h3 id="instaModalTitle" className="text-xl font-semibold text-slate-700">Instagram Post Description</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close modal">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {!description && !isLoading && !error && (
             <div className="text-center">
                <p className="text-slate-600 mb-4">
                    Generate an engaging Instagram post for this listing using AI.
                </p>
             </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-600">
              <LoadingIcon className="w-10 h-10 mb-3 animate-spin text-sky-600" />
              <p>Generating description...</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md" role="alert">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {description && !isLoading && (
            <div>
              <label htmlFor="instagramDescription" className="block text-sm font-medium text-slate-700 mb-1">
                Generated Description:
              </label>
              <textarea
                id="instagramDescription"
                readOnly
                value={description}
                className="w-full h-64 p-2 border border-slate-300 rounded-md bg-slate-50 whitespace-pre-wrap text-sm"
                aria-label="Generated Instagram description"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end items-center p-4 border-t border-slate-200 space-y-2 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={handleGenerateDescription} 
            variant="secondary"
            size="medium"
            disabled={isLoading || !listing}
            className="w-full sm:w-auto"
            title={!listing ? "Listing data not available" : "Generate new description"}
          >
            <SparklesIcon className="w-5 h-5 mr-2" />
            {description ? 'Regenerate' : 'Generate Description'}
          </Button>
          {description && !isLoading && (
            <Button 
                onClick={handleCopyToClipboard} 
                variant="primary" 
                size="medium"
                disabled={isLoading}
                className="w-full sm:w-auto"
            >
              <ClipboardDocumentIcon className="w-5 h-5 mr-2" />
              {isCopied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
          )}
          <Button onClick={onClose} variant="ghost" size="medium" className="w-full sm:w-auto">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
