

export interface Listing {
  ListingId: string; // MLS
  ListingKey: string;
  ListAgentKey: string;
  CoListAgentKey?: string; // Added for dashboard query
  City: string;
  StreetName: string;
  UnparsedAddress?: string; // New field for full address
  ListPrice: number;
  PublicRemarks: string;
  PhotoGallery: string; // Space-separated URLs
  OfficeName: string;
  Latitude: number;
  Longitude: number;
  BedroomsTotal?: number; 
  BathroomsTotalInteger?: number; 
  BathroomsPartial?: number; 
}

export interface Agent {
  id: string;
  name: string;
  overlayImage: string; 
}

export interface Team {
  id: string;
  name: string;
  overlayLogo: string; 
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
  autoAdjusted?: boolean; // New: True if automatically adjusted
}

export interface GeneratePackageParams {
  orderedSelectedImageUrls: string[];
  imageEditStates: { [url: string]: ImageEditState };
  overlay?: { 
    agent?: Agent;
    team?: Team;
  };
  targetWidth: number;
  targetHeight: number;
}

export interface ImageAnalysisResult {
  hasSignificantStrips?: boolean; 
  isPotentiallyLowResolution?: boolean; 
  naturalWidth?: number; 
  naturalHeight?: number; 
}

export interface ProcessedPackageResult {
  successfulImages: string[];
  failedImageOriginalUrls: string[];
  imageAnalysis: { [originalUrl: string]: ImageAnalysisResult }; 
}

// New UserProfile interface
export interface UserProfile {
  firebaseUID: string;
  agentKey: string | null;
  email: string;
  displayName?: string | null; // displayName from Firebase can be null
  // lastUpdated?: string; // ISO date string
}