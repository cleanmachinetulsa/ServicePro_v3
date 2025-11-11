import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface ServiceVerificationAnimationProps {
  serviceName: string;
  onComplete?: () => void;
}

export default function ServiceVerificationAnimation({ 
  serviceName, 
  onComplete 
}: ServiceVerificationAnimationProps) {
  const [step, setStep] = useState(0);
  const [checkmarks, setCheckmarks] = useState<string[]>([]);
  
  // Define service-specific verification criteria based on the service type
  useEffect(() => {
    let checks: string[] = [];
    
    // Common verifications for all services
    checks.push("Verifying price range");
    checks.push("Checking appointment availability");
    
    // Service-specific verifications
    if (serviceName.toLowerCase().includes("detail")) {
      checks.push("Reviewing vehicle size compatibility");
      checks.push("Confirming detail package options");
    }
    
    if (serviceName.toLowerCase().includes("ceramic")) {
      checks.push("Checking required preparation steps");
      checks.push("Verifying coating durability options");
      checks.push("Confirming maintenance protocol");
    }
    
    if (serviceName.toLowerCase().includes("wash")) {
      checks.push("Verifying eco-friendly products");
      checks.push("Checking quick service availability");
    }
    
    if (serviceName.toLowerCase().includes("polish") || serviceName.toLowerCase().includes("enhancement")) {
      checks.push("Evaluating paint condition requirements");
      checks.push("Checking specialized equipment availability");
    }
    
    // Add one final check for all services
    checks.push("Preparing personalized service recommendation");
    
    setCheckmarks(checks);
  }, [serviceName]);
  
  // Advance through the check steps
  useEffect(() => {
    if (step < checkmarks.length) {
      const timer = setTimeout(() => {
        setStep(step + 1);
      }, 800);
      
      return () => clearTimeout(timer);
    } else if (step === checkmarks.length && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [step, checkmarks.length, onComplete]);
  
  // Variants for animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    checked: { opacity: 1, scale: [1, 1.05, 1] }
  };
  
  const sparkleVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: {
      opacity: [0, 1, 0],
      scale: [0.8, 1.2, 0.8],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        repeatType: "loop"
      }
    }
  };
  
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md border border-blue-100">
      <div className="text-center mb-6">
        <div className="inline-block relative">
          <Sparkles
            className="h-6 w-6 text-blue-500 mx-auto mb-2" 
          />
          <motion.div
            className="absolute inset-0 text-yellow-400"
            variants={sparkleVariants}
            initial="hidden"
            animate="visible"
          >
            ✨
          </motion.div>
        </div>
        <h3 className="text-lg font-semibold text-blue-800">
          Verifying {serviceName}
        </h3>
        <p className="text-sm text-gray-500">
          We're personalizing our recommendations for you
        </p>
      </div>
      
      <motion.ul
        className="space-y-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {checkmarks.map((check, index) => (
          <motion.li
            key={index}
            className="flex items-center space-x-3"
            variants={itemVariants}
            animate={step > index ? "checked" : "visible"}
          >
            <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
              step > index 
                ? "bg-green-100 text-green-600" 
                : step === index 
                  ? "bg-blue-100 text-blue-600 animate-pulse" 
                  : "bg-gray-100 text-gray-400"
            }`}>
              {step > index ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              ) : step === index ? (
                <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
              ) : (
                <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
              )}
            </div>
            <span className={`text-sm ${
              step > index 
                ? "text-green-800 font-medium" 
                : step === index 
                  ? "text-blue-800 font-medium" 
                  : "text-gray-500"
            }`}>
              {check}
              {step === index && (
                <span className="inline-flex ml-2">
                  <span className="animate-ping absolute h-1.5 w-1.5 rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
              )}
            </span>
          </motion.li>
        ))}
      </motion.ul>
      
      {step === checkmarks.length && (
        <motion.div 
          className="mt-6 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="inline-block p-2 bg-green-100 rounded-full mb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.5 }}
            >
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </motion.div>
          </div>
          <p className="text-green-700 font-medium">
            Verification Complete!
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Your personalized service details are ready
          </p>
        </motion.div>
      )}
    </div>
  );
}