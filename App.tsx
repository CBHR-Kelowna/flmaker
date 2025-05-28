
import React, { useState, useEffect } from 'react'; // Removed useCallback
import { SearchBar } from './components/SearchBar';
import { PropertyDetails } from './components/PropertyDetails';
import { PhotoGallery } from './components/PhotoGallery';
import { AgentTeamSelector } from './components/AgentTeamSelector';
import { PackagePreview } from './components/PackagePreview';
import { ImageEditorModal } from './components/ImageEditorModal';
import { LoadingIcon } from './components/icons/LoadingIcon';
import { Button } from './components/Button';
import { fetchListing as apiFetchListing } from './services/listingService';
import { fetchAgents as apiFetchAgents, fetchTeams as apiFetchTeams } from './services/assetService';
import { generateClientSidePackage, analyzeImageDimensionsAndStrips } from './services/imageProcessingService';
import type { Listing, Agent, Team, ImageEditState, Area, Point, GeneratePackageParams, ImageAnalysisResult, ProcessedPackageResult } from './types';

const MAX_IMAGE_SELECTIONS = 10;
const TARGET_DIMENSION = 1080;
const IMAGE_URL_REGEX = /\.(jpeg|jpg|gif|png|webp)$/i;

const App: React.FC = () => {
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
  
  // Proactive analysis results
  const [initialImageAnalyses, setInitialImageAnalyses] = useState<{ [url: string]: ImageAnalysisResult }>({});
  const [isAnalyzingPhotos, setIsAnalyzingPhotos] = useState<boolean>(false); // For optional UI feedback

  const [editingImage, setEditingImage] = useState<{ url: string; aspect: number } | null>(null);

  const [processedImagePackage, setProcessedImagePackage] = useState<string[] | null>(null);
  const [isGeneratingPackage, setIsGeneratingPackage] = useState<boolean>(false);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const [agentsData, teamsData] = await Promise.all([apiFetchAgents(), apiFetchTeams()]);
        setAgents(agentsData);
        setTeams(teamsData);
      } catch (err) {
        setError('Failed to load agent/team data. Please try refreshing.');
        console.error(err);
      }
    };
    loadAssets();
  }, []);

  const performInitialImageAnalysis = async (photoUrls: string[]) => {
    if (photoUrls.length === 0) return;
    setIsAnalyzingPhotos(true);
    setInitialImageAnalyses({}); // Clear previous analyses

    const analyses: { [url: string]: ImageAnalysisResult } = {};
    for (const url of photoUrls) {
      try {
        const result = await analyzeImageDimensionsAndStrips(url);
        analyses[url] = result;
      } catch (e) {
        console.warn(`Failed to analyze image ${url} during initial scan:`, e);
        analyses[url] = { hasSignificantStrips: undefined, isPotentiallyLowResolution: undefined }; // Mark as error/unknown
      }
      // Update incrementally for responsiveness, so warnings appear as they're ready
      setInitialImageAnalyses(prev => ({ ...prev, [url]: analyses[url] }));
    }
    // setInitialImageAnalyses(analyses); // Or update all at once
    setIsAnalyzingPhotos(false);
    console.log("Initial image analysis complete:", analyses);
  };

  const handleSearch = async (mlsId: string) => {
    if (!mlsId) return;
    setIsLoadingListing(true);
    setError(null);
    setListing(null);
    setSelectedOriginalImageUrls([]);
    setImageEditStates({}); 
    setProcessedImagePackage(null);
    setInitialImageAnalyses({}); // Clear previous analyses
    setCurrentMlsIdSearched(mlsId.trim());
    try {
      const fetchedListing = await apiFetchListing(mlsId.trim());
      setListing(fetchedListing);
      if (fetchedListing?.PhotoGallery) {
        const urls = fetchedListing.PhotoGallery.split(' ').filter(u => u.trim() !== '' && IMAGE_URL_REGEX.test(u));
        performInitialImageAnalysis(urls);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch listing.');
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
    setEditingImage({ url, aspect: 1 }); // 1080x1080 is 1:1 aspect ratio
  };

  const handleCloseImageEditor = () => {
    setEditingImage(null);
  };

  const handleSaveImageCrop = (url: string, crop: Point, zoom: number, croppedAreaPixels: Area, sharpness?: number) => {
    setImageEditStates((prevStates: { [url: string]: ImageEditState }) => ({
      ...prevStates,
      [url]: { crop, zoom, croppedAreaPixels, sharpness },
    }));
    // When an image is manually edited, we can assume the user has addressed any strip/low-resolution issues.
    // So, update its analysis to not show the warning anymore.
    setInitialImageAnalyses(prev => ({
      ...prev,
      [url]: { ...prev[url], hasSignificantStrips: false, isPotentiallyLowResolution: false } // Mark as handled
    }));
    setEditingImage(null); 
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
      imageEditStates, // These include crops and sharpness
      overlay: brandingOverlay,
      targetWidth: TARGET_DIMENSION,
      targetHeight: TARGET_DIMENSION,
    };

    try {
      const result: ProcessedPackageResult = await generateClientSidePackage(params);
      setProcessedImagePackage(result.successfulImages);
      
      console.log("Package generation image analysis details:", result.imageAnalysis);


      if (result.failedImageOriginalUrls.length > 0) {
        const failedCount = result.failedImageOriginalUrls.length;
        const imageNoun = failedCount === 1 ? "image" : "images";
        setError(`Warning: ${failedCount} ${imageNoun} could not be processed due to loading errors (e.g., server restrictions or network issues). Placeholders have been used. Check console for details.`);
      }
    } catch (err) { 
      console.error("Package generation failed unexpectedly:", err);
      setError((err as Error).message || "Failed to generate image package. Check console for details.");
    } finally {
      setIsGeneratingPackage(false);
    }
  };

  const photoUrls = listing?.PhotoGallery 
    ? listing.PhotoGallery.split(' ')
        .filter((url: string) => url.trim() !== '' && IMAGE_URL_REGEX.test(url))
    : [];
  const canGenerate = selectedOriginalImageUrls.length > 0 && (!!selectedAgentId || !!selectedTeamId);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-sky-700">Featured Listing Maker</h1>
        <p className="text-xl text-slate-600 mt-1">Coldwell Banker Horizon Realty</p>
        <p className="text-slate-600 mt-2">Create stunning social media posts for your listings.</p>
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
              <h2 id="property-info-heading" className="text-2xl font-semibold text-slate-700 mb-4">2. Property Information</h2>
              <PropertyDetails listing={listing} />
            </section>

            <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="select-photos-heading">
              <h2 id="select-photos-heading" className="text-2xl font-semibold text-slate-700 mb-2">3. Select Photos (up to {MAX_IMAGE_SELECTIONS})</h2>
              <p className="text-sm text-slate-500 mb-4">
                Selected: {selectedOriginalImageUrls.length} / {MAX_IMAGE_SELECTIONS}. The first selected image receives branding. 
                Images marked with "⚠️" may need review for optimal 1:1 posts (e.g., for shape, white strips from source, or low original resolution).
                Use 'Edit Image' to adjust.
              </p>
              <PhotoGallery
                photos={photoUrls}
                selectedImages={selectedOriginalImageUrls} 
                imageEditStates={imageEditStates}
                initialImageAnalyses={initialImageAnalyses} // Pass initial analysis results
                onImageSelect={handleImageSelect}
                onImageEdit={handleOpenImageEditor}
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
                 <p className="text-xs text-slate-500 mt-2">Photo analysis in progress in the background...</p>
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