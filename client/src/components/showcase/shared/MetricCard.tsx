import { motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  suffix?: string;
  prefix?: string;
  delay?: number;
  animated?: boolean;
}

export function MetricCard({ 
  icon: Icon, 
  value, 
  label, 
  suffix = '', 
  prefix = '', 
  delay = 0,
  animated = true 
}: MetricCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
  
  useEffect(() => {
    if (!animated || typeof value !== 'number' || !isInView) {
      setDisplayValue(value);
      return;
    }
    
    let start = 0;
    const end = value;
    const duration = 2000;
    const increment = end / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [value, animated, isInView]);
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-xl p-6 text-center group hover:border-white/40 transition-all duration-300"
    >
      <Icon className="w-12 h-12 mx-auto mb-3 text-blue-400 group-hover:text-blue-300 transition-colors" />
      <div className="text-3xl md:text-4xl font-bold text-white mb-2">
        {prefix}{displayValue}{suffix}
      </div>
      <div className="text-sm text-blue-200">{label}</div>
    </motion.div>
  );
}
