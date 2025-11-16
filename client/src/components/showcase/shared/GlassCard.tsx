import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
}

export function GlassCard({ children, className = '', hover = true, delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={hover ? { y: -5, scale: 1.02 } : undefined}
      className={`
        bg-gradient-to-br from-white/10 to-white/5 
        backdrop-blur-xl 
        border border-white/20 
        rounded-2xl 
        p-6 
        shadow-xl 
        transition-all 
        duration-300
        ${hover ? 'hover:shadow-2xl hover:border-white/40 hover:from-white/15 hover:to-white/10' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
