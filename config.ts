
// config.ts

export const appConfig = {
  // The backend server now handles MongoDB connection.
  // Frontend specific configurations can go here.
  // For example, if you had a global API base URL:
  // apiBaseUrl: 'http://localhost:3001/api', 
  // However, for this iteration, API calls are directly in service files.

  assets: {
    // These paths might still be relevant if you have static assets served by frontend,
    // or if the backend constructs full URLs that include these paths.
    // For now, they are conceptual.
    agentOverlayBasePath: "/assets/overlays/agents/", 
    teamOverlayBasePath: "/assets/overlays/teams/",   
  },
};
