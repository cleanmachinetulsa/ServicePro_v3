import React from 'react';
import logoImage from '@assets/ab_Clean4-03.jpg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CleanMachineLogo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  // Map size to dimensions
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };
  
  const sizeClass = sizeMap[size];
  
  return (
    <div className={`${sizeClass} flex items-center justify-center overflow-hidden bg-black rounded-lg ${className}`}>
      <img 
        src={logoImage} 
        alt="Clean Machine Logo" 
        className="w-full h-full object-contain p-0.5"
      />
    </div>
  );
};

export default CleanMachineLogo;