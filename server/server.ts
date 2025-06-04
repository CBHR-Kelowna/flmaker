
import express, { Request as ExpressRequest, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Collection, Db, MongoClient, FindOptions, ObjectId } from 'mongodb'; // Added ObjectId and FindOptions
import cors, { CorsOptions } from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import * as admin from 'firebase-admin';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Listing, UserProfile } from '../types'; // Import UserProfile
import type { ServerResponse as NodeServerResponse } from 'http'; // For express.static setHeaders

// --- Environment Variable Loading and Diagnostics ---
const envPathUsed = path.resolve((process as any).cwd(), '.env');
console.log(`Attempting to load environment variables from: ${envPathUsed}`);
const dotenvResult = dotenv.config({ path: envPathUsed });

if (dotenvResult.error) {
  console.error(`Error loading .env file from ${envPathUsed}: ${dotenvResult.error.message}`);
} else if (dotenvResult.parsed) {
  console.log(`Successfully loaded and parsed .env file from ${envPathUsed}`);
  // Log specific .env variables critical for startup
  console.log(`dotenv: MONGODB_URI ${dotenvResult.parsed.MONGODB_URI ? 'found' : 'NOT found'} in .env file content.`);
  console.log(`dotenv: MONGODB_DB_NAME ${dotenvResult.parsed.MONGODB_DB_NAME ? 'found' : 'NOT found'} in .env file content.`);
  console.log(`dotenv: GOOGLE_APPLICATION_CREDENTIALS ${dotenvResult.parsed.GOOGLE_APPLICATION_CREDENTIALS ? 'found' : 'NOT found'} in .env file content: '${dotenvResult.parsed.GOOGLE_APPLICATION_CREDENTIALS}'`);
  console.log(`dotenv: API_KEY ${dotenvResult.parsed.API_KEY ? 'found' : 'NOT found'} in .env file.`);
} else {
  console.warn(`No .env file found at ${envPathUsed}, or it is empty. Attempting to rely on globally set environment variables.`);
}

// Log critical process.env variables (these might be set by PM2 or system)
console.log(`process.env: MONGODB_URI is ${process.env.MONGODB_URI ? 'set' : 'NOT set'}.`);
console.log(`process.env: MONGODB_DB_NAME is ${process.env.MONGODB_DB_NAME ? 'set' : 'NOT set'}.`);
console.log(`process.env: GOOGLE_APPLICATION_CREDENTIALS is ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'set to: \'' + process.env.GOOGLE_APPLICATION_CREDENTIALS + '\'' : 'NOT set'}.`);
console.log(`process.env: API_KEY is ${process.env.API_KEY ? 'available' : 'NOT available'}.`);
// --- End Environment Variable Loading ---

// --- Firebase Admin SDK Initialization ---
const serviceAccountPathFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPathFromEnv) {
    console.error("FATAL ERROR: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.");
    (process as any).exit(1);
}

const definiteServiceAccountPath: string = serviceAccountPathFromEnv!;

try {
    if (!fs.existsSync(definiteServiceAccountPath)) {
        console.error(`FATAL ERROR: Service account key file not found at path: ${definiteServiceAccountPath}`);
        (process as any).exit(1);
    }
    const serviceAccountFileContent = fs.readFileSync(definiteServiceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountFileContent);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error: any) {
    console.error(`Firebase Admin SDK initialization failed: ${error.message}. Path used: ${definiteServiceAccountPath}`);
    (process as any).exit(1);
}
// --- End Firebase Admin SDK Initialization ---

// --- Gemini AI Initialization ---
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error('FATAL ERROR: API_KEY for Gemini AI is not defined. Check .env file and PM2 configuration.');
  (process as any).exit(1);
}
const ai = new GoogleGenAI({ apiKey });
console.log("Google GenAI SDK initialized.");
// --- End Gemini AI Initialization ---


// Define AuthenticatedRequest as an intersection type
type AuthenticatedRequest = ExpressRequest & {
  user?: admin.auth.DecodedIdToken;
};

