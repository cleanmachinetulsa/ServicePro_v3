import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  phase: 'outgoing' | 'incoming';
  direction?: 'forward' | 'back';
}

export function PageTransition({ children, phase, direction = 'forward' }: PageTransitionProps) {
  const variants = {
    outgoing: {
      initial: { x: 0, opacity: 1 },
      animate: { x: 0, opacity: 1 },
      exit: { 
        x: direction === 'forward' ? '-25%' : '25%', 
        opacity: 0.2,
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
      }
    },
    incoming: {
      initial: { 
        x: direction === 'forward' ? '100%' : '-100%', 
        opacity: 0 
      },
      animate: { 
        x: 0, 
        opacity: 1,
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
      },
      exit: { opacity: 1 }
    }
  };

  return (
    <motion.div
      initial={variants[phase].initial}
      animate={variants[phase].animate}
      exit={variants[phase].exit}
      style={{
        position: phase === 'outgoing' ? 'absolute' : 'relative',
        top: phase === 'outgoing' ? 0 : undefined,
        left: phase === 'outgoing' ? 0 : undefined,
        right: phase === 'outgoing' ? 0 : undefined,
        width: '100%',
        minHeight: '100vh',
        zIndex: phase === 'outgoing' ? 1 : 10
      }}
    >
      {children}
    </motion.div>
  );
}

export function ModalTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlideUpTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
