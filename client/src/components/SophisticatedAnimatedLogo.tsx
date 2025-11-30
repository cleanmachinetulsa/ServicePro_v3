import { motion } from "framer-motion";
import cleanMachineLogo from '@assets/clean-machine-logo.png';

export default function SophisticatedAnimatedLogo() {
  return (
    <div className="w-full flex justify-center items-center py-6">
      <motion.div 
        className="relative w-full max-w-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex flex-col items-center">
          {/* Logo Container */}
          <motion.div 
            className="relative"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="relative">
              {/* Clean Machine Logo with glow effect */}
              <motion.div
                className="w-72 h-72 md:w-96 md:h-96 relative"
              >
                {/* Background subtle glow */}
                <motion.div 
                  className="absolute inset-0 rounded-full bg-blue-600/20 filter blur-2xl"
                  animate={{ 
                    scale: [1, 1.15, 1],
                    opacity: [0.4, 0.7, 0.4] 
                  }}
                  transition={{ 
                    duration: 6, 
                    repeat: Infinity,
                    repeatType: "reverse" 
                  }}
                />
                
                {/* Main Logo Image */}
                <motion.div 
                  className="absolute inset-0 w-full h-full flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1, delay: 0.3 }}
                >
                  <motion.img 
                    src={cleanMachineLogo}
                    alt="Clean Machine Mobile Auto Detail"
                    className="w-full h-full object-contain drop-shadow-2xl"
                    animate={{ 
                      y: [0, -5, 0],
                    }}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity,
                      repeatType: "reverse" 
                    }}
                  />
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}