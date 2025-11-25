import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { generateAIResponse } from '../openai';
import { db } from '../db';
import { wrapTenantDb } from '../tenantDb';
import { conversations, messages as messagesTable } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';

export const twilioTestSmsRouter = Router();

const MessagingResponse = twilio.twiml.MessagingResponse;

async function getOrCreateTestConversation(tenantDb: any, phone: string) {
  let conversation = await tenantDb.query.conversations.findFirst({
    where: tenantDb.withTenantFilter(conversations, eq(conversations.customerPhone, phone)),
  });
  
  if (!conversation) {
    const [created] = await tenantDb
      .insert(conversations)
      .values({
        customerPhone: phone,
        platform: 'sms',
        status: 'active',
        controlMode: 'auto',
      })
      .returning();
    conversation = created;
    console.log('[TWILIO TEST SMS] Created new conversation for', phone);
  }
  
  return conversation;
}

async function getConversationHistory(tenantDb: any, conversationId: number) {
  const msgs = await tenantDb
    .select()
    .from(messagesTable)
    .where(tenantDb.withTenantFilter(messagesTable, eq(messagesTable.conversationId, conversationId)))
    .orderBy(asc(messagesTable.timestamp))
    .limit(15);
  
  return msgs.map((msg: typeof messagesTable.$inferSelect) => ({
    content: msg.content,
    role: msg.sender === 'customer' ? 'user' as const : 'assistant' as const,
    sender: msg.sender
  }));
}

async function addMessage(tenantDb: any, conversationId: number, content: string, sender: string) {
  await tenantDb
    .insert(messagesTable)
    .values({
      conversationId,
      content,
      sender,
      fromCustomer: sender === 'customer',
      platform: 'sms',
      timestamp: new Date(),
    });
}

twilioTestSmsRouter.post('/inbound', async (req: Request, res: Response) => {
  const twimlResponse = new MessagingResponse();
  
  try {
    console.log("[TWILIO TEST SMS INBOUND] Raw body:", req.body);
    
    const { Body, From, To } = req.body || {};
    
    console.log("[TWILIO TEST SMS INBOUND] Parsed fields:", {
      From: (req.body as any)?.From,
      To: (req.body as any)?.To,
      Body: (req.body as any)?.Body,
    });
    
    if (!Body || !From) {
      console.warn('[TWILIO TEST SMS INBOUND] Missing Body or From');
      twimlResponse.message("Sorry, I couldn't process your message. Please try again.");
      res.type('text/xml').send(twimlResponse.toString());
      return;
    }
    
    const tenantId = 'root';
    const tenantDb = wrapTenantDb(db, tenantId);
    
    const conversation = await getOrCreateTestConversation(tenantDb, From);
    
    await addMessage(tenantDb, conversation.id, Body, 'customer');
    
    const conversationHistory = await getConversationHistory(tenantDb, conversation.id);
    
    const aiReply = await generateAIResponse(
      Body,
      From,
      'sms',
      undefined,
      conversationHistory,
      false,
      tenantId,
      conversation.controlMode || 'auto'
    );
    
    await addMessage(tenantDb, conversation.id, aiReply || "Thanks for your message!", 'ai');
    
    twimlResponse.message(aiReply || "Thanks for your message! We'll follow up shortly.");
    
    console.log('[TWILIO TEST SMS INBOUND] AI reply sent:', aiReply?.substring(0, 100));
    console.log("[TWILIO TEST SMS INBOUND] Responding with TwiML:", twimlResponse.toString());
    
    res.type('text/xml').send(twimlResponse.toString());
  } catch (err) {
    console.error('[TWILIO TEST SMS INBOUND ERROR]', err);
    const errorResponse = new MessagingResponse();
    errorResponse.message("Sorry, I'm having trouble right now. A human will take a look and get back to you.");
    res.type('text/xml').send(errorResponse.toString());
  }
});

console.log("[TWILIO TEST] Inbound SMS handler READY at /api/twilio/sms/inbound");
