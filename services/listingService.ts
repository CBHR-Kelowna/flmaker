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
    }
  }
  return headers;
};

export const fetchListing = async (mlsId: string): Promise<Listing> => {
  console.log(`Fetching listing for MLS ID: ${mlsId} from backend API`);
  
  const headers = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/listings/${mlsId}`, { headers });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
       throw new Error(`Authentication error (${response.status}). Please log in again.`);
    }
    if (response.status === 404) {
      throw new Error(`Listing with MLS ID ${mlsId} not found.`);
    }
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch listing details and could not parse error.' }));
    throw new Error(errorData.message || `Failed to fetch listing. Status: ${response.status}`);
  }

  const listingData: Listing = await response.json();
  
  console.log(`[API DATA] Found listing for MLS ID: ${mlsId}`, listingData);
  return listingData;
};
