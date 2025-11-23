import { google } from 'googleapis';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Google API credentials will need to be supplied
// We'll use environment variables for these
const GOOGLE_API_CREDENTIALS = process.env.GOOGLE_API_CREDENTIALS;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '873147414857-7ffaa2b8llanf1lgul0ntorkqq';
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '1jYUTEaN7Nup_ShvU3plj7RKaedppxuyx'; // ID of "Client Photos" folder
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1-xeX82TPoxxeyWXoCEXh-TdMkBHuJSXjoUSaiFjfv9g'; // Your knowledge base spreadsheet ID
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'cleanmachinetulsa@gmail.com';
const GOOGLE_PLACE_ID = process.env.GOOGLE_PLACE_ID || ''; // Clean Machine Mobile Auto Detail Place ID - to be configured

// Log API key status for debugging
console.log('Google API key available:', !!GOOGLE_API_KEY);

// Configuration for Google Sheets customer data
// Name of the sheet containing customer data 
// Note: This must match exactly the sheet name in the Google Sheet
const CUSTOMER_SHEET_NAME = 'Customer Information'; // This is the expected tab name for customer profiles
const PHOTO_FOLDER_COLUMN = 'H'; // Column where photo folder links are stored

// Create temporary directory for photo downloads
const TEMP_DIR = path.join(os.tmpdir(), 'clean-machine-photos');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Initialize Google APIs
let drive: any = null;
let sheets: any = null;
let authClient: any = null;  // Store the auth client for other services to use

// Memoized Google Sheets clients by scope
const sheetsClientCache: Map<string, any> = new Map();

/**
 * Centralized Google Sheets client factory with scope-based caching
 * Implements least-privilege by providing separate read/write clients
 */
async function ensureSheetsClient(scopeKey: string, scopes: string[]) {
  // Return cached client if available
  if (sheetsClientCache.has(scopeKey)) {
    return sheetsClientCache.get(scopeKey);
  }

  try {
    if (!GOOGLE_API_CREDENTIALS) {
      console.error('[SHEETS CLIENT] Google API credentials not configured');
      return null;
    }

    const credentials = JSON.parse(GOOGLE_API_CREDENTIALS);
    
    if (!credentials.client_email || !credentials.private_key) {
      console.error('[SHEETS CLIENT] Invalid credentials structure');
      return null;
    }

    // Create scoped JWT auth client
    const auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      scopes
    );

    // Create and cache the sheets client
    const client = google.sheets({ version: 'v4', auth });
    sheetsClientCache.set(scopeKey, client);
    
    console.log(`[SHEETS CLIENT] Initialized ${scopeKey} client with scopes:`, scopes);
    return client;
  } catch (error) {
    console.error(`[SHEETS CLIENT] Failed to create ${scopeKey} client:`, error);
    return null;
  }
}

/**
 * Get read-only Google Sheets client (least-privilege for pricing queries, analytics, etc.)
 */
export async function getGoogleSheetsReadClient() {
  return ensureSheetsClient('readonly', ['https://www.googleapis.com/auth/spreadsheets.readonly']);
}

/**
 * Get read-write Google Sheets client (for dashboard service updates, admin operations)
 */
export async function getGoogleSheetsWriteClient() {
  return ensureSheetsClient('write', ['https://www.googleapis.com/auth/spreadsheets']);
}

// Function to get access to the drive client for testing

/**
 * Get photos from Google Business Profile using Places API
 * Fetches real-time photos from your Google Business listing
 */
export async function getGoogleBusinessPhotos(placeId?: string) {
  try {
    const placeIdToUse = placeId || GOOGLE_PLACE_ID;
    
    if (!GOOGLE_API_KEY) {
      console.error('Google API key not configured for photos');
      return [];
    }

    if (!placeIdToUse) {
      console.warn('Google Place ID not provided for photos');
      return [];
    }

    // Use Google Places API to fetch place details including photos
    const url = `https://places.googleapis.com/v1/places/${placeIdToUse}`;
    
    console.log('Fetching business photos from Google Places API');
    
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'photos,displayName'
      }
    });

    if (response.status !== 200) {
      throw new Error(`Google Places API error: ${response.statusText}`);
    }

    const data = response.data;
    
    // Transform Google Places photos to match expected format
    const photos = (data.photos || []).map((photo: any, index: number) => ({
      id: `google_photo_${index}`,
      name: photo.authorAttributions?.[0]?.displayName || `Photo ${index + 1}`,
      photoUrl: `https://places.googleapis.com/v1/${photo.name}/media?key=${GOOGLE_API_KEY}&maxWidthPx=1200`,
      thumbnailUrl: `https://places.googleapis.com/v1/${photo.name}/media?key=${GOOGLE_API_KEY}&maxWidthPx=400`,
      highResUrl: `https://places.googleapis.com/v1/${photo.name}/media?key=${GOOGLE_API_KEY}&maxWidthPx=2400`,
      width: photo.widthPx || 800,
      height: photo.heightPx || 600
    }));

    console.log(`Found ${photos.length} photos from Google Business Profile`);
    
    return photos;
  } catch (error: any) {
    console.error('Error fetching Google Business photos:', error.message);
    // Fall back to Drive photos if API fails
    return getGooglePlacePhotos();
  }
}

/**
 * Get photos from Google Drive gallery folder (fallback)
 */
