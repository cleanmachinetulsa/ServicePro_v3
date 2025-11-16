import { motion } from 'framer-motion';
import { SectionHeader } from '../shared/SectionHeader';
import { MetricCard } from '../shared/MetricCard';
import { Clock, UserX, Repeat, DollarSign, TrendingUp, Settings } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const businessMetrics = [
  { icon: Clock, value: '15-20', suffix: ' hrs', label: 'Time Saved Per Week' },
  { icon: UserX, value: 67, suffix: '%', label: 'No-Show Reduction' },
  { icon: Repeat, value: '+42', suffix: '%', label: 'Repeat Booking Rate' },
  { icon: DollarSign, value: '+$35', label: 'Avg Ticket Increase' },
  { icon: Settings, value: '13+', label: 'Admin Features', description: 'Dashboard tools for business management' }
];

const chartData = [
  { month: 'Before', manual: 65, automated: 0, label: 'Manual Chaos' },
  { month: 'Week 1', manual: 55, automated: 20, label: 'Setup' },
  { month: 'Week 2', manual: 40, automated: 45, label: 'Learning' },
  { month: 'Week 3', manual: 25, automated: 70, label: 'Adoption' },
  { month: 'Week 4', manual: 15, automated: 85, label: 'Dialed In' },
  { month: 'Month 2', manual: 9, automated: 91, label: 'Optimized' }
];

export function MetricsSection() {
  return (
    <section id="metrics" className="py-24 relative">
      <div className="container mx-auto px-4">
        <SectionHeader
          badge="Real Impact"
          title="Metrics & Impact"
          subtitle="Example results when fully dialed in - your mileage may vary"
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {businessMetrics.map((metric, i) => (
            <MetricCard
              key={i}
              icon={metric.icon}
              value={metric.value}
              suffix={metric.suffix}
              label={metric.label}
              delay={i * 0.1}
              animated={typeof metric.value === 'number'}
            />
          ))}
        </div>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-8"
        >
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-bold text-white">Automation Adoption</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="text-sm text-blue-200">Manual Work</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="text-sm text-blue-200">Automated</span>
                </div>
              </div>
            </div>
            <p className="text-blue-200">From chaos to cruise control in 4-6 weeks</p>
          </div>

          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorManual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAutomated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
              <XAxis 
                dataKey="month" 
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8' }}
              />
              <YAxis 
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8' }}
                label={{ value: 'Efficiency %', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#cbd5e1'
                }}
                labelFormatter={(label) => {
                  const item = chartData.find(d => d.month === label);
                  return item ? item.label : label;
                }}
              />
              <Area
                type="monotone"
                dataKey="manual"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorManual)"
                name="Manual Work"
              />
              <Area
                type="monotone"
                dataKey="automated"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorAutomated)"
                name="Automated"
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-blue-200">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span>Typical progression - results vary by business and setup</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
