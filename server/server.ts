
import express, { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import { MongoClient, Db, Collection } from 'mongodb';
import cors, { CorsOptions } from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import process from 'process';
import fs from 'fs'; // Import the 'fs' module for file system checks

// Load environment variables from .env file located in the project root
const dotenvResult = dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envPathUsed = path.resolve(process.cwd(), '.env'); 

if (dotenvResult.error) {
  console.error(`Error loading .env file from ${envPathUsed}: ${dotenvResult.error.message}`);
  console.error('Please ensure .env exists in the project root directory and is readable.');
} else if (dotenvResult.parsed) {
  console.log(`Successfully loaded environment variables from ${envPathUsed}`);
} else {
  console.warn(`No .env file found at ${envPathUsed}, or it is empty. Relying on globally set environment variables.`);
}


const app: Express = express();
const port = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:5173', 
  'http://localhost:8080', 
  'http://127.0.0.1:5500',
  `http://localhost:${port}`, // Allow requests from the same origin the server is running on
  `http://127.0.0.1:${port}`,
  'http://15.223.66.150', // Allow your Lightsail IP directly
  'http://15.223.66.150:3001' // Allow your Lightsail IP with port
];

const corsOptions: CorsOptions = {
  origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!requestOrigin) { 
      console.warn("CORS: Request has no origin. Allowing for development purposes.");
      return callback(null, true);
    }
    if (allowedOrigins.some(origin => requestOrigin.startsWith(origin))) { // Check if requestOrigin starts with any allowed origin
      callback(null, true);
    } else {
      // Temporarily allow all for easier debugging, but tighten this in production
      console.warn(`CORS: Origin '${requestOrigin}' not in allowedOrigins. Allowing for debugging purposes.`);
      callback(null, true); 
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, 
};

// Use middleware directly
app.use(cors(corsOptions)); 
app.use(express.json());

let db: Db;
let listingsCollection: Collection;
let agentsCollection: Collection;
let teamsCollection: Collection;

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
const listingsCollectionName = process.env.MONGODB_LISTINGS_COLLECTION || 'Listings';
const agentsCollectionName = process.env.MONGODB_AGENTS_COLLECTION || 'Agents';
const teamsCollectionName = process.env.MONGODB_TEAMS_COLLECTION || 'Teams';

if (!mongoUri) {
  console.error('--------------------------------------------------------------------');
  console.error('FATAL ERROR: MONGODB_URI is not defined.');
  console.error(`Tried to load from .env at: ${envPathUsed}`);
  console.error('Please ensure MONGODB_URI is set in your .env file in the project root.');
  console.error('Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/yourDbName');
  console.error('--------------------------------------------------------------------');
  process.exit(1);
}
if (!dbName) {
  console.error('--------------------------------------------------------------------');
  console.error('FATAL ERROR: MONGODB_DB_NAME is not defined.');
  console.error(`Tried to load from .env at: ${envPathUsed}`);
  console.error('Please ensure MONGODB_DB_NAME is set in your .env file in the project root.');
  console.error('Example: MONGODB_DB_NAME=Cluster0');
  console.error('--------------------------------------------------------------------');
  process.exit(1);
}

const client = new MongoClient(mongoUri!); 

