import express, { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { requireAuth } from './authMiddleware';
import { wrapTenantDb } from './tenantDb';
import { db } from './db';
import https from 'https';
import http from 'http';

const router = express.Router();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

function extractRecordingSid(url: string): string | null {
  const match = url.match(/Recordings\/(RE[a-f0-9]+)/i);
  return match ? match[1] : null;
}

function getProxiedUrl(recordingUrlOrSid: string): string {
  if (recordingUrlOrSid.startsWith('RE')) {
    return `/api/twilio/media/${recordingUrlOrSid}`;
  }
  const sid = extractRecordingSid(recordingUrlOrSid);
  return sid ? `/api/twilio/media/${sid}` : recordingUrlOrSid;
}

router.get('/media/:recordingSid', requireAuth, async (req: Request, res: Response) => {
  const { recordingSid } = req.params;
  
  if (!recordingSid || !recordingSid.startsWith('RE')) {
    return res.status(400).json({ error: 'Invalid recording SID' });
  }
  
  if (!accountSid || !authToken) {
    console.error('[TWILIO MEDIA PROXY] Missing Twilio credentials');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  try {
    const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
    
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    
    const proxyReq = https.request(recordingUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      }
    }, (proxyRes) => {
      if (proxyRes.statusCode === 401) {
        console.error('[TWILIO MEDIA PROXY] Authentication failed for recording:', recordingSid);
        return res.status(403).json({ error: 'Access denied' });
      }
      
      if (proxyRes.statusCode === 404) {
        console.error('[TWILIO MEDIA PROXY] Recording not found:', recordingSid);
        return res.status(404).json({ error: 'Recording not found' });
      }
      
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Content-Length', proxyRes.headers['content-length'] || '0');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('[TWILIO MEDIA PROXY] Request error:', err.message);
      res.status(500).json({ error: 'Failed to fetch recording' });
    });
    
    proxyReq.end();
    
  } catch (error) {
    console.error('[TWILIO MEDIA PROXY] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recording-url', requireAuth, async (req: Request, res: Response) => {
  const { url } = req.query;
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }
  
  const sid = extractRecordingSid(url);
  if (!sid) {
    return res.status(400).json({ error: 'Invalid Twilio recording URL' });
  }
  
  res.json({ proxyUrl: `/api/twilio/media/${sid}` });
});

export { router as twilioMediaRouter, getProxiedUrl, extractRecordingSid };
