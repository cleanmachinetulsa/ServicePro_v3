import logoImage from '@assets/clean-machine-logo.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const CleanMachineLogo = ({ size = 'md', className = '' }: LogoProps) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };
  
  const sizeClass = sizeMap[size];
  
  return (
    <div className={`${sizeClass} flex items-center justify-center overflow-hidden rounded-lg ${className}`}>
      <img 
        src={logoImage} 
        alt="Clean Machine Mobile Auto Detail" 
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default CleanMachineLogo;