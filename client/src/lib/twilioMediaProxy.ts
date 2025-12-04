export function extractRecordingSid(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('RE')) return url;
  const match = url.match(/Recordings\/(RE[a-f0-9]+)/i);
  return match ? match[1] : null;
}

export function getProxiedAudioUrl(recordingUrlOrSid: string | null | undefined): string | null {
  if (!recordingUrlOrSid) return null;
  
  if (recordingUrlOrSid.startsWith('/api/twilio/media/')) {
    return recordingUrlOrSid;
  }
  
  if (recordingUrlOrSid.startsWith('RE')) {
    return `/api/twilio/media/${recordingUrlOrSid}`;
  }
  
  const sid = extractRecordingSid(recordingUrlOrSid);
  if (sid) {
    return `/api/twilio/media/${sid}`;
  }
  
  if (recordingUrlOrSid.includes('api.twilio.com')) {
    console.warn('[Twilio Media] Direct Twilio URL detected - should use proxy');
    const extractedSid = extractRecordingSid(recordingUrlOrSid);
    if (extractedSid) {
      return `/api/twilio/media/${extractedSid}`;
    }
  }
  
  return recordingUrlOrSid;
}
