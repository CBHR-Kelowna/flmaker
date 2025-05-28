
export interface Listing {
  ListingId: string; // MLS
  ListingKey: string;
  ListAgentKey: string;
  City: string;
  StreetName: string;
  ListPrice: number;
  PublicRemarks: string;
  PhotoGallery: string; // Space-separated URLs
  OfficeName: string;
  Latitude: number;
  Longitude: number;
}

export interface Agent {
  id: string;
  name: string;
  overlayImage: string; // URL to agent's 1080x1080 overlay image
}

export interface Team {
  id: string;
  name: string;
  overlayLogo: string; // URL to team's 1080x1080 overlay logo
}

// For react-easy-crop
export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ImageEditState {
  crop: Point;
  zoom: number;
  croppedAreaPixels: Area | null;
  sharpness?: number; // Added for sharpening, 0-20
}

export interface GeneratePackageParams {
  orderedSelectedImageUrls: string[];
  imageEditStates: { [url: string]: ImageEditState };
  overlay?: { // Only one of agent or team should ideally be present based on selection logic
    agent?: Agent;
    team?: Team;
  };
  targetWidth: number;
  targetHeight: number;
}

// New type for image analysis results
export interface ImageAnalysisResult {
  hasSignificantStrips?: boolean; // This flag indicates if aspect ratio is problematic for 1:1
  isPotentiallyLowResolution?: boolean; // This flag indicates if image resolution is low for target
}

export interface ProcessedPackageResult {
  successfulImages: string[];
  failedImageOriginalUrls: string[];
  imageAnalysis: { [originalUrl: string]: ImageAnalysisResult }; // For post-generation analysis/logging
}