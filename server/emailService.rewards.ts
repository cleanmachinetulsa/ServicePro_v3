import { RewardService } from '@shared/schema';
// Set to true if you want to enable demo mode restrictions
const DEMO_MODE = process.env.DEMO_MODE === 'true';
import { sendBusinessEmail } from './emailService';

/**
 * Send a reward notification email to a customer
 */
export async function sendRewardNotificationEmail(
  to: string,
  customerName: string,
  pointsBalance: number,
  reward: RewardService
) {
  const subject = 'You\'ve Earned a Clean Machine Reward!';
  
  const textContent = `
    Congratulations ${customerName}!
    
    Great news! You now have ${pointsBalance} loyalty points, which means you're eligible for a free service reward!
    
    You can redeem your points for: ${reward.name} (${reward.pointCost} points)
    
    ${reward.description}
    
    Visit our website and go to the Rewards page to check your points balance and redeem your reward. Remember, you can redeem up to 3 services at once!
    
    Thank you for your continued loyalty to Clean Machine Auto Detail.
    
    Clean Machine Auto Detail Team
  `;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <div style="background-color: #0066cc; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Clean Machine Auto Detail</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #0066cc; text-align: center;">🎉 CONGRATULATIONS! 🎉</h2>
        <p>Hello ${customerName},</p>
        <p>Great news! You now have <strong style="font-size: 20px; color: #0066cc;">${pointsBalance} loyalty points</strong>, which means you're eligible for a free service reward!</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-left: 4px solid #0066cc; border-radius: 5px;">
          <h3 style="margin-top: 0; color: #0066cc;">You can redeem your points for:</h3>
          <p style="font-size: 18px; font-weight: bold; margin: 10px 0;">${reward.name} (${reward.pointCost} points)</p>
          <p style="margin: 8px 0 0;">${reward.description}</p>
        </div>
        
        <p>Visit our website and go to the <strong>Rewards</strong> page to check your points balance and redeem your reward. Remember, you can redeem up to 3 services at once!</p>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="#" style="background-color: #0066cc; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">REDEEM YOUR REWARD</a>
        </div>
        
        <p>Thank you for your continued loyalty to Clean Machine Auto Detail.</p>
        <p><strong>Clean Machine Auto Detail Team</strong></p>
      </div>
      <div style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; color: #666;">
        <p>© 2024 Clean Machine Auto Detail. All rights reserved.</p>
      </div>
    </div>
  `;
  
  return sendBusinessEmail(to, subject, textContent, htmlContent);
}