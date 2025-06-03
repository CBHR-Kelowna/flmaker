
import type { Listing } from '../types';
import { auth } from './firebaseService'; // Import Firebase auth instance

const API_BASE_URL = 'https://fl.kelownarealestate.com/api'; // Or your actual API base URL

const getAuthHeader = async (): Promise<HeadersInit> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error("Error getting ID token for AI service:", error);
      throw new Error("Failed to get authentication token.");
    }
  } else {
    throw new Error("User not authenticated.");
  }
  return headers;
};

const handleFetchError = async (response: Response, defaultMessage: string): Promise<Error> => {
    if (response.status === 401 || response.status === 403) {
        return new Error(`Authentication error (${response.status}) with AI service. Please log in again.`);
    }
    try {
        const errorData = await response.json();
        return new Error(errorData.message || `${defaultMessage}. Status: ${response.status}`);
    } catch (e) {
        return new Error(`${defaultMessage}. Status: ${response.status}. Response not in expected JSON format.`);
    }
};


export const generateInstagramPostDescription = async (listing: Listing, agentName: string | null): Promise<string> => {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/generate-instagram-description`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ listing, agentName }),
    });

    if (!response.ok) {
      throw await handleFetchError(response, 'Failed to generate description');
    }

    const result = await response.json();
    if (typeof result.description === 'string') {
      return result.description;
    }
    throw new Error('Failed to generate description: AI response was malformed.');

  } catch (error: any) {
    console.error("Error calling backend for Instagram description:", error);
    if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        throw new Error('Network error: Could not reach AI service on server. Please check your internet connection and server status.');
    }
    if (error instanceof Error) {
        throw error; // Re-throw existing error
    }
    throw new Error("Failed to generate description due to an unknown error.");
  }
};
