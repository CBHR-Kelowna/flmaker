
// ecosystem.config.js
// Ensure dotenv is a dependency in your package.json: npm install dotenv
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file located in the project root
// __dirname in this context (when PM2 executes this file) should be the project root where ecosystem.config.js resides.
const envConfig = dotenv.config({ path: path.resolve(__dirname, '.env') });

if (envConfig.error) {
  console.warn("ecosystem.config.js: Warning: Could not load .env file. Ensure .env is in the project root alongside this file.", envConfig.error);
} else {
  console.log("ecosystem.config.js: Successfully loaded .env file for PM2 configuration.");
}

// Helper to get environment variables: prefers .env loaded here, then existing process.env, then default
const getEnvVar = (key, defaultValue = undefined) => {
  if (envConfig.parsed && typeof envConfig.parsed[key] !== 'undefined') {
    return envConfig.parsed[key];
  }
  if (typeof process.env[key] !== 'undefined') {
    return process.env[key];
  }
  return defaultValue;
};

module.exports = {
  apps : [{
    name   : "featured-listing-maker",
    script : "./server/dist/server.js",  // Path to the compiled server entry point
    cwd    : "/var/www/featured-listing-maker/", // Current working directory FOR THE APP
                                                 // This is important so server.ts can find its own .env if needed
                                                 // and for relative paths within the app.
    env_production: {
      NODE_ENV: "production",
      // Explicitly set environment variables for PM2 to pass to the app
      PORT: getEnvVar('PORT', '3001'), // Default to 3001 if not in .env
      MONGODB_URI: getEnvVar('MONGODB_URI'),
      MONGODB_DB_NAME: getEnvVar('MONGODB_DB_NAME'),
      MONGODB_LISTINGS_COLLECTION: getEnvVar('MONGODB_LISTINGS_COLLECTION', 'Listings'),
      MONGODB_AGENTS_COLLECTION: getEnvVar('MONGODB_AGENTS_COLLECTION', 'Agents'),
      MONGODB_TEAMS_COLLECTION: getEnvVar('MONGODB_TEAMS_COLLECTION', 'Teams'),
      GOOGLE_APPLICATION_CREDENTIALS: getEnvVar('GOOGLE_APPLICATION_CREDENTIALS'),
      API_KEY: getEnvVar('API_KEY')
      // Add any other environment variables your application needs
    },
    output : "/var/www/featured-listing-maker/logs/out.log", // Log file path
    error  : "/var/www/featured-listing-maker/logs/error.log", // Error log file path
    log_date_format: "YYYY-MM-DD HH:mm:ss Z", // Optional: customize log date format
    // combine_logs: true, // Optional: if you want to combine stdout and stderr
    // merge_logs: true, // Optional: similar to combine_logs
  }]
};
