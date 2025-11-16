import { ReactNode, useMemo, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface ShowcaseLayoutProps {
  children: ReactNode;
}

export function ShowcaseLayout({ children }: ShowcaseLayoutProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { damping: 25, stiffness: 150 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const gradientX = useTransform(mouseX, [0, 100], [30, 70]);
  const gradientY = useTransform(mouseY, [0, 100], [40, 60]);
  
  const gradientXSecondary = useTransform(mouseX, [0, 100], [12.5, 37.5]);
  const gradientYSecondary = useTransform(mouseY, [0, 100], [25, 40]);

  const particles = useMemo(() => 
    Array.from({ length: 20 }).map((_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      delay: i * 0.1
    })),
    []
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const xPercent = (e.clientX / window.innerWidth) * 100;
      const yPercent = (e.clientY / window.innerHeight) * 100;
      
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
          className="absolute inset-0"
          style={{
            background: useTransform(
              [gradientX, gradientY],
              ([x, y]) => `radial-gradient(circle at ${x}% ${y}%, rgba(30,64,175,0.2), transparent 50%)`
            )
          }}
        />
        
        {/* Secondary gradient - parallax effect (slower) */}
        <motion.div
          className="absolute inset-0 opacity-80"
          style={{
            background: useTransform(
              [gradientXSecondary, gradientYSecondary],
              ([x, y]) => `radial-gradient(circle at ${x}% ${y}%, rgba(76,29,149,0.15), transparent 50%)`
            )
          }}
        />
        
        {/* Tertiary gradient - subtle bottom glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_90%,rgba(99,102,241,0.1),transparent_50%)]" />
        
        {/* Floating particles with stable positions */}
        <div className="absolute inset-0">
          {particles.map((particle, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: particle.size,
                height: particle.size,
                backgroundColor: 'rgba(96, 165, 250, 0.2)',
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 4,
                repeat: Infinity,
                delay: particle.delay,
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
