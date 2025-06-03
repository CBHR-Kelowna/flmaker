
import React, { useState, useEffect, useCallback } from 'react';
import type { UserProfile, Listing, Agent, Team, ImageEditState, Area, Point, GeneratePackageParams, ImageAnalysisResult, ProcessedPackageResult } from '../../types';
import type { User as FirebaseUser } from 'firebase/auth'; // Ensured User type import, aliased for consistency

import { SearchBar } from '../SearchBar';
import { PropertyDetails } from '../PropertyDetails';
import { PhotoGallery } from '../PhotoGallery';
import { AgentTeamSelector } from '../AgentTeamSelector';
import { PackagePreview } from '../PackagePreview';
import { ImageEditorModal } from '../ImageEditorModal';
import { InstagramDescriptionModal } from '../InstagramDescriptionModal';
import { LoadingIcon } from '../icons/LoadingIcon';
import { Button } from '../Button';
import { SparklesIcon } from '../icons/SparklesIcon';

import { fetchListing as apiFetchListing } from '../../services/listingService';
import { fetchAgents as apiFetchAgents, fetchTeams as apiFetchTeams } from '../../services/assetService';
import { generateClientSidePackage, analyzeImageDimensionsAndStrips } from '../../services/imageProcessingService';

const MAX_IMAGE_SELECTIONS = 10;
const TARGET_DIMENSION = 1080;
const IMAGE_URL_REGEX = /\.(jpeg|jpg|gif|png|webp)$/i;
const AUTO_ADJUST_ZOOM = 1.17;

const calculateDefaultCrop = (imgWidth: number, imgHeight: number): Area => {
  const size = Math.min(imgWidth, imgHeight);
  return {
    x: (imgWidth - size) / 2,
    y: (imgHeight - size) / 2,
    width: size,
    height: size,
  };
};

interface CreateListingPageProps {
  currentUser: FirebaseUser; // Use aliased type
  userProfile: UserProfile | null; // Can be null if still loading or error
  mlsIdFromUrl?: string;
}

