
import type { Agent, Team } from '../types';
// import { appConfig } from '../config'; // No longer needed for DB details

const API_BASE_URL = 'http://localhost:3001/api'; // Assuming backend runs on port 3001

export const fetchAgents = async (): Promise<Agent[]> => {
  console.log(`Fetching agents from backend API`);
  const response = await fetch(`${API_BASE_URL}/agents`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch agents and could not parse error.' }));
    throw new Error(errorData.message || `Failed to fetch agents. Status: ${response.status}`);
  }
  
  const agentsData: Agent[] = await response.json();
  // Ensure agent objects match the Agent type, especially 'id' and 'overlayImage'
  // The backend maps _id to id.
  console.log('[API DATA] Fetched agents:', agentsData);
  return agentsData;
};

export const fetchTeams = async (): Promise<Team[]> => {
  console.log(`Fetching teams from backend API`);
  const response = await fetch(`${API_BASE_URL}/teams`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch teams and could not parse error.' }));
    throw new Error(errorData.message || `Failed to fetch teams. Status: ${response.status}`);
  }

  const teamsData: Team[] = await response.json();
  // Ensure team objects match the Team type, especially 'id' and 'overlayLogo'
  // The backend maps _id to id.
  console.log('[API DATA] Fetched teams:', teamsData);
  return teamsData;
};
