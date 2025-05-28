
import type { Listing } from '../types';
// import { appConfig } from '../config'; // No longer needed for DB details

// Base URL for the API.
const API_BASE_URL = 'https://fl.kelownarealestate.com/api';

export const fetchListing = async (mlsId: string): Promise<Listing> => {
  console.log(`Fetching listing for MLS ID: ${mlsId} from backend API`);
  
  const response = await fetch(`${API_BASE_URL}/listings/${mlsId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Listing with MLS ID ${mlsId} not found.`);
    }
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch listing details and could not parse error.' }));
    throw new Error(errorData.message || `Failed to fetch listing. Status: ${response.status}`);
  }

  const listingData: Listing = await response.json();
  
  // Add any necessary data transformation here if backend response differs from frontend type
  // For example, if PhotoGallery comes as an array and needs to be a string:
  // if (Array.isArray(listingData.PhotoGallery)) {
  //   listingData.PhotoGallery = (listingData.PhotoGallery as string[]).join(' ');
  // }

  console.log(`[API DATA] Found listing for MLS ID: ${mlsId}`, listingData);
  return listingData;
};