export const CreateListingPage: React.FC<CreateListingPageProps> = ({ currentUser, userProfile, mlsIdFromUrl }) => {
  const [mlsIdInput, setMlsIdInput] = useState<string>(mlsIdFromUrl || '');
  const [currentMlsIdSearched, setCurrentMlsIdSearched] = useState<string>('');
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoadingListing, setIsLoadingListing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const [selectedOriginalImageUrls, setSelectedOriginalImageUrls] = useState<string[]>([]);
  const [imageEditStates, setImageEditStates] = useState<{ [url: string]: ImageEditState }>({});
  
  const [initialImageAnalyses, setInitialImageAnalyses] = useState<{ [url: string]: ImageAnalysisResult }>({});
  const [isAnalyzingPhotos, setIsAnalyzingPhotos] = useState<boolean>(false);

  const [editingImage, setEditingImage] = useState<{ url: string; aspect: number } | null>(null);

  const [processedImagePackage, setProcessedImagePackage] = useState<string[] | null>(null);
  const [isGeneratingPackage, setIsGeneratingPackage] = useState<boolean>(false);

  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState<boolean>(false);

  // Auto-search if mlsIdFromUrl is present on mount
  useEffect(() => {
    if (mlsIdFromUrl) {
      handleSearch(mlsIdFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mlsIdFromUrl]);


  useEffect(() => {
    if (!currentUser) return; 

    const loadAssets = async () => {
      try {
        setError(null); 
        const [agentsData, teamsData] = await Promise.all([apiFetchAgents(), apiFetchTeams()]);
        setAgents(agentsData);
        setTeams(teamsData);
      } catch (err: any) {
        setError(err.message || 'Failed to load agent/team data. Please try refreshing.');
        console.error(err);
      }
    };
    loadAssets();
  }, [currentUser]); 

  const performInitialImageAnalysis = async (photoUrls: string[]) => {
    if (photoUrls.length === 0) return;
    setIsAnalyzingPhotos(true);
    setInitialImageAnalyses({}); 

    const analyses: { [url: string]: ImageAnalysisResult } = {};
    for (const url of photoUrls) {
      try {
        const result = await analyzeImageDimensionsAndStrips(url);
        analyses[url] = result;
      } catch (e) {
        console.warn(`Failed to analyze image ${url} during initial scan:`, e);
        analyses[url] = { hasSignificantStrips: undefined, isPotentiallyLowResolution: undefined, naturalWidth: undefined, naturalHeight: undefined }; 
      }
      setInitialImageAnalyses(prev => ({ ...prev, [url]: analyses[url] }));
    }
    setIsAnalyzingPhotos(false);
  };

  const handleSearch = useCallback(async (mlsId: string) => {
    if (!mlsId || !currentUser) return;
    setIsLoadingListing(true);
    setError(null);
    setListing(null);
    setSelectedOriginalImageUrls([]);
    setImageEditStates({}); 
    setProcessedImagePackage(null);
    setInitialImageAnalyses({}); 
    setCurrentMlsIdSearched(mlsId.trim());
    try {
      const fetchedListing = await apiFetchListing(mlsId.trim());
      setListing(fetchedListing);
      if (fetchedListing?.PhotoGallery) {
        const urls = fetchedListing.PhotoGallery.split(' ').filter(u => u.trim() !== '' && IMAGE_URL_REGEX.test(u));
        performInitialImageAnalysis(urls);
      }
    } catch (err: any) {
      setError((err as Error).message || 'Failed to fetch listing.');
      if (err.message && (err.message.includes('401') || err.message.includes('403'))) {
        setError(`Authentication failed or session expired. Please try logging out and in again. (${err.message})`);
      }
      setListing(null);
    } finally {
      setIsLoadingListing(false);
    }
  }, [currentUser]);

  const handleImageSelect = (url: string) => {
    setSelectedOriginalImageUrls((prevSelected: string[]) => {
      if (prevSelected.includes(url)) {
        return prevSelected.filter((u: string) => u !== url);
      }
      if (prevSelected.length < MAX_IMAGE_SELECTIONS) {
        return [...prevSelected, url];
      }
      return prevSelected;
    });
  };

  const handleOpenImageEditor = (url: string) => {
    setEditingImage({ url, aspect: 1 });
  };

  const handleCloseImageEditor = () => {
    setEditingImage(null);
  };

  const handleSaveImageCrop = (url: string, crop: Point, zoom: number, croppedAreaPixels: Area, sharpness?: number, autoAdjusted?: boolean) => {
    setImageEditStates((prevStates: { [url: string]: ImageEditState }) => ({
      ...prevStates,
      [url]: { crop, zoom, croppedAreaPixels, sharpness, autoAdjusted },
    }));
    setInitialImageAnalyses(prev => ({
      ...prev,
      [url]: { ...prev[url], hasSignificantStrips: false, isPotentiallyLowResolution: false } 
    }));
    setEditingImage(null); 
  };

  const handleAutoAdjustAndSaveImage = (url: string) => {
    const analysis = initialImageAnalyses[url];
    if (!analysis || typeof analysis.naturalWidth !== 'number' || typeof analysis.naturalHeight !== 'number') {
      console.warn(`Auto-adjust: Missing dimensions for ${url}. Opening manual editor as fallback.`);
      handleOpenImageEditor(url);
      return;
    }

    const { naturalWidth, naturalHeight } = analysis;
    const initialVisibleCropArea = calculateDefaultCrop(naturalWidth, naturalHeight);
    const finalCroppedAreaPixelsWidth = initialVisibleCropArea.width / AUTO_ADJUST_ZOOM;
    const finalCroppedAreaPixelsHeight = initialVisibleCropArea.height / AUTO_ADJUST_ZOOM;
    const finalCroppedAreaPixelsX = initialVisibleCropArea.x + (initialVisibleCropArea.width - finalCroppedAreaPixelsWidth) / 2;
    const finalCroppedAreaPixelsY = initialVisibleCropArea.y + (initialVisibleCropArea.height - finalCroppedAreaPixelsHeight) / 2;

    const finalCroppedAreaPixels: Area = {
        x: finalCroppedAreaPixelsX,
        y: finalCroppedAreaPixelsY,
        width: finalCroppedAreaPixelsWidth,
        height: finalCroppedAreaPixelsHeight,
    };
    const defaultCropPoint: Point = { x: 0, y: 0 };
    handleSaveImageCrop(url, defaultCropPoint, AUTO_ADJUST_ZOOM, finalCroppedAreaPixels, undefined, true);
  };
  
  const handleGeneratePackage = async () => {
    setError(null); 
    if (selectedOriginalImageUrls.length === 0) {
      setError("Please select at least one image.");
      return;
    }
    if (!selectedAgentId && !selectedTeamId) {
      setError("Branding is required. Please select an Agent or a Team.");
      return;
    }
    setIsGeneratingPackage(true);
    setProcessedImagePackage(null);
    let brandingOverlay: { agent?: Agent; team?: Team; } | undefined = undefined;
    if (selectedAgentId) {
        const agent = agents.find((a: Agent) => a.id === selectedAgentId);
        if (agent) brandingOverlay = { agent };
    } else if (selectedTeamId) { 
        const team = teams.find((t: Team) => t.id === selectedTeamId);
        if (team) brandingOverlay = { team };
    }
    const params: GeneratePackageParams = {
      orderedSelectedImageUrls: selectedOriginalImageUrls,
      imageEditStates, 
      overlay: brandingOverlay,
      targetWidth: TARGET_DIMENSION,
      targetHeight: TARGET_DIMENSION,
    };
    try {
      const result: ProcessedPackageResult = await generateClientSidePackage(params);
      setProcessedImagePackage(result.successfulImages);
      if (result.failedImageOriginalUrls.length > 0) {
        const failedCount = result.failedImageOriginalUrls.length;
        setError(`Warning: ${failedCount} image${failedCount === 1 ? "" : "s"} could not be processed. Placeholders used.`);
      }
    } catch (err) { 
      console.error("Package generation failed unexpectedly:", err);
      setError((err as Error).message || "Failed to generate image package.");
    } finally {
      setIsGeneratingPackage(false);
    }
  };

  const photoUrls = listing?.PhotoGallery 
    ? listing.PhotoGallery.split(' ')
        .filter((url: string) => url.trim() !== '' && IMAGE_URL_REGEX.test(url))
    : [];
  const canGenerate = selectedOriginalImageUrls.length > 0 && (!!selectedAgentId || !!selectedTeamId);
  
  const selectedAgentForInsta = agents.find(agent => agent.id === selectedAgentId);
  const agentNameForInsta = selectedAgentForInsta ? selectedAgentForInsta.name : (listing?.ListAgentKey ? "Listing Agent" : (userProfile?.displayName || "Our Team"));


  return (
    <div className="space-y-8">
        <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="search-heading-create">
          <h2 id="search-heading-create" className="text-2xl font-semibold text-slate-700 mb-4">1. Find Listing by MLS®</h2>
          <SearchBar onSearch={handleSearch} isLoading={isLoadingListing} initialValue={mlsIdInput} setInitialValue={setMlsIdInput} />
        </section>

        {isLoadingListing && (
          <div className="flex justify-center items-center py-10" aria-live="polite">
            <LoadingIcon className="w-12 h-12 text-sky-600 animate-spin" />
            <p className="ml-4 text-slate-600">Fetching listing data...</p>
          </div>
        )}
        {isAnalyzingPhotos && !isLoadingListing && (
             <div className="text-center py-2 text-slate-500 text-sm">
                Analyzing photo quality & dimensions...
             </div>
        )}

        {error && !isLoadingListing && (
          <div 
           className={`p-4 rounded-md shadow ${error.toLowerCase().startsWith('warning:') ? 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700' : 'bg-red-100 border-l-4 border-red-500 text-red-700'}`} 
           role="alert"
          >
            <p className="font-bold">{error.toLowerCase().startsWith('warning:') ? 'Warning' : 'Error'}</p>
            <p>{error.toLowerCase().startsWith('warning:') ? error.substring(error.indexOf(':') + 1).trim() : error}</p>
          </div>
        )}
        
        {listing && !isLoadingListing && (
          <>
            <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="property-info-heading-create">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 id="property-info-heading-create" className="text-2xl font-semibold text-slate-700">2. Property Information</h2>
                <Button 
                  onClick={() => setIsInstagramModalOpen(true)} 
                  variant="ghost" 
                  size="medium"
                  className="mt-3 sm:mt-0"
                  aria-label="Generate Instagram post description"
                >
                  <SparklesIcon className="w-5 h-5 mr-2 text-yellow-500" />
                  Generate Instagram Post
                </Button>
              </div>
              <PropertyDetails listing={listing} />
            </section>

            <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="select-photos-heading-create">
              <h2 id="select-photos-heading-create" className="text-2xl font-semibold text-slate-700 mb-2">3. Select Photos (up to {MAX_IMAGE_SELECTIONS})</h2>
              <p className="text-sm text-slate-500 mb-4">
                Selected: {selectedOriginalImageUrls.length} / {MAX_IMAGE_SELECTIONS}. First image gets branding. 
                Images with "⚠️" may need review. Use 'Edit Image' (may auto-adjust).
              </p>
              <PhotoGallery
                photos={photoUrls}
                selectedImages={selectedOriginalImageUrls} 
                imageEditStates={imageEditStates}
                initialImageAnalyses={initialImageAnalyses}
                onImageSelect={handleImageSelect}
                onImageEdit={handleOpenImageEditor}
                onImageAutoAdjust={handleAutoAdjustAndSaveImage}
                maxSelections={MAX_IMAGE_SELECTIONS}
              />
            </section>

            <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="branding-heading-create">
              <h2 id="branding-heading-create" className="text-2xl font-semibold text-slate-700 mb-4">4. Add Branding (Required)</h2>
              <AgentTeamSelector
                agents={agents}
                teams={teams}
                selectedAgentId={selectedAgentId}
                selectedTeamId={selectedTeamId}
                onAgentChange={setSelectedAgentId}
                onTeamChange={setSelectedTeamId}
              />
            </section>

            <section className="text-center py-6">
              <Button
                onClick={handleGeneratePackage}
                disabled={isGeneratingPackage || !canGenerate}
                variant="primary"
                size="large"
                aria-label="Generate social media image package"
                title={!canGenerate ? "Please select images and branding." : ""}
              >
                {isGeneratingPackage ? (
                  <>
                    <LoadingIcon className="w-5 h-5 mr-2 animate-spin" />
                    Generating Package...
                  </>
                ) : "Generate Social Media Package"}
              </Button>
               {isAnalyzingPhotos && (
                 <p className="text-xs text-slate-500 mt-2">Photo analysis in progress...</p>
              )}
            </section>

            {isGeneratingPackage && !processedImagePackage && ( 
              <div className="flex justify-center items-center py-10" aria-live="polite">
                <LoadingIcon className="w-12 h-12 text-sky-600 animate-spin" />
                <p className="ml-4 text-slate-600">Processing images...</p>
              </div>
            )}

            {processedImagePackage && processedImagePackage.length > 0 && (
              <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="package-preview-heading-create">
                <h2 id="package-preview-heading-create" className="text-2xl font-semibold text-slate-700 mb-4">5. Your Social Media Package</h2>
                <PackagePreview 
                    images={processedImagePackage} 
                    mlsId={currentMlsIdSearched} 
                />
              </section>
            )}
          </>
        )}

      {editingImage && (
        <ImageEditorModal
          isOpen={!!editingImage}
          onClose={handleCloseImageEditor}
          imageSrc={editingImage.url}
          aspect={editingImage.aspect}
          onSave={handleSaveImageCrop}
          initialState={imageEditStates[editingImage.url]}
          originalImageHasProblematicAspectRatio={initialImageAnalyses[editingImage.url]?.hasSignificantStrips}
          isPotentiallyLowResolution={initialImageAnalyses[editingImage.url]?.isPotentiallyLowResolution}
        />
      )}

      {isInstagramModalOpen && listing && (
        <InstagramDescriptionModal
          isOpen={isInstagramModalOpen}
          onClose={() => setIsInstagramModalOpen(false)}
          listing={listing}
          agentName={agentNameForInsta}
        />
      )}
    </div>
  );
};