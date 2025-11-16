import { motion } from 'framer-motion';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ code, language = 'pseudo', title }: CodeBlockProps) {
  const lines = code.trim().split('\n');
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="bg-slate-900/80 backdrop-blur-sm border border-blue-500/20 rounded-xl overflow-hidden"
    >
      {title && (
        <div className="px-4 py-2 bg-blue-600/10 border-b border-blue-500/20 text-blue-300 text-sm font-medium">
          {title}
        </div>
      )}
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono">
          {lines.map((line, i) => {
            const trimmedLine = line.trim();
            const indent = line.length - trimmedLine.length;
            
            let lineColor = 'text-blue-200';
            if (trimmedLine.startsWith('WHEN') || trimmedLine.startsWith('IF') || trimmedLine.startsWith('ELSE')) {
              lineColor = 'text-purple-400 font-semibold';
            } else if (trimmedLine.startsWith('SEND') || trimmedLine.startsWith('SCHEDULE') || trimmedLine.startsWith('TRIGGER')) {
              lineColor = 'text-green-400 font-semibold';
            } else if (trimmedLine.startsWith('ALWAYS') || trimmedLine.startsWith('CHECK')) {
              lineColor = 'text-yellow-400 font-semibold';
            }
            
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={lineColor}
                style={{ paddingLeft: `${indent * 8}px` }}
              >
                {trimmedLine}
              </motion.div>
            );
          })}
        </pre>
      </div>
    </motion.div>
  );
}
