import React from "react";
import { motion } from "framer-motion";

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
              {/* Car silhouette and bubbles - main logo */}
              <motion.div
                className="w-72 h-72 md:w-96 md:h-96 relative"
              >
                {/* Background subtle glow */}
                <motion.div 
                  className="absolute inset-0 rounded-full bg-blue-600/10 filter blur-xl"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.5, 0.7, 0.5] 
                  }}
                  transition={{ 
                    duration: 6, 
                    repeat: Infinity,
                    repeatType: "reverse" 
                  }}
                />
                
                {/* Circular motion for bubbles */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
                  {/* Rotating circular path that bubbles will follow */}
                  <motion.circle 
                    cx="200" 
                    cy="200" 
                    r="180" 
                    fill="none" 
                    stroke="rgba(59, 130, 246, 0.1)" 
                    strokeWidth="1"
                    animate={{ 
                      opacity: [0, 0.3, 0] 
                    }}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity,
                      repeatType: "reverse" 
                    }}
                  />
                  
                  {/* Animated bubbles on circular path */}
                  <motion.g
                    animate={{ 
                      rotate: 360 
                    }}
                    transition={{ 
                      duration: 20, 
                      repeat: Infinity,
                      ease: "linear" 
                    }}
                  >
                    {/* Animated small bubble 1 */}
                    <motion.circle 
                      cx="200" 
                      cy="20" 
                      r="10" 
                      fill="rgba(255, 255, 255, 0.7)" 
                      stroke="rgba(59, 130, 246, 0.3)" 
                      strokeWidth="2"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.7, 1, 0.7] 
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity,
                        repeatType: "reverse" 
                      }}
                    />
                    {/* Animated small bubble 2 */}
                    <motion.circle 
                      cx="350" 
                      cy="200" 
                      r="12" 
                      fill="rgba(255, 255, 255, 0.7)" 
                      stroke="rgba(59, 130, 246, 0.3)" 
                      strokeWidth="2"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.7, 1, 0.7] 
                      }}
                      transition={{ 
                        duration: 4, 
                        repeat: Infinity,
                        repeatType: "reverse",
                        delay: 0.5 
                      }}
                    />
                    {/* Animated small bubble 3 */}
                    <motion.circle 
                      cx="200" 
                      cy="380" 
                      r="8" 
                      fill="rgba(255, 255, 255, 0.7)" 
                      stroke="rgba(59, 130, 246, 0.3)" 
                      strokeWidth="2"
                      animate={{ 
                        scale: [1, 1.3, 1],
                        opacity: [0.7, 1, 0.7] 
                      }}
                      transition={{ 
                        duration: 3.5, 
                        repeat: Infinity,
                        repeatType: "reverse",
                        delay: 1 
                      }}
                    />
                    {/* Animated small bubble 4 */}
                    <motion.circle 
                      cx="50" 
                      cy="200" 
                      r="11" 
                      fill="rgba(255, 255, 255, 0.7)" 
                      stroke="rgba(59, 130, 246, 0.3)" 
                      strokeWidth="2"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.7, 1, 0.7] 
                      }}
                      transition={{ 
                        duration: 5, 
                        repeat: Infinity,
                        repeatType: "reverse",
                        delay: 1.5
                      }}
                    />
                  </motion.g>
                </svg>
                
                {/* Main Logo SVG */}
                <motion.div 
                  className="absolute inset-0 w-full h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.3 }}
                >
                  <svg className="w-full h-full p-8" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Car with bubbles logo */}
                    <g className="filter drop-shadow(0px 0px 8px rgba(255, 255, 255, 0.3))">
                      {/* Bubbles */}
                      <motion.path 
                        d="M100 140C111.046 140 120 131.046 120 120C120 108.954 111.046 100 100 100C88.9543 100 80 108.954 80 120C80 131.046 88.9543 140 100 140Z" 
                        stroke="white" 
                        strokeWidth="6"
                        fill="none"
                        animate={{ 
                          scale: [1, 1.05, 1],
                          y: [0, -2, 0],
                        }}
                        transition={{ 
                          duration: 3, 
                          repeat: Infinity,
                          repeatType: "reverse" 
                        }}
                      />
                      <motion.path 
                        d="M400 140C411.046 140 420 131.046 420 120C420 108.954 411.046 100 400 100C388.954 100 380 108.954 380 120C380 131.046 388.954 140 400 140Z" 
                        stroke="white" 
                        strokeWidth="6"
                        fill="none"
                        animate={{ 
                          scale: [1, 1.05, 1],
                          y: [0, -2, 0],
                        }}
                        transition={{ 
                          duration: 3, 
                          repeat: Infinity,
                          repeatType: "reverse",
                          delay: 0.2
                        }}
                      />
                      <motion.path 
                        d="M170 180C192.091 180 210 162.091 210 140C210 117.909 192.091 100 170 100C147.909 100 130 117.909 130 140C130 162.091 147.909 180 170 180Z" 
                        stroke="white" 
                        strokeWidth="6"
                        fill="none"
                        animate={{ 
                          scale: [1, 1.03, 1],
                          y: [0, -3, 0],
                        }}
                        transition={{ 
                          duration: 4, 
                          repeat: Infinity,
                          repeatType: "reverse",
                          delay: 0.3
                        }}
                      />
                      <motion.path 
                        d="M250 190C277.614 190 300 167.614 300 140C300 112.386 277.614 90 250 90C222.386 90 200 112.386 200 140C200 167.614 222.386 190 250 190Z" 
                        stroke="white" 
                        strokeWidth="6"
                        fill="none"
                        animate={{ 
                          scale: [1, 1.04, 1],
                          y: [0, -1, 0],
                        }}
                        transition={{ 
                          duration: 5, 
                          repeat: Infinity,
                          repeatType: "reverse",
                          delay: 0.5
                        }}
                      />
                      <motion.path 
                        d="M330 180C352.091 180 370 162.091 370 140C370 117.909 352.091 100 330 100C307.909 100 290 117.909 290 140C290 162.091 307.909 180 330 180Z" 
                        stroke="white" 
                        strokeWidth="6"
                        fill="none"
                        animate={{ 
                          scale: [1, 1.03, 1],
                          y: [0, -2, 0],
                        }}
                        transition={{ 
                          duration: 4.5, 
                          repeat: Infinity,
                          repeatType: "reverse",
                          delay: 0.7
                        }}
                      />
                      
                      {/* Car silhouette */}
                      <motion.path 
                        d="M80 300V240L120 200H240L280 240H440L460 260V300H420C420 327.614 397.614 350 370 350C342.386 350 320 327.614 320 300H160C160 327.614 137.614 350 110 350C82.386 350 60 327.614 60 300H80Z" 
                        stroke="white" 
                        strokeWidth="6"
                        fill="rgba(0, 0, 0, 0.5)"
                        animate={{ 
                          y: [0, -2, 0],
                        }}
                        transition={{ 
                          duration: 4, 
                          repeat: Infinity,
                          repeatType: "reverse" 
                        }}
                      />
                      <motion.circle 
                        cx="110" 
                        cy="300" 
                        r="40" 
                        stroke="white" 
                        strokeWidth="6"
                        fill="none"
                        animate={{ 
                          rotate: [0, 360],
                        }}
                        transition={{ 
                          duration: 10, 
                          repeat: Infinity,
                          ease: "linear" 
                        }}
                      />
                      <motion.circle 
                        cx="370" 
                        cy="300" 
                        r="40" 
                        stroke="white" 
                        strokeWidth="6"
                        fill="none"
                        animate={{ 
                          rotate: [0, 360],
                        }}
                        transition={{ 
                          duration: 10, 
                          repeat: Infinity,
                          ease: "linear" 
                        }}
                      />
                    </g>
                  </svg>
                </motion.div>
              </motion.div>
            </div>
            
            {/* Text */}
            <motion.div
              className="mt-4 mb-1 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-wider">
                <motion.span 
                  className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-100 to-blue-300"
                  initial={{ letterSpacing: "0.05em" }}
                  animate={{ 
                    letterSpacing: ["0.05em", "0.06em", "0.05em"],
                    textShadow: ['0px 0px 1px rgba(255,255,255,0.2)', '0px 0px 3px rgba(255,255,255,0.3)', '0px 0px 1px rgba(255,255,255,0.2)'],
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  CLEAN MACHINE
                </motion.span>
              </h1>
              <div className="relative">
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-blue-900/0 via-blue-600/10 to-blue-900/0 rounded-full blur-md"
                  animate={{ 
                    opacity: [0.2, 0.4, 0.2],
                    scale: [0.95, 1, 0.95]
                  }}
                  transition={{ 
                    duration: 5,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                />
                <motion.p 
                  className="text-blue-200 text-xs font-medium relative z-10 px-4 py-1 tracking-wide"
                  animate={{ 
                    opacity: [0.8, 0.9, 0.8] 
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: 1
                  }}
                >
                  AUTO DETAIL
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}