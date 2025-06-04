import type { Agent, Team } from '../types';
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
      // Handle error appropriately
    }
  }
  return headers;
};

export const fetchAgents = async (): Promise<Agent[]> => {
  console.log(`Fetching agents from backend API`);
  const headers = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/agents`, { headers });

  if (!response.ok) {
     if (response.status === 401 || response.status === 403) {
       throw new Error(`Authentication error (${response.status}) fetching agents. Please log in again.`);
    }
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch agents and could not parse error.' }));
    throw new Error(errorData.message || `Failed to fetch agents. Status: ${response.status}`);
  }
  
  const agentsData: Agent[] = await response.json();
  console.log('[API DATA] Fetched agents:', agentsData);
  return agentsData;
};

export const fetchTeams = async (): Promise<Team[]> => {
  console.log(`Fetching teams from backend API`);
  const headers = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/teams`, { headers });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
       throw new Error(`Authentication error (${response.status}) fetching teams. Please log in again.`);
    }
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch teams and could not parse error.' }));
    throw new Error(errorData.message || `Failed to fetch teams. Status: ${response.status}`);
  }

  const teamsData: Team[] = await response.json();
  console.log('[API DATA] Fetched teams:', teamsData);
  return teamsData;
};
