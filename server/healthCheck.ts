/**
 * Health Check Endpoint for Critical Integrations
 * Exposes system health for monitoring and debugging
 */

import { criticalMonitor } from './criticalMonitoring';

export function getHealthStatus() {
  return {
    status: 'running',
    timestamp: new Date().toISOString(),
    integrations: criticalMonitor.getHealthStatus(),
  };
}

export function registerHealthRoutes(app: any) {
  // Public health check endpoint
  app.get('/api/health', (req: any, res: any) => {
    const health = getHealthStatus();
    
    // Check if any critical integrations are failed
    const integrations = health.integrations;
    const hasCriticalFailure = Object.values(integrations).some(
      (integration: any) => integration.status === 'failed'
    );
    
    res.status(hasCriticalFailure ? 503 : 200).json(health);
  });
  
  console.log('[HEALTH CHECK] Routes registered');
}