async function connectAndStartServer() {
  try {
    const hiddenUri = mongoUri!.includes('@') ? `${mongoUri!.substring(0, mongoUri!.indexOf('@'))}@CLUSTER_DETAILS_HIDDEN` : 'Invalid MongoURI format (missing @)';
    console.log(`Attempting to connect to MongoDB at: ${hiddenUri}`);
    await client.connect();
    console.log('Successfully connected to MongoDB Atlas.');
    db = client.db(dbName); 
    console.log(`Using database: "${dbName}"`);

    listingsCollection = db.collection(listingsCollectionName);
    agentsCollection = db.collection(agentsCollectionName);
    teamsCollection = db.collection(teamsCollectionName);
    console.log(`Ensured collections: Listings='${listingsCollectionName}', Agents='${agentsCollectionName}', Teams='${teamsCollectionName}'`);

    // API endpoint to get a specific listing by MLS ID
    app.get('/api/listings/:mlsId', async (req: Request<{ mlsId: string }>, res: Response) => {
      const { mlsId } = req.params;
      if (!listingsCollection) {
        return res.status(503).json({ message: 'Listings collection not initialized. Backend may be starting up or experiencing DB connection issues.' });
      }
      try {
        const listing = await listingsCollection.findOne({ ListingId: mlsId });
        if (listing) {
          res.json(listing);
        } else {
          res.status(404).json({ message: `Listing with MLS ID ${mlsId} not found in collection '${listingsCollectionName}' of database '${dbName}'.` });
        }
      } catch (error) {
        console.error(`Error fetching listing for MLS ID ${mlsId}:`, error);
        res.status(500).json({ message: 'Internal server error while fetching listing.' });
      }
    });

    // API endpoint to get all agents
    app.get('/api/agents', async (req: Request, res: Response) => {
      if (!agentsCollection) {
        return res.status(503).json({ message: 'Agents collection not initialized. Backend may be starting up or experiencing DB connection issues.' });
      }
      try {
        const agents = await agentsCollection.find({}).toArray();
        const mappedAgents = agents.map(agentDoc => {
          const { _id, ...rest } = agentDoc; 
          return { ...rest, id: _id ? _id.toString() : undefined };
        });
        res.json(mappedAgents);
      } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ message: 'Internal server error while fetching agents.' });
      }
    });

    // API endpoint to get all teams
    app.get('/api/teams', async (req: Request, res: Response) => {
      if (!teamsCollection) {
        return res.status(503).json({ message: 'Teams collection not initialized. Backend may be starting up or experiencing DB connection issues.' });
      }
      try {
        const teams = await teamsCollection.find({}).toArray();
        const mappedTeams = teams.map(teamDoc => {
          const { _id, ...rest } = teamDoc; 
          return { ...rest, id: _id ? _id.toString() : undefined };
        });
        res.json(mappedTeams);
      } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ message: 'Internal server error while fetching teams.' });
      }
    });
    
    // Serve static assets from dist_frontend (for /dist_frontend/index.js etc.)
    const distFrontendPath = path.join(process.cwd(), 'dist_frontend');
    console.log(`Serving static assets from ${distFrontendPath} at /dist_frontend`);

    app.use('/dist_frontend',
      (req: Request, res: Response, next: NextFunction) => {
        console.log(`[STATIC_PRE_LOG] Request to /dist_frontend: ${req.method} ${req.path}, Original URL: ${req.originalUrl}`);
        next();
      },
      express.static(distFrontendPath, {
        extensions: ['js'], // Automatically look for .js if file not found (e.g., /App -> /App.js)
        setHeaders: (res, filePath, stat) => {
          if (filePath.endsWith('.js')) {
            const currentContentType = res.getHeader('Content-Type');
            const jsMimeTypes = ['application/javascript', 'text/javascript'];
            if (typeof currentContentType !== 'string' || !jsMimeTypes.some(type => currentContentType.startsWith(type))) {
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              console.log(`[EXPRESS_STATIC_JS_MIME_FIX] Set Content-Type for ${filePath} to application/javascript; charset=utf-8 (was: ${currentContentType})`);
            } else {
              console.log(`[EXPRESS_STATIC_JS_MIME_OK] Content-Type for ${filePath} already OK: ${currentContentType}`);
            }
          }
          console.log(`[EXPRESS_STATIC_SERVE_FINAL] Serving: ${filePath} with final Content-Type: ${res.getHeader('Content-Type')}`);
        }
      })
    );


    // --- BEGIN DIAGNOSTIC CHECK ---
    const mainScriptPath = path.join(distFrontendPath, 'index.js');
    if (!fs.existsSync(mainScriptPath)) {
      console.warn(`--------------------------------------------------------------------`);
      console.warn(`WARNING: Frontend entry point NOT FOUND: ${mainScriptPath}`);
      console.warn(`The application GUI will likely not load correctly.`);
      console.warn(`Please ensure the frontend has been built successfully (e.g., using 'npm run build:frontend' or 'tsc -p ./tsconfig.json').`);
      console.warn(`The 'watch:frontend' script ('tsc -w -p ./tsconfig.json') should handle this in development.`);
      console.warn(`Check its console output for TypeScript errors.`);
      console.warn(`Expected 'index.tsx' (and its dependencies) to be compiled to '${mainScriptPath}'.`);
      console.warn(`--------------------------------------------------------------------`);
    } else {
      console.log(`Frontend entry point found: ${mainScriptPath}`);
    }
    // --- END DIAGNOSTIC CHECK ---

    // Serve index.html for the root and any other non-API GET requests (SPA Handler)
    const indexPath = path.join(process.cwd(), 'index.html');
    console.log(`Index.html path configured to: ${indexPath}`);

    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) {
        return next(); // Pass to API 404 handler or other API middleware
      }
      // Log if we are serving index.html for an asset path
      // Check if the path does not have an extension or is an HTML file, and is not an API call
      const hasExtension = req.path.includes('.');
      const isLikelyAsset = hasExtension && !req.path.endsWith('.html');

      if (isLikelyAsset && req.path.startsWith('/dist_frontend/')) { // Only warn for /dist_frontend paths specifically
         console.warn(`[SPA_FALLBACK_WARN] Serving index.html for ASSET path: ${req.path}. This might indicate the asset was not found by express.static.`);
      } else if (!isLikelyAsset) {
         console.log(`[SPA_FALLBACK] Serving index.html for general path: ${req.path}`);
      }
      
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Error sending index.html for path ${req.path}. Tried path: ${indexPath}. CWD: ${process.cwd()}`, err);
          if (!res.headersSent) {
            if ((err as any).code === 'ENOENT') { 
                 res.status(404).send(`Error: index.html not found. Please ensure 'index.html' exists at the project root ('${process.cwd()}'). Path used: '${indexPath}'`);
            } else {
                 res.status((err as any).status || 500).send('Error serving application or resource not found.');
            }
          }
        }
      });
    });

    // Catch-all for 404 API routes (if an /api/ path was not handled above)
    app.use('/api/*', (req: Request, res: Response) => {
      res.status(404).send(`API endpoint not found: ${req.method} ${req.originalUrl}`);
    });

    // Generic error handler (should be last)
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => { 
      console.error("Unhandled error:", err.stack);
      if (res.headersSent) { 
        return _next(err);
      }
      if (err.message && err.message.includes('Not allowed by CORS')) { 
          res.status(403).json({ message: err.message });
      } else {
          res.status(500).json({message: 'Something broke on the server!'});
      }
    });

    app.listen(port, () => {
      console.log(`Backend server running at http://localhost:${port}`);
      console.log(`Frontend application should be accessible at http://localhost:${port}`);
      console.log(`Ensure 'index.html' is in the project root: ${process.cwd()}`);
    });

  } catch (err) {
    const hiddenUri = mongoUri!.includes('@') ? `${mongoUri!.substring(0, mongoUri!.indexOf('@'))}@CLUSTER_DETAILS_HIDDEN` : 'Invalid MongoURI format (missing @)';
    console.error(`Failed to connect to MongoDB, initialize collections, or start server.`);
    console.error(`MongoURI used (details hidden): ${hiddenUri}`);
    console.error(`Database Name used: ${dbName}`);
    console.error('Error details:', err);
    process.exit(1);
  }
}

connectAndStartServer();
    