export async function getGooglePlacePhotos() {
  try {
    await initializeGoogleAPIs();
    
    if (!drive) {
      console.warn('Google Drive not initialized, returning empty photos');
      return [];
    }

    // Your gallery folder ID from the Drive link
    const galleryFolderId = '1WWPxctO5df2NWldYYh6dhWurEYenoFiZ';
    
    console.log('Fetching photos from Google Drive gallery folder');
    
    // Get all image files from the gallery folder
    const response = await drive.files.list({
      q: `'${galleryFolderId}' in parents and (mimeType contains 'image/' or name contains '.jpg' or name contains '.jpeg' or name contains '.png' or name contains '.webp')`,
      fields: 'files(id, name, mimeType, size, modifiedTime, imageMediaMetadata)',
      orderBy: 'modifiedTime desc' // Latest photos first, then we'll sort by quality
    });

    const files = response.data.files || [];
    console.log(`Found ${files.length} photos in gallery folder`);

    if (files.length === 0) {
      return [];
    }

    // Convert files to photo objects and sort by quality (file size as proxy for quality)
    const photos = files
      .filter((file: any) => file.id && file.name)
      .map((file: any) => ({
        id: file.id,
        name: file.name,
        photoUrl: `https://drive.google.com/uc?id=${file.id}&export=view`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w400-h300`,
        highResUrl: `https://drive.google.com/uc?id=${file.id}&export=download`,
        mimeType: file.mimeType,
        size: parseInt(file.size) || 0,
        lastModified: file.modifiedTime,
        width: file.imageMediaMetadata?.width || 800,
        height: file.imageMediaMetadata?.height || 600
      }))
      // Sort by file size (higher quality first) then by modification date
      .sort((a: any, b: any) => {
        // First priority: larger files (better quality)
        if (b.size !== a.size) {
          return b.size - a.size;
        }
        // Second priority: newer files
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      });

    console.log(`Processed ${photos.length} gallery photos, sorted by quality and date`);
    return photos;
    
  } catch (error) {
    console.error('Error fetching Google Drive gallery photos:', error);
    return [];
  }
}

/**
 * Get Google Reviews for the business using Google Places API
 * Fetches real-time reviews from your Google Business Profile
 */
export async function getGoogleReviews(placeId?: string) {
  try {
    // Use parameter, environment variable, or default Place ID
    const placeIdToUse = placeId || GOOGLE_PLACE_ID;
    
    if (!GOOGLE_API_KEY) {
      console.error('[GOOGLE REVIEWS] API key not configured');
      throw new Error('Google API key is required to fetch reviews');
    }

    if (!placeIdToUse) {
      console.warn('[GOOGLE REVIEWS] Place ID not provided - returning empty array');
      return [];
    }

    // Use Google Places API (New) to fetch place details including reviews
    const url = `https://places.googleapis.com/v1/places/${placeIdToUse}`;
    
    console.log(`[GOOGLE REVIEWS] Fetching reviews for Place ID: ${placeIdToUse}`);
    console.log(`[GOOGLE REVIEWS] API endpoint: ${url}`);
    
    // Google Places API v1 requires NESTED field masks for review data
    // Reference: https://developers.google.com/maps/documentation/places/web-service/choose-fields
    const fieldMask = [
      'id',
      'displayName',
      'rating',
      'userRatingCount',
      'reviews',
      'reviews.authorAttribution',
      'reviews.authorAttribution.displayName',
      'reviews.authorAttribution.uri',
      'reviews.authorAttribution.photoUri',
      'reviews.rating',
      'reviews.text',
      'reviews.text.text',
      'reviews.originalText',
      'reviews.originalText.text',
      'reviews.publishTime',
      'reviews.relativePublishTimeDescription'
    ].join(',');
    
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': fieldMask
      }
    });

    if (response.status !== 200) {
      throw new Error(`Google Places API error: ${response.statusText}`);
    }

    const data = response.data;
    console.log(`[GOOGLE REVIEWS] ✅ Success - Status: ${response.status}`);
    console.log(`[GOOGLE REVIEWS] Business: ${data.displayName?.text || 'Unknown'}`);
    console.log(`[GOOGLE REVIEWS] Rating: ${data.rating || 'N/A'} (${data.userRatingCount || 0} total reviews)`);

    // Transform Google Places API reviews to match expected format
    const reviews = (data.reviews || []).map((review: any) => ({
      author_name: review.authorAttribution?.displayName || 'Anonymous',
      author_url: review.authorAttribution?.uri || '',
      profile_photo_url: review.authorAttribution?.photoUri || '',
      rating: review.rating || 5,
      text: review.text?.text || review.originalText?.text || '',
      time: new Date(review.publishTime).getTime() / 1000, // Convert to Unix timestamp
      relative_time_description: review.relativePublishTimeDescription || ''
    }));

    console.log(`[GOOGLE REVIEWS] ✅ Found ${reviews.length} reviews`);
    
    return reviews;
  } catch (error: any) {
    // Enhanced error logging for debugging
    if (error.response) {
      console.error('[GOOGLE REVIEWS] ❌ API Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        placeId: placeId || GOOGLE_PLACE_ID
      });
      
      if (error.response.status === 404) {
        console.error('[GOOGLE REVIEWS] ❌ 404 NOT FOUND - The GOOGLE_PLACE_ID secret is likely incorrect.');
        console.error('[GOOGLE REVIEWS] Current Place ID:', placeId || GOOGLE_PLACE_ID);
        console.error('[GOOGLE REVIEWS] To fix: Update the GOOGLE_PLACE_ID secret with the correct Place ID from Google Business Profile');
      } else if (error.response.status === 400) {
        console.error('[GOOGLE REVIEWS] ❌ 400 BAD REQUEST - Invalid API key or Place ID format');
      }
    } else {
      console.error('[GOOGLE REVIEWS] ❌ Network/Unknown Error:', error.message);
    }
    
    // Log to critical monitoring for owner notification
    try {
      const { logError } = await import('./errorMonitoring');
      await logError({
        type: 'external_api',
        severity: 'medium',
        message: `Google Reviews API failure: ${error.message}`,
        endpoint: '/api/google-reviews',
        metadata: {
          placeId: placeId || GOOGLE_PLACE_ID,
          status: error.response?.status,
          errorDetails: error.response?.data
        }
      });
    } catch (logErr) {
      console.error('[GOOGLE REVIEWS] Failed to log error to monitoring:', logErr);
    }
    
    // Return empty array so homepage doesn't break
    console.log('[GOOGLE REVIEWS] Returning empty array as fallback');
    return [];
  }
}
export function getDriveClient() {
  return drive;
}