const app = express();
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
  'https://0jj6trdhljkycwzkbo2urievkgo0o8jmzhllh1vqi8gh9d1cii-h763805538.scf.usercontent.goog',
  'https://2oyvyw2kthy5r8q95jty195q3b6sc5z0asq3hm77939bs0ac5v-h763805538.scf.usercontent.goog' // Added new origin
];

const corsOptions: CorsOptions = {
  origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!requestOrigin || allowedOrigins.some(origin => requestOrigin.startsWith(origin))) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin '${requestOrigin}' blocked by defined policy.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

let db: Db;
let listingsCollection: Collection;
let agentsCollection: Collection;
let teamsCollection: Collection;
let userProfilesCollection: Collection<UserProfile>;

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
const listingsCollectionName = process.env.MONGODB_LISTINGS_COLLECTION || 'Listings';
const agentsCollectionName = process.env.MONGODB_AGENTS_COLLECTION || 'Agents';
const teamsCollectionName = process.env.MONGODB_TEAMS_COLLECTION || 'Teams';
const userProfilesCollectionName = process.env.MONGODB_USERPROFILES_COLLECTION || 'UserProfiles';

if (!mongoUri || !dbName) {
  console.error('FATAL ERROR: MONGODB_URI or MONGODB_DB_NAME is not defined.');
  (process as any).exit(1);
}

const client = new MongoClient(mongoUri!);

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required (Bearer).' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authentication token malformed.' });
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error: any) {
    console.error('Auth middleware: Invalid token.', error.message);
    return res.status(403).json({ message: 'Invalid or expired authentication token.' });
  }
};

