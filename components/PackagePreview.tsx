import React, { useState } from 'react'; // Added useState
import JSZip from 'jszip';
import saveAs from 'file-saver'; 
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon.js';
import { ArchiveBoxArrowDownIcon } from './icons/ArchiveBoxArrowDownIcon.js'; 
import { Button } from './Button.js';
import { LoadingIcon } from './icons/LoadingIcon.js';


interface PackagePreviewProps {
  images: string[]; 
  mlsId?: string; 
}

export const PackagePreview: React.FC<PackagePreviewProps> = ({ images, mlsId }) => {
  const [isZipping, setIsZipping] = useState<boolean>(false);

  if (!images || images.length === 0) {
    return <p className="text-slate-500">No images generated yet.</p>;
  }

  const safeMlsId = mlsId || 'listing'; // Fallback for filename prefix

  const handleDownload = (dataUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${safeMlsId}_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllAsZip = async () => {
    if (isZipping) return;
    setIsZipping(true);

    const zip = new JSZip();
    images.forEach((dataUrl: string, index: number) => {
      const base64Data = dataUrl.split(',')[1];
      // Images inside ZIP are just numbered 1.png, 2.png, etc.
      zip.file(`${index + 1}.png`, base64Data, { base64: true });
    });

    try {
      const content = await zip.generateAsync({ type: "blob" });
      // ZIP file name is mlsnumber.zip
      saveAs(content, `${safeMlsId}.zip`);
    } catch (error) {
      console.error("Failed to generate zip file:", error);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-slate-600 text-center sm:text-left">
          Your social media package ({images.length} images, 1080x1080px). Click an image to download individually.
        </p>
        <Button 
          onClick={handleDownloadAllAsZip} 
          disabled={isZipping}
          variant="secondary"
          size="medium"
          aria-label="Download all images as a ZIP file"
        >
          {isZipping ? (
            <>
              <LoadingIcon className="w-5 h-5 mr-2 animate-spin" />
              Zipping...
            </>
          ) : (
            <>
              <ArchiveBoxArrowDownIcon className="w-5 h-5 mr-2" />
              Download All as ZIP
            </>
          )}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((dataUrl: string, index: number) => (
          <div key={index} className="group relative border border-slate-300 rounded-lg overflow-hidden shadow-sm aspect-square">
            <img 
              src={dataUrl} 
              alt={`Generated social media image ${index + 1}`} 
              className="w-full h-full object-contain bg-white"
            />
            <div 
              className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity duration-300 flex items-center justify-center cursor-pointer"
              onClick={() => handleDownload(dataUrl, index)}
              onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleDownload(dataUrl, index);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Download image ${index + 1}`}
            >
              <div className="p-3 bg-white text-sky-600 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300">
                <ArrowDownTrayIcon className="w-8 h-8" />
              </div>
            </div>
             <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
              Image {index + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};