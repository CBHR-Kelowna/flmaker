import type { Agent, Team } from '../types.js';
import { auth } from './firebaseService.js'; // Import Firebase auth instance

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
      throw new Error("Failed to get authentication token.");
    }
  } else {
     throw new Error("User not authenticated.");
  }
  return headers;
};

const handleFetchError = async (response: Response, defaultMessage: string): Promise<Error> => {
    if (response.status === 401 || response.status === 403) {
       return new Error(`Authentication error (${response.status}) fetching assets. Please log in again.`);
    }
    try {
        const errorData = await response.json();
        return new Error(errorData.message || `${defaultMessage}. Status: ${response.status}`);
    } catch (e) {
        return new Error(`${defaultMessage}. Status: ${response.status}. Response not in expected JSON format.`);
    }
};

export const fetchAgents = async (): Promise<Agent[]> => {
  console.log(`Fetching agents from backend API`);
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/agents`, { headers });

    if (!response.ok) {
      throw await handleFetchError(response, 'Failed to fetch agents');
    }
    
    const agentsData: Agent[] = await response.json();
    console.log('[API DATA] Fetched agents:', agentsData);
    return agentsData;
  } catch (error: any) {
    if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        throw new Error('Network error: Could not reach server to fetch agents. Please check your internet connection and server status.');
    }
    throw error;
  }
};

export const fetchTeams = async (): Promise<Team[]> => {
  console.log(`Fetching teams from backend API`);
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/teams`, { headers });

    if (!response.ok) {
      throw await handleFetchError(response, 'Failed to fetch teams');
    }

    const teamsData: Team[] = await response.json();
    console.log('[API DATA] Fetched teams:', teamsData);
    return teamsData;
  } catch (error: any) {
    if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        throw new Error('Network error: Could not reach server to fetch teams. Please check your internet connection and server status.');
    }
    throw error;
  }
};