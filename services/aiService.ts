
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


export const generateInstagramPostDescription = async (listing: Listing, agentName: string | null): Promise<string> => {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/generate-instagram-description`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ listing, agentName }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Failed to generate description. Status: ${response.status}` }));
      throw new Error(errorData.message || `Failed to generate description. Status: ${response.status}`);
    }

    const result = await response.json();
    if (typeof result.description === 'string') {
      return result.description;
    }
    throw new Error('Failed to generate description: AI response was malformed.');

  } catch (error) {
    console.error("Error calling backend for Instagram description:", error);
    if (error instanceof Error) {
        throw error; // Re-throw existing error
    }
    throw new Error("Failed to generate description due to an unknown error.");
  }
};