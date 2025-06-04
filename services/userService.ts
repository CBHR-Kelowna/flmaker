import type { UserProfile, Listing } from '../types.js';
import { auth } from './firebaseService.js'; 

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
      console.error("Error getting ID token for user service:", error);
      throw new Error("Failed to get authentication token.");
    }
  } else {
    throw new Error("User not authenticated.");
  }
  return headers;
};

const handleFetchError = async (response: Response, defaultMessage: string): Promise<Error> => {
    if (response.status === 401 || response.status === 403) {
        return new Error(`Authentication error (${response.status}). Please log in again.`);
    }
    try {
        const errorData = await response.json();
        return new Error(errorData.message || `${defaultMessage}. Status: ${response.status}`);
    } catch (e) {
        // If parsing errorData fails, or if it's not JSON
        return new Error(`${defaultMessage}. Status: ${response.status}. Response not in expected JSON format.`);
    }
};

export const fetchUserProfile = async (): Promise<UserProfile> => {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw await handleFetchError(response, 'Failed to fetch user profile');
    }
    return response.json();
  } catch (error: any) {
    if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        throw new Error('Network error: Could not reach server to fetch user profile. Please check your internet connection and server status.');
    }
    throw error; // Re-throw other errors
  }
};

export const updateUserProfile = async (agentKey: string | null): Promise<UserProfile> => {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ agentKey }),
    });

    if (!response.ok) {
      throw await handleFetchError(response, 'Failed to update user profile');
    }
    return response.json();
  } catch (error: any) {
     if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        throw new Error('Network error: Could not reach server to update user profile. Please check your internet connection and server status.');
    }
    throw error;
  }
};

export const fetchAgentListings = async (): Promise<Listing[]> => {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/agent-listings`, {
      method: 'GET',
      headers,
    });
    if(!response.ok) {
      throw await handleFetchError(response, 'Failed to fetch agent listings');
    }
    return response.json();
  } catch (error: any) {
    if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        throw new Error('Network error: Could not reach server to fetch agent listings. Please check your internet connection and server status.');
    }
    throw error;
  }
};