const getBedBathDisplayInfoForServer = (listing: Listing): {
  bedBathTextFormatted: string | null;
  bedsForPrompt: string;
  bathsForPrompt: string;
} => {
  let bedsCount = 0;
  if (listing.BedroomsTotal && listing.BedroomsTotal > 0) {
    bedsCount = listing.BedroomsTotal;
  }
  let totalCalculatedBaths = 0;
  if (listing.BathroomsTotalInteger && listing.BathroomsTotalInteger > 0) {
    totalCalculatedBaths += listing.BathroomsTotalInteger;
  }
  if (listing.BathroomsPartial && listing.BathroomsPartial > 0) {
    totalCalculatedBaths += listing.BathroomsPartial;
  }
  if (bedsCount === 0 && totalCalculatedBaths === 0) {
    return { bedBathTextFormatted: null, bedsForPrompt: "Not specified", bathsForPrompt: "Not specified" };
  }
  const bedsStrDisplay = bedsCount > 0 ? `${bedsCount} Bed${bedsCount > 1 ? 's' : ''}` : "";
  const bathsStrDisplay = totalCalculatedBaths > 0 ? `${totalCalculatedBaths} Bath${totalCalculatedBaths > 1 ? 's' : ''}` : "";
  let combinedText: string | null = null;
  if (bedsStrDisplay && bathsStrDisplay) combinedText = `${bedsStrDisplay} | ${bathsStrDisplay}`;
  else if (bedsStrDisplay) combinedText = bedsStrDisplay;
  else if (bathsStrDisplay) combinedText = bathsStrDisplay;
  return { bedBathTextFormatted: combinedText, bedsForPrompt: bedsStrDisplay || "Not specified", bathsForPrompt: bathsStrDisplay || "Not specified" };
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
    userProfilesCollection = db.collection<UserProfile>(userProfilesCollectionName);

    // Updated log to be more robust
    console.log(`Ensured collections: Listings='${listingsCollectionName}', Agents='${agentsCollectionName}', Teams='${teamsCollectionName}', UserProfiles='${userProfilesCollectionName}' (from MONGODB_USERPROFILES_COLLECTION env: ${process.env.MONGODB_USERPROFILES_COLLECTION || 'UserProfiles (default)'})`);


    app.use('/api', authenticateToken);

    console.log("Defining /api/user/profile GET route...");
    app.get('/api/user/profile', async (req: AuthenticatedRequest, res: Response) => {
        console.log(`🔥🔥🔥 Entered GET /api/user/profile route handler for user: ${req.user?.uid} 🔥🔥🔥`); // Enhanced log
        const firebaseUID = req.user?.uid;
        if (!firebaseUID) {
            console.warn("GET /api/user/profile: User UID not found in token after auth middleware.");
            return res.status(403).json({ message: 'User UID not found in token.' });
        }
        try {
            let userProfileDoc = await userProfilesCollection.findOne({ firebaseUID });
            if (!userProfileDoc) {
                console.log(`GET /api/user/profile: No profile found for UID ${firebaseUID}, creating new one.`);
                const newUserProfileData: UserProfile = {
                    firebaseUID,
                    agentKey: null,
                    email: req.user?.email || '',
                    displayName: req.user?.name || req.user?.displayName || null,
                };
                const insertResult = await userProfilesCollection.insertOne(newUserProfileData);
                userProfileDoc = {
                    ...newUserProfileData,
                    _id: insertResult.insertedId,
                } as UserProfile & {_id: ObjectId};
                 console.log(`GET /api/user/profile: New profile created for UID ${firebaseUID} with ID ${userProfileDoc._id}.`);
            } else {
                 console.log(`GET /api/user/profile: Found profile for UID ${firebaseUID}.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { _id, ...profileData } = userProfileDoc as any;
            res.json(profileData);
        } catch (error) {
            console.error(`Error in GET /api/user/profile for UID ${firebaseUID}:`, error);
            res.status(500).json({ message: 'Internal server error fetching user profile.' });
        }
    });

    console.log("Defining /api/user/profile POST route...");
    app.post('/api/user/profile', async (req: AuthenticatedRequest, res: Response) => {
        console.log(`Request received for /api/user/profile POST by user: ${req.user?.uid}`);
        const firebaseUID = req.user?.uid;
        if (!firebaseUID) {
            return res.status(403).json({ message: 'User UID not found in token.' });
        }
        const { agentKey } = req.body;
        if (typeof agentKey !== 'string' && agentKey !== null) {
            return res.status(400).json({ message: 'agentKey must be a string or null.' });
        }

        try {
            const updateData: Partial<UserProfile> = {
                agentKey: agentKey,
                email: req.user?.email || '', // ensure email is updated if it changed in Firebase
                displayName: req.user?.name || req.user?.displayName || null, // ensure name is updated
            };

            const result = await userProfilesCollection.findOneAndUpdate(
                { firebaseUID },
                { $set: updateData },
                { upsert: true, returnDocument: 'after' }
            );
            if (result) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { _id, ...profileData } = result as any;
                res.json(profileData);
            } else {
                console.error('User profile update/creation failed to return a document, which is unexpected.');
                res.status(500).json({ message: 'Failed to update or create user profile (unexpected result).' });
            }
        } catch (error) {
            console.error('Error updating user profile:', error);
            res.status(500).json({ message: 'Internal server error updating user profile.' });
        }
    });

    app.get('/api/agent-listings', async (req: AuthenticatedRequest, res: Response) => {
        const firebaseUID = req.user?.uid;
        console.log(`Request for /api/agent-listings by user: ${firebaseUID}`);
        if (!firebaseUID) {
            return res.status(403).json({ message: "User UID not found." });
        }
        try {
            const userProfile = await userProfilesCollection.findOne({ firebaseUID });
            if (!userProfile || !userProfile.agentKey) {
                console.log(`No agentKey for user ${firebaseUID}, returning empty array for agent-listings.`);
                return res.json([]);
            }
            const agentKey = userProfile.agentKey;
            const query = {
                $or: [
                    { ListAgentKey: agentKey },
                    { CoListAgentKey: agentKey }
                ]
            };
            const options: FindOptions = {
                projection: { PhotoGallery: 1, UnparsedAddress: 1, StreetName: 1, City: 1, ListPrice: 1, ListingId: 1, BedroomsTotal:1, BathroomsTotalInteger:1, BathroomsPartial:1  },
                limit: 50 // Consider making this configurable or adding pagination if lists can be very long
            };
            const listings = await listingsCollection.find(query, options).toArray();

            const mappedListings = listings.map(listingDoc => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { _id, ...listingData } = listingDoc;
              return listingData as Listing;
            });
            res.json(mappedListings);

        } catch (error) {
            console.error('Error fetching agent listings:', error);
            res.status(500).json({ message: 'Internal server error fetching agent listings.' });
        }
    });


    app.get('/api/listings/:mlsId', async (req: AuthenticatedRequest, res: Response) => {
      const { mlsId } = req.params;
      console.log(`Request for /api/listings/${mlsId} by user: ${req.user?.uid}`);
      try {
        const listing = await listingsCollection.findOne({ ListingId: mlsId });
        if (listing) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _id, ...listingData } = listing;
          res.json(listingData);
        } else {
          res.status(404).json({ message: `Listing with MLS ID ${mlsId} not found.` });
        }
      } catch (error) {
        console.error('Error fetching listing:', error);
        res.status(500).json({ message: 'Internal server error fetching listing.' });
      }
    });

    app.get('/api/agents', async (req: AuthenticatedRequest, res: Response) => {
      console.log(`Request for /api/agents by user: ${req.user?.uid}`);
      try {
        const agents = await agentsCollection.find({}).toArray();
        const mappedAgents = agents.map(agentDoc => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _id, ...rest } = agentDoc;
          return { ...rest, id: _id ? _id.toString() : undefined }; // Ensure ID is stringified if exists
        });
        res.json(mappedAgents);
      } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ message: 'Internal server error fetching agents.' });
      }
    });

    app.get('/api/teams', async (req: AuthenticatedRequest, res: Response) => {
      console.log(`Request for /api/teams by user: ${req.user?.uid}`);
      try {
        const teams = await teamsCollection.find({}).toArray();
        const mappedTeams = teams.map(teamDoc => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _id, ...rest } = teamDoc;
          return { ...rest, id: _id ? _id.toString() : undefined }; // Ensure ID is stringified
        });
        res.json(mappedTeams);
      } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ message: 'Internal server error fetching teams.' });
      }
    });

    app.post('/api/generate-instagram-description', async (req: AuthenticatedRequest, res: Response) => {
        console.log(`User ${req.user?.uid} requesting Instagram description generation.`);
        const { listing, agentName } = req.body as { listing: Listing, agentName: string | null };

        if (!listing) {
            return res.status(400).json({ message: "Listing data is required." });
        }

        const { bedBathTextFormatted, bedsForPrompt, bathsForPrompt } = getBedBathDisplayInfoForServer(listing);
        const address = listing.UnparsedAddress
            ? listing.UnparsedAddress
            : `${listing.StreetName}, ${listing.City}`;

        let propertySpecificsForPromptSegment = `*   Address: ${address}\n`;
        if (bedBathTextFormatted) { // Only add if bedBathTextFormatted is not null
            propertySpecificsForPromptSegment += `    *   Features: ${bedBathTextFormatted}\n`;
        }
        propertySpecificsForPromptSegment += `    *   Listed by: ${agentName || 'Our Dedicated Team'}`;

        const prompt = `
You are a helpful real estate marketing assistant. Your task is to generate an engaging and concise Instagram post description for the property detailed below.

Follow this structure and tone precisely:

1.  **Introduction Emoji and Question/Statement:** Start with a catchy emoji (e.g., 🏡, ✨, 🔑, 🌊) followed by an intriguing question or a bold statement to grab the reader's attention immediately.
2.  **Detailed Description:** Provide a brief but vivid description of the property, highlighting 2-3 key features or unique selling points from the "Property description from DB". Focus on what makes it special (e.g., views, finishes, lifestyle). Keep this concise.
3.  **Family and Pet Friendliness (Optional but Recommended):** If the "Property description from DB" mentions features suitable for families or pets (e.g., "Pet Friendly", "dog park", "fenced yard", "spacious rooms"), briefly highlight them. If not explicitly mentioned, you can omit this or make a general positive statement if appropriate (e.g., "A wonderful place to call home.").
4.  **Property Specifics (NO EMOJIS HERE):**
    ${propertySpecificsForPromptSegment}
5.  **Call to Action:** Encourage potential buyers to take the next step with a clear and concise call to action. Example: "Ready for a tour? Contact us today!" or "DM for details & showings!"
6.  **Hashtags:** Conclude with 5-7 relevant and effective hashtags. Include general real estate tags, location-specific tags (e.g., #${listing.City.replace(/\s+/g, '')}Living, #${listing.City.replace(/\s+/g, '')}RealEstate), and feature-specific tags if applicable.

**Property Information to Use (for your reference during generation):**

Property Address: "${address}"
Bedrooms: "${bedsForPrompt}"
Bathrooms: "${bathsForPrompt}"
Agent's Name: "${agentName || 'Our Dedicated Team'}"
City for Hashtags: "${listing.City}"
Property description from DB:
"""
${listing.PublicRemarks}
"""

**Important Instructions:**
-   **Conciseness:** Instagram posts should be easy to read. Aim for an engaging summary, not a full novel.
-   **Emoji Use:** Use emojis thoughtfully at the beginning and possibly in the detailed description for visual appeal. DO NOT use emojis in the "Property Specifics" section.
-   **Tone:** Enthusiastic, inviting, and professional.
-   **Accuracy:** Ensure the address, agent name, and other details are reflected correctly based on the "Property Information to Use" section.
-   **Bed/Bath Handling:** If "Bedrooms" or "Bathrooms" fields in "Property Information to Use" are marked as "Not specified", DO NOT include the "Features" line for bed/bath counts in the "Property Specifics" section of your output. Focus on other aspects of the property if bed/bath information is not applicable.

---
Now, generate the Instagram post for the property with Address: "${address}", City for Hashtags: "${listing.City}", "Property description from DB": "${listing.PublicRemarks}", to be listed by "${agentName || 'Our Dedicated Team'}".
${bedBathTextFormatted ? `The property has features: ${bedBathTextFormatted}.` : 'For this property, bed and bath counts are either not specified or may not be applicable (e.g., vacant land). If so, do not mention beds or baths in the "Property Specifics" section of your output.'}
`;
        try {
            console.log("Sending request to Gemini API...");
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-04-17',
                contents: prompt,
            });
            const textContent = response.text;
             console.log("Received response from Gemini API.");

            if (typeof textContent === 'string') {
                res.json({ description: textContent });
            } else {
                console.error('Gemini API response.text is undefined.');
                throw new Error('AI response was empty or malformed.');
            }
        } catch (error: any) {
            console.error("Error calling Gemini API via server:", error);
            res.status(500).json({ message: `Failed to generate description from AI: ${error.message}` });
        }
    });


    const distFrontendPath = path.join((process as any).cwd(), 'dist_frontend');
    console.log(`Serving static files from /dist_frontend mapped to path: ${distFrontendPath}`);
    app.use('/dist_frontend', express.static(distFrontendPath, {
      // Explicitly set headers for JS files to try and combat MIME type issues if Express fails.
      setHeaders: (res: NodeServerResponse, filePath: string) => {
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
      }
    }));

    const indexPath = path.join((process as any).cwd(), 'index.html');
    app.get('*', (req: ExpressRequest, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) { // API calls should not be handled by this
        return next();
      }
      // Do not log every asset request that might fall through here (e.g. favicons not present)
      // Only log if it's likely a page route
      if (!req.path.includes('.') || req.path.endsWith('.html')) {
        console.log(`Wildcard GET: Path '${req.path}' not matched by other routes or static. Serving index.html.`);
      }
      res.sendFile(indexPath, (err: Error | null) => {
        if (err) {
          console.error(`Error serving index.html for path ${req.path}:`, err);
          if (!res.headersSent) {
            const status = (err as any).status || 500;
            res.status(status).send('Error serving application.');
          }
        }
      });
    });

    // Fallback 404 for API routes not matched
    app.use('/api/*', (req: ExpressRequest, res: Response) => {
      console.log(`API Fallback 404: ${req.method} ${req.originalUrl}`);
      res.status(404).json({ message: `API endpoint not found: ${req.method} ${req.originalUrl}` });
    });

    const errorHandler: ErrorRequestHandler = (err: any, req: ExpressRequest, res: Response, next: NextFunction) => {
      console.error("Unhandled error in errorHandler:", err.stack || err);
      if (res.headersSent) {
        return next(err);
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
    console.error(`Server startup failed:`, err);
    (process as any).exit(1);
  }
}

connectAndStartServer();
    