// Function to get the sheets client (with write permissions)
export function getSheetsClient() {
  return sheets;
}

// Function to get the auth client
export function getAuthClient() {
  if (authClient) {
    return authClient;
  }
  
  try {
    // Check if we have proper credentials JSON
    if (GOOGLE_API_CREDENTIALS) {
      console.log('Creating auth client from credentials JSON');
      try {
        // Parse credentials from environment variable
        const credentials = JSON.parse(GOOGLE_API_CREDENTIALS);
        
        // Fix private key line breaks - this is the common issue with env vars
        let privateKey = credentials.private_key;
        if (privateKey && !privateKey.includes('\n')) {
          // Replace literal \n with actual line breaks
          privateKey = privateKey.replace(/\\n/g, '\n');
        }
        
        // Create JWT auth client with proper scopes
        const auth = new google.auth.JWT(
          credentials.client_email,
          undefined,
          privateKey,
          [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets'
          ]
        );
        
        // Immediately authenticate to verify credentials work
        auth.authorize((err: any) => {
          if (err) {
            console.error('Error authorizing with Google credentials:', err);
          } else {
            console.log('Successfully authorized with Google credentials');
          }
        });
        
        authClient = auth;
        return authClient;
      } catch (err) {
        console.error('Error parsing Google API credentials:', err);
      }
    }
    
    console.warn('No Google credentials available');
    return null;
  } catch (error) {
    console.error('Error creating Google auth client:', error);
    return null;
  }
}

/**
 * Initialize Google API clients
 */
export async function initializeGoogleAPIs() {
  try {
    // Try loading from environment variable first
    if (!GOOGLE_API_CREDENTIALS) {
      console.warn('Google API credentials not found in environment variables');
      return false; // Exit early if no credentials available
    }

    // Parse credentials from environment variable (should be a JSON string)
    const credentials = JSON.parse(GOOGLE_API_CREDENTIALS);

    // Set up OAuth client with expanded scopes to include calendar
    const auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      [
        'https://www.googleapis.com/auth/drive', 
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar'
      ]
    );

    // Initialize services
    drive = google.drive({ version: 'v3', auth });
    sheets = google.sheets({ version: 'v4', auth });
    
    // Store auth client for other services to use
    authClient = auth;
    
    // Verify authentication works
    await auth.authorize();
    
    // Initialize calendar API
    try {
      // Use dynamic import instead of require for ESM compatibility
      const scheduling = await import('./scheduling');
      if (scheduling.initializeCalendarAPI) {
        scheduling.initializeCalendarAPI(auth);
      }
    } catch (error) {
      console.warn('Could not initialize calendar API:', error);
      // Continue anyway as this is not critical for the main functionality
    }

    console.log('Successfully initialized Google APIs from environment variables');
    return true;
  } catch (error) {
    console.error('Error initializing Google APIs:', error);
    return false;
  }
}

/**
 * Download a photo from a URL to a temporary location
 */
export async function downloadPhoto(url: string, customerName: string): Promise<string | null> {
  try {
    // Create a sanitized file name
    const sanitizedName = sanitizeName(customerName || 'unknown');
    const timestamp = Date.now();
    const fileName = `${sanitizedName}_${timestamp}.jpg`;
    const filePath = path.join(TEMP_DIR, fileName);

    // Handle file:// protocol specially (for uploads from the server)
    if (url.startsWith('file://')) {
      const localPath = url.replace('file://', '');
      // Simply copy the file instead of downloading it
      fs.copyFileSync(localPath, filePath);
      return filePath;
    }

    // Download from HTTP/HTTPS URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Download the file
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
      });

      // Save the file to disk
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });
    }

    throw new Error(`Unsupported URL protocol: ${url}`);
  } catch (error) {
    console.error('Error downloading photo:', error);
    return null;
  }
}

interface DriveFolder {
  folderId: string;
  folderLink: string;
}

interface CustomerInfo {
  id: string;
  name: string;
  rowIndex: number; // 1-indexed spreadsheet row
}

interface UploadResult {
  fileId: string;
  fileLink: string;
  folderLink: string;
}

/**
 * Sanitize name for use in folder names
 */
function sanitizeName(name: string): string {
  // Remove special characters, replace spaces with underscores
  return name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
}

/**
 * Find or create a customer folder in Google Drive
 */
