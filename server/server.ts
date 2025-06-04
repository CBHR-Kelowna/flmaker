
import express, {
    Express,
    Request as ExpressRequest, // Aliased
    Response as ExpressResponse, // Aliased
    NextFunction as ExpressNextFunction, // Aliased
    RequestHandler,
    ErrorRequestHandler
} from 'express';
import { MongoClient, Db, Collection } from 'mongodb';
import cors, { CorsOptions } from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import * as admin from 'firebase-admin'; // Import Firebase Admin SDK

// --- Environment Variable Loading and Diagnostics ---
const envPathUsed = path.resolve(process.cwd(), '.env');
console.log(`Attempting to load environment variables from: ${envPathUsed}`);
const dotenvResult = dotenv.config({ path: envPathUsed });

if (dotenvResult.error) {
  console.error(`Error loading .env file from ${envPathUsed}: ${dotenvResult.error.message}`);
} else if (dotenvResult.parsed) {
  console.log(`Successfully loaded and parsed .env file from ${envPathUsed}`);
  if (dotenvResult.parsed.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`dotenv: GOOGLE_APPLICATION_CREDENTIALS found in .env file content: '${dotenvResult.parsed.GOOGLE_APPLICATION_CREDENTIALS}'`);
  } else {
    console.warn(`dotenv: GOOGLE_APPLICATION_CREDENTIALS was NOT found in the parsed .env file content.`);
  }
} else {
  console.warn(`No .env file found at ${envPathUsed}, or it is empty. Attempting to rely on globally set environment variables.`);
}

// Check process.env immediately after dotenv attempt
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`process.env: GOOGLE_APPLICATION_CREDENTIALS is set to: '${process.env.GOOGLE_APPLICATION_CREDENTIALS}'`);
} else {
    console.warn(`process.env: GOOGLE_APPLICATION_CREDENTIALS is UNDEFINED after dotenv.config() call.`);
}
// --- End Environment Variable Loading and Diagnostics ---


// --- Firebase Admin SDK Initialization ---
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
    console.error("FATAL ERROR: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set in process.env at the time of Firebase Admin SDK initialization.");
    console.error("This variable should point to your Firebase service account key JSON file.");
    console.error("Ensure it's correctly set in your .env file and that PM2 is loading it (e.g., via ecosystem.config.js or by restarting PM2 with --update-env).");
    process.exit(1);
}

try {
    console.log(`Firebase Admin SDK: Attempting to use service account key from path: ${serviceAccountPath}`);
    if (!fs.existsSync(serviceAccountPath)) {
        console.error(`FATAL ERROR: Service account key file not found at path: ${serviceAccountPath}`);
        console.error("Ensure GOOGLE_APPLICATION_CREDENTIALS points to a valid and readable JSON key file.");
        process.exit(1);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully using service account file.");
} catch (error: any) {
    console.error("Firebase Admin SDK initialization failed:", error.message);
    console.error(`Error occurred while trying to use service account key from: ${serviceAccountPath}`);
    if (error.code === 'ENOENT') {
        console.error("Specific Error: Service account file not found. Please double-check the path and permissions.");
    } else if (error instanceof SyntaxError) {
        console.error("Specific Error: Failed to parse the service account JSON. Ensure the file is a valid JSON.");
    }
    process.exit(1);
}
// --- End Firebase Admin SDK Initialization ---

// Extend Express Request type to include user
interface AuthenticatedRequest extends ExpressRequest { // Use aliased ExpressRequest
  user?: admin.auth.DecodedIdToken;
}

const app: Express = express();
const port = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
  'http://15.223.66.150',
  'http://15.223.66.150:3001',
  'https://fl.kelownarealestate.com',
  'https://0jj6trdhljkycwzkbo2urievkgo0o8jmzhllh1vqi8gh9d1cii-h763805538.scf.usercontent.goog'
];

const corsOptions: CorsOptions = {
  origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!requestOrigin || allowedOrigins.some(origin => requestOrigin.startsWith(origin))) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin '${requestOrigin}' blocked.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};

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
  console.error('FATAL ERROR: MONGODB_URI is not defined. Check .env file and PM2 configuration.');
  process.exit(1);
}
if (!dbName) {
  console.error('FATAL ERROR: MONGODB_DB_NAME is not defined. Check .env file and PM2 configuration.');
  process.exit(1);
}

const client = new MongoClient(mongoUri!);

