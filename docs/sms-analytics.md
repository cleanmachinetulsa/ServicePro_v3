# SMS Campaign Analytics

## Overview

SMS Campaign Analytics provides visibility into SMS campaign performance, delivery rates, and error breakdowns. This feature helps track campaign effectiveness and diagnose delivery issues.

## API Endpoints

### 1. Campaign List
**GET** `/api/admin/analytics/sms/campaigns`

Returns a list of all SMS campaigns for the tenant.

### 2. Campaign Run Analytics
**GET** `/api/admin/analytics/sms/campaign-run/:campaignId`

Returns detailed analytics for a specific campaign:
- Campaign metadata (name, status, dates)
- Totals (sent, delivered, failed, skipped)
- Error breakdown by Twilio error code
- Status breakdown (delivered, sent, failed, undelivered, pending)
- Skip reason breakdown (unsubscribed, invalid, etc.)

### 3. Tenant SMS Summary
**GET** `/api/admin/analytics/sms/summary?from=ISO&to=ISO`

Returns aggregated SMS statistics over a date range:
- Daily stats (total, delivered, failed, undelivered)
- Overall totals
- Error breakdown for the period
- Status breakdown for the period

## Database Schema

### sms_campaign_recipients (extended)

| Column | Type | Description |
|--------|------|-------------|
| error_code | varchar(10) | Twilio error code (e.g., '21610', '30003') |
| skip_reason | varchar(30) | Why message was skipped (unsubscribed, invalid, etc.) |

### Indexes
- `sms_campaign_recipients_tenant_created_idx` - For time-range queries
- `sms_campaign_recipients_error_code_idx` - For error aggregation

## UI Pages

### SMS Campaign Analytics Page
**Route:** `/admin/sms-analytics`

Two tabs:
1. **Overview** - Time-range summary with charts showing SMS volume and error breakdown
2. **Campaigns** - List of campaigns, click to view details

### Campaign Detail View
**Route:** `/admin/sms-analytics/campaign/:campaignId`

Shows:
- Campaign metadata and message preview
- Summary stats (total, delivered, failed, skipped)
- Status breakdown pie chart
- Error breakdown table with Twilio error meanings
- Skip reason bar chart

## Twilio Error Code Reference

| Code | Meaning |
|------|---------|
| 21610 | Unsubscribed recipient |
| 21611 | Invalid destination number |
| 30003 | Unreachable destination |
| 30004 | Message blocked |
| 30005 | Unknown destination |
| 30006 | Landline or unreachable |
| 30007 | Carrier violation |

## Files

- `server/services/smsAnalyticsService.ts` - Analytics service
- `server/routes.smsAnalytics.ts` - API endpoints
- `client/src/pages/admin/SmsCampaignAnalytics.tsx` - UI page