export async function findOrCreateCustomerFolder(customerName: string, vehicleInfo: string = '', phoneNumber: string = ''): Promise<DriveFolder | null> {
  if (!drive || !GOOGLE_DRIVE_FOLDER_ID) {
    console.warn('Google Drive not initialized or parent folder ID not set');
    return createLocalFolderReference(customerName, vehicleInfo, phoneNumber);
  }

  try {
    // Prefer customer name, but fall back to phone number if name is not provided
    const baseIdentifier = customerName.trim() ? 
      sanitizeName(customerName) : 
      (phoneNumber ? sanitizeName(phoneNumber) : `customer_${Date.now()}`);

    // Add vehicle info if available
    const vehiclePart = vehicleInfo.trim() ? `_${sanitizeName(vehicleInfo)}` : '';

    // Create a folder name with today's date for better organization
    const today = new Date();
    const datePart = `_${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}`;

    // Combine parts to create folder name
    const folderName = `${baseIdentifier}${vehiclePart}${datePart}`;

    // Try to find existing folders - with error handling
    let existingFolders = [];
    try {
      // First check if we already have a folder for this customer by searching more broadly
      // This helps when customer info (like vehicle) changes between submissions
      const customerFolderQuery = {
        q: `name contains '${baseIdentifier}' and mimeType='application/vnd.google-apps.folder' and '${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
        fields: 'files(id, name, webViewLink)',
        orderBy: 'modifiedTime desc'
      };

      const customerFolderResponse = await drive.files.list(customerFolderQuery);
      if (customerFolderResponse.data.files) {
        existingFolders = customerFolderResponse.data.files;
      }
    } catch (searchError) {
      console.error('Error searching for existing folder:', searchError);
      console.log('Will try to create a new folder instead');
      // Continue with folder creation even if search fails
    }

    let folderId: string;
    let folderLink: string;

    if (existingFolders.length > 0) {
      // Use the most recently modified folder for this customer
      folderId = existingFolders[0].id;
      folderLink = existingFolders[0].webViewLink;
      console.log(`Found existing folder for ${baseIdentifier}: ${folderLink}`);
    } else {
      try {
        // Create a new folder
        const folderMetadata = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [GOOGLE_DRIVE_FOLDER_ID]
        };

        const folder = await drive.files.create({
          resource: folderMetadata,
          fields: 'id, webViewLink'
        });

        folderId = folder.data.id;
        folderLink = folder.data.webViewLink;
        console.log(`Created new folder for ${baseIdentifier}: ${folderLink}`);

        // Set folder permissions to be accessible with the link
        try {
          console.log(`Attempting to set permissions for folder with ID: ${folderId}`);
          // The method below is failing. Let's try an alternative approach:
          // Use a service-wide API key for public access instead of per-file permissions

          // First let's verify the folder exists
          const folderCheck = await drive.files.get({
            fileId: folderId,
            fields: 'id, name'
          });

          if (folderCheck && folderCheck.data && folderCheck.data.id) {
            console.log(`Folder exists and is accessible: ${folderCheck.data.name}`);

            await drive.permissions.create({
              fileId: folderId,
              requestBody: {
                role: 'reader',
                type: 'anyone',
                allowFileDiscovery: false
              }
            });
            console.log(`Set permissions for folder ${folderId} to be accessible via link`);
          } else {
            console.error('Folder not accessible or does not exist');
          }
        } catch (permError: any) {
          console.error('Failed to set folder permissions:', permError.message);
          // Continue anyway, we can still use the folder
        }
      } catch (createError) {
        console.error('Error creating folder in Google Drive:', createError);
        // Fall back to local reference
        return createLocalFolderReference(customerName, vehicleInfo, phoneNumber);
      }
    }

    return { folderId, folderLink };
  } catch (error) {
    console.error('Error finding/creating customer folder:', error);
    // Fall back to local reference if Google Drive fails
    return createLocalFolderReference(customerName, vehicleInfo, phoneNumber);
  }
}

/**
 * Create a local folder reference when Google Drive fails
 * This allows the app to continue working even if Google Drive access fails
 */
function createLocalFolderReference(customerName: string, vehicleInfo: string = '', phoneNumber: string = ''): DriveFolder {
  console.log('Creating local folder reference as Google Drive fallback');

  // Generate a unique ID for this customer
  const customerId = Date.now().toString(36) + Math.random().toString(36).substring(2);

  // Create a meaningful folder name for reference
  const baseId = customerName.trim() ? 
    sanitizeName(customerName) : 
    (phoneNumber ? sanitizeName(phoneNumber) : `customer_${Date.now()}`);

  const vehiclePart = vehicleInfo.trim() ? `_${sanitizeName(vehicleInfo)}` : '';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  // Create a faux link to the correct parent folder
  const folderLink = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`;

  // Log this for troubleshooting
  console.log(`Created local folder reference for ${baseId}${vehiclePart}_${today} - customer will need to be manually added to Google Drive`);

  return {
    folderId: customerId,
    folderLink: folderLink
  };
}

/**
 * Upload a photo to Google Drive in a customer's folder
 */
export async function uploadPhotoToDrive(
  filePath: string, 
  customer: CustomerInfo, 
  vehicleInfo: string = '',
  phoneNumber: string = ''
): Promise<UploadResult | null> {
  try {
    // Find or create customer folder
    const folder = await findOrCreateCustomerFolder(customer.name, vehicleInfo, phoneNumber);

    if (!folder) {
      throw new Error('Could not find or create customer folder');
    }

    const { folderId, folderLink } = folder;

    // Create a sanitized filename using customer info and timestamp
    const fileExt = path.extname(filePath) || '.jpg'; // Default to .jpg if no extension
    const timestamp = new Date().toISOString().replace(/[\W_]+/g, '').slice(0, 14);
    const sanitizedName = sanitizeName(customer.name || phoneNumber || 'customer');
    const fileName = `${sanitizedName}_${timestamp}${fileExt}`;

    // If we're using local reference, create a local file record and return link to parent folder
    if (!drive || !GOOGLE_DRIVE_FOLDER_ID) {
      console.log('Google Drive not available - saving local file reference');

      try {
        // Copy the file to a more permanent local location (if needed)
        // For now, we'll just create a reference to the parent folder

        // Update customer info in spreadsheet with folder link if possible
        try {
          await updateCustomerPhotoInfo(customer, folderLink);
        } catch (updateError) {
          console.error('Error updating customer photo info in spreadsheet:', updateError);
          // Continue anyway
        }

        // Clean up temporary file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Return success with folder link
        return {
          fileId: `local_${Date.now()}`,
          fileLink: folderLink,
          folderLink
        };
      } catch (localError) {
        console.error('Error creating local file reference:', localError);
        throw localError;
      }
    }

    // If we have Google Drive access, continue with the normal upload process
    // Set content type based on file extension
    let contentType = 'image/jpeg'; // Default
    if (fileExt.toLowerCase() === '.png') contentType = 'image/png';
    if (fileExt.toLowerCase() === '.gif') contentType = 'image/gif';

    try {
      // Upload the file
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
        description: `Photo uploaded by ${customer.name || phoneNumber} on ${new Date().toLocaleString()}`
      };

      const media = {
        mimeType: contentType,
        body: fs.createReadStream(filePath)
      };

      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      console.log(`Uploaded photo ${fileName} to folder: ${folderLink}`);

      // Set file permissions to be accessible with the link
      try {
        if (file && file.data && file.data.id) {
          console.log(`Attempting to set permissions for file with ID: ${file.data.id}`);
          await drive.permissions.create({
            fileId: file.data.id,
            requestBody: {
              role: 'reader',
              type: 'anyone',
              allowFileDiscovery: false
            }
          });
          console.log(`Set permissions for file ${file.data.id} to be accessible via link`);
        } else {
          console.error('Cannot set permissions - file ID is missing or invalid');
        }
      } catch (permError) {
        console.error('Failed to set file permissions:', permError);
        // Continue anyway, we can still use the file
      }

      // Update customer info in spreadsheet with folder link
      await updateCustomerPhotoInfo(customer, folderLink);

      // Clean up temporary file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return {
        fileId: file.data.id,
        fileLink: file.data.webViewLink,
        folderLink
      };
    } catch (uploadError) {
      console.error('Error during upload to Google Drive:', uploadError);

      // Fall back to the local file approach
      console.log('Falling back to local file reference');

      try {
        // Update customer info with folder link
        await updateCustomerPhotoInfo(customer, folderLink);

        // Clean up temporary file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Return success with folder link
        return {
          fileId: `local_${Date.now()}`,
          fileLink: folderLink, 
          folderLink
        };
      } catch (fallbackError) {
        console.error('Error in fallback photo handling:', fallbackError);
        throw fallbackError;
      }
    }
  } catch (error) {
    console.error('Error uploading photo to Drive:', error);
    return null;
  }
}

/**
 * Ensure the Customer Database sheet exists in the spreadsheet
 * This sheet is used to track customer history and service records
 */
export async function ensureCustomerDatabaseExists(): Promise<boolean> {
  if (!sheets || !GOOGLE_SHEET_ID) {
    console.warn('Google Sheets not initialized or spreadsheet ID not set');
    return false;
  }

  try {
    // Check if the spreadsheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID
    });

    // Check if the Customer Database sheet already exists
    const customerDbSheetName = 'Customer Database';
    let sheetExists = false;

    if (spreadsheet.data.sheets) {
      for (const sheet of spreadsheet.data.sheets) {
        if (sheet.properties && sheet.properties.title === customerDbSheetName) {
          sheetExists = true;
          console.log(`Found existing ${customerDbSheetName} sheet`);
          break;
        }
      }
    }

    // If the sheet doesn't exist, create it
    if (!sheetExists) {
      console.log(`Creating new ${customerDbSheetName} sheet`);
      
      // Add the sheet to the spreadsheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: customerDbSheetName
                }
              }
            }
          ]
        }
      });

      // Initialize the sheet with headers
      const headers = [
        'Phone Number', 'Name', 'Email', 'Vehicle Info', 
        'Address', 'Last Service Date', 'Services History', 
        'Photo Folder', 'Notes', 'Created At', 'Updated At',
        'Loyalty Points', 'Loyalty Tier', 'Last Invoice Date', 'SMS Consent'
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${customerDbSheetName}!A1:O1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });

      // Format the header row
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEET_ID,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: spreadsheet.data.sheets?.length || 0,
                  startRowIndex: 0,
                  endRowIndex: 1
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true
                    },
                    backgroundColor: {
                      red: 0.8,
                      green: 0.8,
                      blue: 0.8
                    }
                  }
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)'
              }
            }
          ]
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Error ensuring Customer Database sheet exists:', error);
    return false;
  }
}