// Firebase Authentication Middleware
const authenticateToken: RequestHandler = async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  const authReq = req as AuthenticatedRequest;
  const authHeader = authReq.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Auth middleware: No or malformed Bearer token provided.');
    return res.status(401).json({ message: 'Authentication token required or malformed (must be Bearer token).' });
  }

  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer' || !tokenParts[1]) {
    console.log('Auth middleware: Malformed Bearer token structure.');
    return res.status(401).json({ message: 'Authentication token malformed.' });
  }
  const token = tokenParts[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    authReq.user = decodedToken; // Add user to request object
    console.log(`Auth middleware: Token verified for UID ${decodedToken.uid}`);
    next();
  } catch (error: any) {
    console.error('Auth middleware: Invalid token.', error.message);
    return res.status(403).json({ message: 'Invalid or expired authentication token.' });
  }
};


async function connectAndStartServer() {
  try {
    await client.connect();
    console.log('Successfully connected to MongoDB Atlas.');
    db = client.db(dbName!);
    console.log(`Using database: "${dbName}"`);

    listingsCollection = db.collection(listingsCollectionName);
    agentsCollection = db.collection(agentsCollectionName);
    teamsCollection = db.collection(teamsCollectionName);
    console.log(`Ensured collections: Listings='${listingsCollectionName}', Agents='${agentsCollectionName}', Teams='${teamsCollectionName}'`);

    app.use('/api', authenticateToken);


    app.get('/api/listings/:mlsId', async (req: ExpressRequest, res: ExpressResponse) => {
      const authReq = req as AuthenticatedRequest;
      const { mlsId } = authReq.params;
      console.log(`User ${authReq.user?.uid} requesting listing ${mlsId}`);
      if (!listingsCollection) {
        return res.status(503).json({ message: 'Listings collection not initialized.' });
      }
      try {
        const listing = await listingsCollection.findOne({ ListingId: mlsId });
        if (listing) {
          res.json(listing);
        } else {
          res.status(404).json({ message: `Listing with MLS ID ${mlsId} not found.` });
        }
      } catch (error) {
        console.error(`Error fetching listing for MLS ID ${mlsId}:`, error);
        res.status(500).json({ message: 'Internal server error while fetching listing.' });
      }
    });

    app.get('/api/agents', async (req: ExpressRequest, res: ExpressResponse) => {
        const authReq = req as AuthenticatedRequest;
        console.log(`User ${authReq.user?.uid} requesting agents`);
      if (!agentsCollection) {
        return res.status(503).json({ message: 'Agents collection not initialized.' });
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

    app.get('/api/teams', async (req: ExpressRequest, res: ExpressResponse) => {
        const authReq = req as AuthenticatedRequest;
        console.log(`User ${authReq.user?.uid} requesting teams`);
      if (!teamsCollection) {
        return res.status(503).json({ message: 'Teams collection not initialized.' });
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

    const distFrontendPath = path.join(process.cwd(), 'dist_frontend');
    app.use('/dist_frontend', express.static(distFrontendPath, {
        extensions: ['js'],
        setHeaders: (res: ExpressResponse, filePath: string) => {
          if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          }
        }
      })
    );

    const mainScriptPath = path.join(distFrontendPath, 'index.js');
    if (!fs.existsSync(mainScriptPath)) {
      console.warn(`WARNING: Frontend entry point NOT FOUND: ${mainScriptPath}`);
    } else {
      console.log(`Frontend entry point found: ${mainScriptPath}`);
    }

    const indexPath = path.join(process.cwd(), 'index.html');
    app.get('*', (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Error sending index.html for path ${req.path}.`, err);
          if (!res.headersSent) {
            res.status((err as any).status || 500).send('Error serving application.');
          }
        }
      });
    });

    app.use('/api/*', (req: ExpressRequest, res: ExpressResponse) => {
      res.status(404).json({ message: `API endpoint not found: ${req.method} ${req.originalUrl}` });
    });

    const errorHandler: ErrorRequestHandler = (err: any, req: ExpressRequest, res: ExpressResponse, _next: ExpressNextFunction) => {
      console.error("Unhandled error:", err.stack || err);
      if (res.headersSent) {
        // If headers are already sent, delegate to the default Express error handler.
        // It's important to pass all four arguments to _next for it to be recognized as an error handler.
        return _next(err);
      }
      if (err.message && err.message.includes('Not allowed by CORS')) {
          res.status(403).json({ message: err.message });
      } else {
          res.status(500).json({message: 'Something broke on the server!'});
      }
    };
    app.use(errorHandler);


    app.listen(port, () => {
      console.log(`Backend server running at http://localhost:${port}`);
    });

  } catch (err) {
    console.error(`Failed to connect to MongoDB, initialize collections, or start server.`, err);
    process.exit(1);
  }
}

connectAndStartServer();
