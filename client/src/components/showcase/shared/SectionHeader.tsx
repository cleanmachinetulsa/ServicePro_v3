import { motion } from 'framer-motion';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, badge, className = '' }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`text-center mb-8 md:mb-10 lg:mb-12 ${className}`}
    >
      {badge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-block mb-3 md:mb-4"
        >
          <span className="px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-full text-blue-300 text-xs md:text-sm font-medium">
            {badge}
          </span>
        </motion.div>
      )}
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 md:mb-4 px-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-base md:text-lg lg:text-xl text-blue-200 max-w-3xl mx-auto px-4 leading-relaxed">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