/**
 * Find a customer in the spreadsheet, or add them if not found
 */
export async function findOrAddCustomer(
  phone: string, 
  name: string = '', 
  vehicleInfo: string = '',
  email: string = ''
): Promise<CustomerInfo | null> {
  if (!sheets || !GOOGLE_SHEET_ID) {
    console.warn('Google Sheets not initialized or spreadsheet ID not set');
    return null;
  }

  try {
    // Normalize phone number - remove non-digits
    const normalizedPhone = phone.replace(/\D/g, '');

    // First, check if the Customer Information sheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID
    });

    // Check if our customer sheet exists
    const sheetExists = spreadsheet.data.sheets.some(
      (sheet: any) => sheet.properties.title === CUSTOMER_SHEET_NAME
    );

    // If it doesn't exist, create it with appropriate headers
    if (!sheetExists) {
      console.log(`Creating new sheet: ${CUSTOMER_SHEET_NAME}`);

      // Add the sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: CUSTOMER_SHEET_NAME
              }
            }
          }]
        }
      });

      // Add headers to the new sheet
      const headers = ['Customer ID', 'Phone', 'Name', 'Vehicle Info', 'Email', 'Last Contact', 'Notes', 'Photo Folder'];
      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${CUSTOMER_SHEET_NAME}!A1:H1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers]
        }
      });

      console.log(`Created ${CUSTOMER_SHEET_NAME} sheet with headers`);

      // Now populate it with existing customer data from SMS Knowledge Base
      try {
        console.log('Importing existing customer data from SMS Knowledge Base...');

        // Get data from SMS Knowledge Base
        const { DEFAULT_KB_TAB_NAMES } = await import('./ai/knowledgeBaseDefaults');
        const smsRange = `${DEFAULT_KB_TAB_NAMES.smsKnowledgeBase}!A1:Z1000`;
        const smsResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: smsRange
        });

        const smsRows = smsResponse.data.values || [];
        if (smsRows.length > 0) {
          const smsHeaders = smsRows[0]; // First row contains headers

          // Find relevant column indexes from SMS Knowledge Base
          const phoneColIndex = smsHeaders.findIndex((col: string) => 
            col && (col.toLowerCase().includes('phone')));
          const nameColIndex = smsHeaders.findIndex((col: string) => 
            col && (col.toLowerCase().includes('name') || col.toLowerCase().includes('customer')));
          const vehicleColIndex = smsHeaders.findIndex((col: string) => 
            col && (col.toLowerCase().includes('vehicle') || col.toLowerCase().includes('car')));
          const emailColIndex = smsHeaders.findIndex((col: string) => 
            col && col.toLowerCase().includes('email'));
          const addressColIndex = smsHeaders.findIndex((col: string) => 
            col && col.toLowerCase().includes('address'));
          const serviceColIndex = smsHeaders.findIndex((col: string) => 
            col && col.toLowerCase().includes('service'));
          const notesColIndex = smsHeaders.findIndex((col: string) => 
            col && col.toLowerCase().includes('notes'));
          const dateColIndex = smsHeaders.findIndex((col: string) => 
            col && (col.toLowerCase().includes('date') || col.toLowerCase().includes('contact')));

          // Prepare customer records to import, keyed by phone number to avoid duplicates
          const customerMap = new Map<string, string[]>();

          // Process all rows except header
          for (let i = 1; i < smsRows.length; i++) {
            const row = smsRows[i];
            if (!row || row.length === 0) continue;

            let phone = phoneColIndex >= 0 && row[phoneColIndex] ? row[phoneColIndex].toString().replace(/\D/g, '') : '';
            if (!phone) continue; // Skip if no phone number

            // Gather all customer information
            const customerId = `C${Math.floor(100000 + Math.random() * 900000)}`; // Generate a unique customer ID
            const name = nameColIndex >= 0 && row[nameColIndex] ? row[nameColIndex].toString() : '';
            const vehicleInfo = vehicleColIndex >= 0 && row[vehicleColIndex] ? row[vehicleColIndex].toString() : '';
            const email = emailColIndex >= 0 && row[emailColIndex] ? row[emailColIndex].toString() : '';

            // Combine address, service, and notes for the notes field
            let notes = '';
            if (addressColIndex >= 0 && row[addressColIndex]) notes += `Address: ${row[addressColIndex]}\n`;
            if (serviceColIndex >= 0 && row[serviceColIndex]) notes += `Service: ${row[serviceColIndex]}\n`;
            if (notesColIndex >= 0 && row[notesColIndex]) notes += `Notes: ${row[notesColIndex]}\n`;

            const lastContact = dateColIndex >= 0 && row[dateColIndex] ? row[dateColIndex].toString() : '';

            // Only add if we don't already have this customer or if this has more data
            const existing = customerMap.get(phone);
            if (!customerMap.has(phone) || (existing && name && !existing[2])) {
              customerMap.set(phone, [
                customerId,
                phone,
                name,
                vehicleInfo,
                email,
                lastContact,
                notes,
                '' // Empty photo folder link
              ]);
            }
          }

          // Convert map to array of customer rows
          const customerRows = Array.from(customerMap.values());

          if (customerRows.length > 0) {
            // Add all customers to the new sheet
            await sheets.spreadsheets.values.update({
              spreadsheetId: GOOGLE_SHEET_ID,
              range: `${CUSTOMER_SHEET_NAME}!A2:H${customerRows.length + 1}`,
              valueInputOption: 'RAW',
              resource: {
                values: customerRows
              }
            });

            console.log(`Imported ${customerRows.length} customers from SMS Knowledge Base`);
          }
        }
      } catch (importError) {
        console.error('Error importing existing customer data:', importError);
        // Continue with regular flow even if import fails
      }
    }

    // Look for customer in the sheet we're using for customer data
    const range = `${CUSTOMER_SHEET_NAME}!A1:Z1000`; // Get all customer data
    console.log(`Looking for customer data in sheet: ${CUSTOMER_SHEET_NAME}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: range
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.error('No data found in customer sheet');
      return null;
    }

    const headerRow = rows[0]; // First row contains headers
    console.log('Header row in sheet:', headerRow);

    // Find column indexes - more flexible for SMS Knowledge Base sheet
    const phoneColIndex = headerRow.findIndex((col: string) => 
      col && col.toLowerCase().includes('phone'));

    // We'll use phone number as ID if no ID column exists
    let idColIndex = headerRow.findIndex((col: string) => 
      col && (col.toLowerCase().includes('id') || col.toLowerCase() === 'customer id'));

    // The SMS Knowledge Base sheet might not have all the expected columns, so we need to be flexible
    const nameColIndex = headerRow.findIndex((col: string) => 
      col && (col.toLowerCase().includes('name') || col.toLowerCase().includes('customer')));
    const vehicleColIndex = headerRow.findIndex((col: string) => 
      col && (col.toLowerCase().includes('vehicle') || col.toLowerCase().includes('car')));
    const emailColIndex = headerRow.findIndex((col: string) => 
      col && col.toLowerCase().includes('email'));

    // We'll use a fixed column for photo folder if none exists
    let photoFolderColIndex = headerRow.findIndex((col: string) => 
      col && col.toLowerCase().includes('photo') && col.toLowerCase().includes('folder'));

    console.log('Column indexes found:', {
      phone: phoneColIndex,
      id: idColIndex,
      name: nameColIndex,
      vehicle: vehicleColIndex,
      email: emailColIndex,
      photoFolder: photoFolderColIndex
    });

    // If no phone column found, we can't proceed
    if (phoneColIndex === -1) {
      throw new Error('Could not find Phone column in the spreadsheet');
    }

    // If no ID column, we'll just use the phone number as ID
    if (idColIndex === -1) {
      console.log('No ID column found, using Phone column as ID');
      idColIndex = phoneColIndex;
    }

    // If no photo folder column, we'll use a fixed column index
    if (photoFolderColIndex === -1) {
      photoFolderColIndex = Math.min(headerRow.length, 7); // Use column H (index 7) or the last column
      console.log(`No Photo Folder column found, using column index ${photoFolderColIndex}`);
    }

    // Find customer row by phone number, name, or email (in that order of priority)
    let rowIndex = -1;
    let customerId: string | null = null;
    let customerName = name;
    let rowData: any[] = [];

    // First try exact phone match
    if (normalizedPhone) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[phoneColIndex]) {
          const rowPhone = row[phoneColIndex].replace(/\D/g, '');
          if (rowPhone === normalizedPhone) {
            rowIndex = i;
            rowData = row;
            customerId = row[idColIndex];
            if (!customerName && row[nameColIndex]) {
              customerName = row[nameColIndex];
            }
            break;
          }
        }
      }
    }

    // If no match by phone, try name match if provided
    if (rowIndex === -1 && name) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[nameColIndex] && row[nameColIndex].toLowerCase() === name.toLowerCase()) {
          rowIndex = i;
          rowData = row;
          customerId = row[idColIndex];
          break;
        }
      }
    }

    // If still no match, try email match if provided
    if (rowIndex === -1 && email && emailColIndex !== -1) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[emailColIndex] && row[emailColIndex].toLowerCase() === email.toLowerCase()) {
          rowIndex = i;
          rowData = row;
          customerId = row[idColIndex];
          if (!customerName && row[nameColIndex]) {
            customerName = row[nameColIndex];
          }
          break;
        }
      }
    }

    // If customer not found, add them
    if (rowIndex === -1) {
      // Generate a new customer ID
      customerId = `C${Date.now().toString().slice(-6)}`;

      // Prepare the new customer row
      const newRow: any[] = [];

      // Fill in each column according to the header
      for (let i = 0; i < headerRow.length; i++) {
        if (i === idColIndex) {
          newRow[i] = customerId;
        } 
        else if (i === nameColIndex) {
          newRow[i] = customerName || 'New Customer';
        }
        else if (i === phoneColIndex) {
          newRow[i] = phone;
        }
        else if (i === vehicleColIndex && vehicleInfo) {
          newRow[i] = vehicleInfo;
        }
        else if (i === emailColIndex && email) {
          newRow[i] = email;
        }
        else {
          newRow[i] = ''; // Empty value for other columns
        }
      }

      // Add customer to spreadsheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${CUSTOMER_SHEET_NAME}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [newRow]
        }
      });

      rowIndex = rows.length; // New row will be at the end
      console.log(`Added new customer: ${customerName || 'New Customer'} (${customerId})`);
    }

    return { 
      id: customerId!, 
      name: customerName || 'Customer',
      rowIndex: rowIndex + 1 // Add 1 because spreadsheet rows are 1-indexed
    };
  } catch (error) {
    console.error('Error finding/adding customer:', error);
    return null;
  }
}

/**
 * Update the photo folder link for a customer in the spreadsheet
 */
export async function updateCustomerPhotoInfo(customer: CustomerInfo, folderLink: string): Promise<boolean> {
  if (!sheets || !GOOGLE_SHEET_ID) {
    console.warn('Google Sheets not initialized or spreadsheet ID not set');
    // Log it for manual updating later
    console.log(`MANUAL UPDATE NEEDED: Customer "${customer.name}" needs photo folder link: ${folderLink}`);
    return false;
  }

  try {
    // If we already know the exact row, we can update directly
    if (customer.rowIndex > 0) {
      // Update at the specified column (PHOTO_FOLDER_COLUMN, typically 'H')
      const updateRange = `${CUSTOMER_SHEET_NAME}!${PHOTO_FOLDER_COLUMN}${customer.rowIndex}`;

      console.log(`Updating spreadsheet at ${updateRange} with folder link`);

      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: updateRange,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [[folderLink]]
          }
        });

        console.log(`Updated photo folder link for customer ${customer.name} (${customer.id}) at row ${customer.rowIndex}`);
        return true;
      } catch (updateError) {
        console.error('Error updating spreadsheet cell:', updateError);
        // Continue to fallback approach
      }
    }

    // If rowIndex is not available, fallback to searching by ID
    try {
      console.log(`Searching for customer ${customer.id} in spreadsheet to update folder link`);
      const range = `${CUSTOMER_SHEET_NAME}!A:Z`; // Get all customer data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: range
      });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.error('No data found in customer sheet');
      return false;
    }

    const headerRow = rows[0];

    const idColIndex = headerRow.findIndex((col: string) => 
      col.toLowerCase().includes('id') || col.toLowerCase() === 'customer id');
    let photoColIndex = headerRow.findIndex((col: string) => 
      col.toLowerCase().includes('photo') && col.toLowerCase().includes('folder'));

    if (idColIndex === -1) {
      throw new Error('Could not find ID column in the spreadsheet');
    }

    // If photo folder column doesn't exist, we need to add it
    if (photoColIndex === -1) {
      // The column letter to use for the new column
      const newColLetter = String.fromCharCode(65 + headerRow.length); // A + length for next column

      // Add the column header
      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${CUSTOMER_SHEET_NAME}!${newColLetter}1`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [['Photo Folder Link']]
        }
      });

      photoColIndex = headerRow.length; // Now it's the index after the last existing column
      console.log(`Added 'Photo Folder Link' column at position ${newColLetter}`);
    }

    // Find the customer row by ID
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idColIndex] === customer.id) {
        rowIndex = i + 1; // +1 because spreadsheet rows are 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error(`Could not find customer with ID ${customer.id}`);
    }

    // Generate column letter
    const colLetter = String.fromCharCode(65 + photoColIndex); // A + index

    // Update the photo folder link
    const updateRange = `${CUSTOMER_SHEET_NAME}!${colLetter}${rowIndex}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[folderLink]]
      }
    });

    console.log(`Updated photo folder link for customer ${customer.name} (${customer.id})`);
    return true;

    } catch (searchError) {
      console.error('Error searching for customer in spreadsheet:', searchError);
      console.log(`MANUAL UPDATE NEEDED: Customer "${customer.name}" (ID: ${customer.id}) needs photo folder link: ${folderLink}`);

      // Don't let a spreadsheet error stop the process
      return true;
    }
  } catch (error) {
    console.error('Error updating customer photo info:', error);
    console.log(`MANUAL UPDATE NEEDED: Customer "${customer.name}" (ID: ${customer.id}) needs photo folder link: ${folderLink}`);

    // Return true so this doesn't prevent the whole upload process from completing
    return true;
  }
}

/**
 * Process a photo from a URL - download it and store in Google Drive
 */
export async function processCustomerPhoto(
  photoUrl: string, 
  phone: string, 
  customerName: string = '', 
  vehicleInfo: string = '',
  email: string = ''
): Promise<string | null> {
  try {
    console.log('Starting photo processing with inputs:', {
      photoUrl: photoUrl ? `${photoUrl.substring(0, 25)}...` : 'none',
      phone: phone || 'none',
      name: customerName || 'none',
      vehicle: vehicleInfo || 'none',
      email: email || 'none'
    });

    // Initialize Google APIs if needed
    if (!drive || !sheets) {
      console.log('Google APIs not initialized, initializing now...');
      const initialized = await initializeGoogleAPIs();
      if (!initialized) {
        throw new Error('Failed to initialize Google APIs');
      }
      console.log('Google APIs initialized successfully');
    }

    // Find or add the customer
    console.log('Finding or adding customer...');
    const customer = await findOrAddCustomer(phone, customerName, vehicleInfo, email);
    if (!customer) {
      throw new Error('Could not find or add customer');
    }
    console.log('Customer record found/created:', { id: customer.id, name: customer.name, rowIndex: customer.rowIndex });

    // Download the photo
    console.log('Downloading photo from:', photoUrl.substring(0, 30) + '...');
    const localFilePath = await downloadPhoto(photoUrl, customer.name);
    if (!localFilePath) {
      throw new Error('Failed to download photo');
    }
    console.log('Photo downloaded to local path:', localFilePath);

    // Upload to Google Drive
    console.log('Uploading photo to Google Drive...');
    const uploadResult = await uploadPhotoToDrive(
      localFilePath, 
      customer, 
      vehicleInfo,
      phone
    );

    if (!uploadResult) {
      throw new Error('Failed to upload photo to Google Drive');
    }

    console.log(`Successfully processed photo for ${customer.name}. Folder link: ${uploadResult.folderLink}`);
    return uploadResult.folderLink;
  } catch (error) {
    console.error('Error processing customer photo:', error);
    return null;
  }
}
async function updateCustomerSmsPreference(phone: string, enabled: boolean) {
  try {
    // Get the customer sheet
    const range = 'Customer Information!A2:Z';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range
    });

    const rows = response.data.values || [];
    
    // Find customer row
    const phoneColumn = 2; // Adjust based on your sheet structure
    const smsPreferenceColumn = 8; // Adjust based on your sheet structure
    
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][phoneColumn] === phone) {
        // Update SMS preference
        const row = i + 2; // Add 2 to account for 1-based indexing and header row
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: `Customer Information!${String.fromCharCode(65 + smsPreferenceColumn)}${row}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[enabled ? 'Yes' : 'No']]
          }
        });
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error updating SMS preference:', error);
    throw error;
  }
}
