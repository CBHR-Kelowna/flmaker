

import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext'; // Import useAuth
import { AuthPage } from './components/auth/AuthPage'; // Import AuthPage

import { SearchBar } from './components/SearchBar';
import { PropertyDetails } from './components/PropertyDetails';
import { PhotoGallery } from './components/PhotoGallery';
import { AgentTeamSelector } from './components/AgentTeamSelector';
import { PackagePreview } from './components/PackagePreview';
import { ImageEditorModal } from './components/ImageEditorModal';
import { InstagramDescriptionModal } from './components/InstagramDescriptionModal';
import { LoadingIcon } from './components/icons/LoadingIcon';
import { Button } from './components/Button';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { UserCircleIcon } from './components/icons/UserCircleIcon'; // New Icon
import { ArrowLeftOnRectangleIcon } from './components/icons/ArrowLeftOnRectangleIcon'; // New Icon
import { fetchListing as apiFetchListing } from './services/listingService';
import { fetchAgents as apiFetchAgents, fetchTeams as apiFetchTeams } from './services/assetService';
import { generateClientSidePackage, analyzeImageDimensionsAndStrips } from './services/imageProcessingService';
import type { Listing, Agent, Team, ImageEditState, Area, Point, GeneratePackageParams, ImageAnalysisResult, ProcessedPackageResult } from './types';

const MAX_IMAGE_SELECTIONS = 10;
const TARGET_DIMENSION = 1080;
const IMAGE_URL_REGEX = /\.(jpeg|jpg|gif|png|webp)$/i;
const AUTO_ADJUST_ZOOM = 1.17;

// Utility function to calculate default crop (center 1:1)
const calculateDefaultCrop = (imgWidth: number, imgHeight: number): Area => {
  const size = Math.min(imgWidth, imgHeight);
  return {
    x: (imgWidth - size) / 2,
    y: (imgHeight - size) / 2,
    width: size,
    height: size,
  };
};


const App: React.FC = () => {
  const { currentUser, loading: authLoading, logout, error: authError } = useAuth(); // Use Firebase auth state

  const [mlsIdInput, setMlsIdInput] = useState<string>('');
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

  useEffect(() => {
    if (authError) {
      setError(`Authentication Error: ${authError}`);
    }
  }, [authError]);

  useEffect(() => {
    if (!currentUser) return; // Don't load assets if user is not logged in

    const loadAssets = async () => {
      try {
        setError(null); // Clear previous errors
        const [agentsData, teamsData] = await Promise.all([apiFetchAgents(), apiFetchTeams()]);
        setAgents(agentsData);
        setTeams(teamsData);
      } catch (err: any) {
        setError(err.message || 'Failed to load agent/team data. Please try refreshing.');
        console.error(err);
      }
    };
    loadAssets();
  }, [currentUser]); // Reload assets if user changes (e.g., logs in)

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

  const handleSearch = async (mlsId: string) => {
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
  };

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
    // Clear analysis flags as the image has now been "handled" (either manually or auto-adjusted)
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
    
    // Calculate the initial 1:1 crop area (this is what's visible at zoom = 1)
    const initialVisibleCropArea = calculateDefaultCrop(naturalWidth, naturalHeight);

    // Calculate the final croppedAreaPixels based on the auto-zoom factor
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
    
    // Default crop point for react-easy-crop state (top-left of viewport)
    const defaultCropPoint: Point = { x: 0, y: 0 };

    console.log(`Auto-adjusting image ${url} with zoom ${AUTO_ADJUST_ZOOM}. Final CroppedAreaPixels:`, finalCroppedAreaPixels);
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
        const imageNoun = failedCount === 1 ? "image" : "images";
        setError(`Warning: ${failedCount} ${imageNoun} could not be processed. Placeholders used.`);
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
  const agentNameForInsta = selectedAgentForInsta ? selectedAgentForInsta.name : (listing?.ListAgentKey ? "Listing Agent" : "Our Team");

  // Handle Auth Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100">
        <LoadingIcon className="w-16 h-16 text-sky-600 animate-spin" />
        <p className="mt-4 text-slate-600 text-lg">Loading application...</p>
      </div>
    );
  }

  // If not authenticated, show AuthPage
  if (!currentUser) {
    return <AuthPage />;
  }

  // Authenticated User View
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div>
                <h1 className="text-4xl font-bold text-sky-700">Featured Listing Maker</h1>
                <p className="text-xl text-slate-600 mt-1">Coldwell Banker Horizon Realty</p>
            </div>
            <div className="flex items-center space-x-3">
                {currentUser.displayName && (
                  <span className="text-slate-700 hidden sm:flex items-center">
                    <UserCircleIcon className="w-6 h-6 mr-2 text-sky-600"/> 
                    {currentUser.displayName}
                  </span>
                )}
                 {!currentUser.displayName && currentUser.email && (
                  <span className="text-slate-700 hidden sm:flex items-center">
                    <UserCircleIcon className="w-6 h-6 mr-2 text-sky-600"/> 
                    {currentUser.email}
                  </span>
                )}
                <Button onClick={logout} variant="secondary" size="small" aria-label="Logout">
                   <ArrowLeftOnRectangleIcon className="w-5 h-5 sm:mr-2"/> <span className="hidden sm:inline">Logout</span>
                </Button>
            </div>
        </div>
         <p className="text-slate-600 mt-2 max-w-6xl mx-auto">Create stunning social media posts for your listings.</p>
      </header>

      <main className="max-w-6xl mx-auto space-y-8">
        <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="search-heading">
          <h2 id="search-heading" className="text-2xl font-semibold text-slate-700 mb-4">1. Find Your Listing</h2>
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
            <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="property-info-heading">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 id="property-info-heading" className="text-2xl font-semibold text-slate-700">2. Property Information</h2>
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

            <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="select-photos-heading">
              <h2 id="select-photos-heading" className="text-2xl font-semibold text-slate-700 mb-2">3. Select Photos (up to {MAX_IMAGE_SELECTIONS})</h2>
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
                onImageAutoAdjust={handleAutoAdjustAndSaveImage} // New prop
                maxSelections={MAX_IMAGE_SELECTIONS}
              />
            </section>

            <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="branding-heading">
              <h2 id="branding-heading" className="text-2xl font-semibold text-slate-700 mb-4">4. Add Branding (Required)</h2>
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
              <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="package-preview-heading">
                <h2 id="package-preview-heading" className="text-2xl font-semibold text-slate-700 mb-4">5. Your Social Media Package</h2>
                <PackagePreview 
                    images={processedImagePackage} 
                    mlsId={currentMlsIdSearched} 
                />
              </section>
            )}
          </>
        )}
      </main>

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

      <footer className="text-center py-10 mt-12 border-t border-slate-300">
        <p className="text-sm text-slate-500">
          Made by <a href="mailto:i@aryanbawa.ca" className="text-sky-600 hover:text-sky-700 hover:underline">Aryan Bawa</a>. For demonstration purposes.
        </p>
        <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} Featured Listing Maker.</p>
      </footer>
    </div>
  );
};

export default App;