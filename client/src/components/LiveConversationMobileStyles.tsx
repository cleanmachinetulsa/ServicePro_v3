import React, { useEffect } from 'react';

const LiveConversationMobileStyles: React.FC = () => {
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    
    // Define styles to fix the mobile conversation view
    const css = `
      /* Styles to fix mobile conversation view */
      @media (max-width: 768px) {
        .messages-container {
          padding-bottom: 280px !important;
          margin-bottom: 30px !important;
        }
        
        .suggestions-container {
          position: fixed;
          bottom: 60px;
          left: 0;
          right: 0;
          background: white;
          padding: 10px;
          border-top: 1px solid #e5e7eb;
          z-index: 50;
        }
        
        .input-area {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          padding: 10px;
          border-top: 1px solid #e5e7eb;
          z-index: 50;
        }
        
        /* Ensure there's space at the bottom of message list */
        .conversation-card {
          margin-bottom: 300px !important;
        }
      }
    `;
    
    // Set the content and append to head
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    
    // Clean up on unmount
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  
  return null;
};

export default LiveConversationMobileStyles;