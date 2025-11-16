import { ReactNode, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface ShowcaseLayoutProps {
  children: ReactNode;
}

export function ShowcaseLayout({ children }: ShowcaseLayoutProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { damping: 25, stiffness: 150 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Convert mouse position to percentage (0-100)
      const xPercent = (e.clientX / window.innerWidth) * 100;
      const yPercent = (e.clientY / window.innerHeight) * 100;
      
      setMousePosition({ x: xPercent, y: yPercent });
      mouseX.set(xPercent);
      mouseY.set(yPercent);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 overflow-x-hidden relative">
      {/* Animated background effects with mouse tracking */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Primary gradient - follows mouse */}
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_var(--mouse-x)_var(--mouse-y),rgba(30,64,175,0.2),transparent_50%)]"
          style={{
            '--mouse-x': `${mousePosition.x}%`,
            '--mouse-y': `${mousePosition.y}%`,
          } as React.CSSProperties}
        />
        
        {/* Secondary gradient - parallax effect (slower) */}
        <motion.div
          className="absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x * 0.5 + 25}% ${mousePosition.y * 0.5 + 30}%, rgba(76,29,149,0.15), transparent 50%)`,
          }}
        />
        
        {/* Tertiary gradient - subtle bottom glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_90%,rgba(99,102,241,0.1),transparent_50%)]" />
        
        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/20 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 4,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
