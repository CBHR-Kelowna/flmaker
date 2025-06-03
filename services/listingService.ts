
import type { Listing } from '../types';
import { auth } from './firebaseService'; // Import Firebase auth instance

const API_BASE_URL = 'https://fl.kelownarealestate.com/api';

const getAuthHeader = async (): Promise<HeadersInit> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error("Error getting ID token:", error);
      // Handle error appropriately, maybe logout user or show error
      throw new Error("Failed to get authentication token.");
    }
  } else {
     throw new Error("User not authenticated.");
  }
  return headers;
};

const handleFetchError = async (response: Response, defaultMessage: string, mlsId?: string): Promise<Error> => {
    if (response.status === 401 || response.status === 403) {
       return new Error(`Authentication error (${response.status}). Please log in again.`);
    }
    if (response.status === 404 && mlsId) {
      return new Error(`Listing with MLS ID ${mlsId} not found.`);
    }
    try {
        const errorData = await response.json();
        return new Error(errorData.message || `${defaultMessage}. Status: ${response.status}`);
    } catch (e) {
        return new Error(`${defaultMessage}. Status: ${response.status}. Response not in expected JSON format.`);
    }
};


export const fetchListing = async (mlsId: string): Promise<Listing> => {
  console.log(`Fetching listing for MLS ID: ${mlsId} from backend API`);
  
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/listings/${mlsId}`, { headers });

    if (!response.ok) {
      throw await handleFetchError(response, 'Failed to fetch listing details', mlsId);
    }

    const listingData: Listing = await response.json();
    
    console.log(`[API DATA] Found listing for MLS ID: ${mlsId}`, listingData);
    return listingData;
  } catch (error: any) {
    if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        throw new Error(`Network error: Could not reach server to fetch listing ${mlsId}. Please check your internet connection and server status.`);
    }
    throw error; // Re-throw other errors
  }
};
