import { google } from 'googleapis';
import { getAuthClient, getDriveClient } from './googleIntegration';
import { subMonths } from 'date-fns';

// Constants for sheet names
const CUSTOMER_DATABASE_NAME = 'Customer Database';
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

/**
 * Clean up photos older than the specified threshold period
 * @param thresholdMonths Number of months after which photos should be cleaned up (default: 6)
 */
export async function cleanupOldCustomerPhotos(thresholdMonths: number = 6): Promise<{
  success: boolean;
  deletedCount: number;
  errorCount: number;
  processedPhotos: number;
}> {
  const auth = getAuthClient();
  if (!auth) {
    console.error('Google authentication not available for photo cleanup');
    return { success: false, deletedCount: 0, errorCount: 0, processedPhotos: 0 };
  }

  const drive = getDriveClient();
  const sheets = google.sheets({ version: 'v4', auth });
  
  if (!drive || !sheets || !GOOGLE_SHEET_ID) {
    console.error('Google Drive or Sheets not initialized for photo cleanup');
    return { success: false, deletedCount: 0, errorCount: 0, processedPhotos: 0 };
  }

  let deletedCount = 0;
  let errorCount = 0;
  let processedPhotos = 0;

  try {
    // Get all customer records to find photo folders
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${CUSTOMER_DATABASE_NAME}!A1:L`
    });

    const values = response.data.values || [];
    if (values.length <= 1) {
      // Only header row or empty sheet
      console.log('No customer records found for photo cleanup');
      return { success: true, deletedCount: 0, errorCount: 0, processedPhotos: 0 };
    }

    // Extract headers from first row to find photo folder column
    const headers = values[0];
    const photoFolderIndex = headers.findIndex(header => 
      String(header).toLowerCase().includes('photo') && String(header).toLowerCase().includes('folder')
    );
    const lastContactIndex = headers.findIndex(header => 
      String(header).toLowerCase().includes('last') && String(header).toLowerCase().includes('contact')
    );

    if (photoFolderIndex === -1) {
      console.error('Could not find photo folder column in customer database');
      return { success: false, deletedCount: 0, errorCount: 0, processedPhotos: 0 };
    }

    // Calculate date threshold (6 months ago by default)
    const thresholdDate = subMonths(new Date(), thresholdMonths);
    console.log(`Cleaning up photos older than ${thresholdDate.toISOString().split('T')[0]}`);

    // Process each customer with a photo folder
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row || row.length <= photoFolderIndex) continue;

      const photoFolderUrl = row[photoFolderIndex];
      if (!photoFolderUrl) continue;

      // Extract folder ID from URL
      const folderId = extractFolderIdFromUrl(photoFolderUrl);
      if (!folderId) continue;

      // Check if we should process this folder based on last contact date
      let shouldProcess = true;
      if (lastContactIndex !== -1 && row.length > lastContactIndex) {
        const lastContactDate = parseDate(row[lastContactIndex]);
        if (lastContactDate && lastContactDate > thresholdDate) {
          // Skip if last contact is more recent than threshold
          shouldProcess = false;
        }
      }

      if (shouldProcess) {
        try {
          // List files in the folder
          const fileList = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, createdTime)',
          });

          const files = fileList.data.files || [];
          processedPhotos += files.length;

          // Process each file in the folder
          for (const file of files) {
            if (!file.id || !file.createdTime) continue;
            
            const fileCreatedDate = new Date(file.createdTime);
            
            // If file is older than threshold, delete it
            if (fileCreatedDate < thresholdDate) {
              try {
                await drive.files.delete({ fileId: file.id });
                deletedCount++;
                console.log(`Deleted old photo: ${file.name} (created: ${fileCreatedDate.toISOString()})`);
              } catch (deleteError) {
                console.error(`Error deleting photo ${file.name}:`, deleteError);
                errorCount++;
              }
            }
          }
        } catch (folderError) {
          console.error(`Error processing folder ${folderId}:`, folderError);
          errorCount++;
        }
      }
    }

    console.log(`Photo cleanup complete. Processed ${processedPhotos} photos, deleted ${deletedCount}, encountered ${errorCount} errors.`);
    return { 
      success: true, 
      deletedCount, 
      errorCount, 
      processedPhotos 
    };
  } catch (error) {
    console.error('Error during photo cleanup:', error);
    return { 
      success: false, 
      deletedCount, 
      errorCount, 
      processedPhotos 
    };
  }
}

/**
 * Helper function to extract folder ID from Google Drive URL
 */
function extractFolderIdFromUrl(url: string): string | null {
  if (!url) return null;
  
  // Extract folder ID from different possible URL formats
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,  // /folders/FOLDER_ID format
    /id=([a-zA-Z0-9_-]+)/          // id=FOLDER_ID format
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Parse date string in various formats
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try standard date parsing
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Try various date formats
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/     // YYYY-MM-DD
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        // MM/DD/YYYY
        return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
      } else {
        // YYYY-MM-DD
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      }
    }
  }
  
  return null;
}

/**
 * Schedule regular photo cleanup
 * @param intervalDays How often to run the cleanup (default: 7 days)
 */
export function schedulePhotoCleanup(intervalDays: number = 7): NodeJS.Timeout {
  console.log(`Scheduling photo cleanup to run every ${intervalDays} days`);
  
  // Run cleanup immediately once
  cleanupOldCustomerPhotos()
    .then(result => {
      console.log('Initial photo cleanup completed:', result);
    })
    .catch(error => {
      console.error('Error in initial photo cleanup:', error);
    });
  
  // Schedule periodic cleanup
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  return setInterval(async () => {
    try {
      const result = await cleanupOldCustomerPhotos();
      console.log('Scheduled photo cleanup completed:', result);
    } catch (error) {
      console.error('Error in scheduled photo cleanup:', error);
    }
  }, intervalMs);
}