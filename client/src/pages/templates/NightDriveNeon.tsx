import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import GoogleReviews from "@/components/GoogleReviews";
import { MessageSquare, CalendarClock, Phone, Zap, Shield, Clock } from "lucide-react";
import type { HomepageContent } from "@shared/schema";

interface Service {
  id: number;
  name: string;
  priceRange: string;
  overview: string;
}

export default function NightDriveNeon() {
  const { data: contentData } = useQuery<{ success: boolean; content: HomepageContent }>({
    queryKey: ['/api/homepage-content'],
  });

  const { data: servicesData } = useQuery<{ success: boolean; services: Service[] }>({
    queryKey: ['/api/services'],
  });

  const content = contentData?.content;
  const services = servicesData?.services || [];

  useEffect(() => {
    if (content) {
      document.title = content.metaTitle;
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', content.metaDescription);
    }
  }, [content]);

  // Duplicate services for seamless marquee loop
  const marqueeServices = [...services, ...services, ...services];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Neon cyberpunk background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-purple-950/30 to-black"></div>
        
        {/* Animated neon glows */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-0 left-1/4 w-96 h-96 bg-fuchsia-500/30 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/30 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/20 blur-[120px]"
        />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.05)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      {/* Header with neon border */}
      <header className="relative z-20 border-b-2 border-fuchsia-500/50 bg-black/80">
        <nav className="flex justify-between items-center max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 10px rgba(217,70,239,0.5)',
                  '0 0 20px rgba(217,70,239,0.8)',
                  '0 0 10px rgba(217,70,239,0.5)',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Shield className="h-8 w-8 text-fuchsia-400" />
            </motion.div>
            <span 
              className="text-xl font-bold uppercase tracking-wider"
              style={{
                textShadow: '0 0 10px rgba(217,70,239,0.8), 0 0 20px rgba(217,70,239,0.5)'
              }}
            >
              <span className="text-fuchsia-400">CLEAN</span>{' '}
              <span className="text-purple-400">MACHINE</span>
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-fuchsia-400 hover:bg-fuchsia-500/20 transition-all border border-fuchsia-500/50 hover:border-fuchsia-400"
            style={{
              boxShadow: '0 0 10px rgba(217,70,239,0.3)'
            }}
            asChild
          >
            <Link href="/login" data-testid="button-login">
              LOGIN
            </Link>
          </Button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        {/* Full-bleed Hero Section */}
        <section className="py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 20px rgba(217,70,239,0.5)',
                  '0 0 40px rgba(217,70,239,0.8)',
                  '0 0 20px rgba(217,70,239,0.5)',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="inline-flex items-center gap-2 px-6 py-2 border-2 border-fuchsia-500 bg-black mb-8"
            >
              <Zap className="h-5 w-5 text-fuchsia-400" />
              <span className="text-sm font-bold uppercase tracking-wider text-fuchsia-400">
                AI-Powered Future Detail
              </span>
            </motion.div>
            
            <h1 
              className="text-6xl md:text-8xl font-black mb-6 uppercase tracking-tight"
              style={{
                background: 'linear-gradient(to right, #d946ef, #a855f7, #d946ef)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(217,70,239,0.5)',
              }}
            >
              DRIVE<br/>THE FUTURE
            </h1>
            
            <p className="text-lg md:text-xl text-purple-200 mb-12 max-w-3xl mx-auto font-light tracking-wide">
              {content?.aboutText || 'Experience next-generation auto detailing with cyberpunk precision and neon-level service.'}
            </p>
          </motion.div>

          {/* Neon CTA Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <Link href={content?.heroCtaLink || '/chat'}>
                <Card 
                  className="p-6 bg-black border-2 border-fuchsia-500/50 hover:border-fuchsia-400 transition-all duration-300 cursor-pointer group"
                  style={{
                    boxShadow: '0 0 20px rgba(217,70,239,0.3)'
                  }}
                >
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 15px rgba(217,70,239,0.5)',
                          '0 0 25px rgba(217,70,239,0.8)',
                          '0 0 15px rgba(217,70,239,0.5)',
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="p-4 border-2 border-fuchsia-500 bg-black"
                    >
                      <MessageSquare className="h-8 w-8 text-fuchsia-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 uppercase text-fuchsia-400">AI CHAT</h3>
                      <p className="text-sm text-purple-300">Instant neural responses</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ scale: 1.05 }}
            >
              <Link href="/schedule">
                <Card 
                  className="p-6 bg-black border-2 border-purple-500/50 hover:border-purple-400 transition-all duration-300 cursor-pointer group"
                  style={{
                    boxShadow: '0 0 20px rgba(168,85,247,0.3)'
                  }}
                >
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 15px rgba(168,85,247,0.5)',
                          '0 0 25px rgba(168,85,247,0.8)',
                          '0 0 15px rgba(168,85,247,0.5)',
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.5
                      }}
                      className="p-4 border-2 border-purple-500 bg-black"
                    >
                      <CalendarClock className="h-8 w-8 text-purple-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 uppercase text-purple-400">SYNC SCHEDULE</h3>
                      <p className="text-sm text-purple-300">Real-time booking matrix</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ scale: 1.05 }}
            >
              <a href={`tel:${content?.phoneNumber || '918-856-5711'}`}>
                <Card 
                  className="p-6 bg-black border-2 border-cyan-500/50 hover:border-cyan-400 transition-all duration-300 cursor-pointer group"
                  style={{
                    boxShadow: '0 0 20px rgba(6,182,212,0.3)'
                  }}
                >
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 15px rgba(6,182,212,0.5)',
                          '0 0 25px rgba(6,182,212,0.8)',
                          '0 0 15px rgba(6,182,212,0.5)',
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1
                      }}
                      className="p-4 border-2 border-cyan-500 bg-black"
                    >
                      <Phone className="h-8 w-8 text-cyan-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 uppercase text-cyan-400">DIRECT LINE</h3>
                      <p className="text-sm text-purple-300">{content?.phoneNumber || '918-856-5711'}</p>
                    </div>
                  </div>
                </Card>
              </a>
            </motion.div>
          </div>

          {/* Trust Indicators with Neon */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-8 py-8 border-y-2 border-fuchsia-500/30"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-fuchsia-400" />
              <span className="text-sm text-purple-200 uppercase tracking-wide">Insured</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-400" />
              <span className="text-sm text-purple-200 uppercase tracking-wide">Same-Day</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-cyan-400" />
              <span className="text-sm text-purple-200 uppercase tracking-wide">AI-Powered</span>
            </div>
          </motion.div>
        </section>

        {/* Marquee Services Section */}
        {services.length > 0 && (
          <section className="py-16 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 
                className="text-4xl md:text-6xl font-black mb-4 uppercase tracking-tight"
                style={{
                  background: 'linear-gradient(to right, #d946ef, #a855f7)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 20px rgba(217,70,239,0.5)',
                }}
              >
                SERVICE ARRAY
              </h2>
              <p className="text-purple-300 uppercase tracking-wider text-sm">
                Elite detailing protocols
              </p>
            </motion.div>

            {/* Horizontal Scrolling Marquee */}
            <div className="relative">
              <div className="overflow-hidden border-y-2 border-fuchsia-500/50 bg-black/50 py-8">
                <motion.div
                  animate={{
                    x: [0, -1920],
                  }}
                  transition={{
                    x: {
                      duration: 30,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }}
                  className="flex gap-6"
                >
                  {marqueeServices.map((service, index) => (
                    <div
                      key={`${service.id}-${index}`}
                      className="min-w-[400px] p-6 border-2 border-purple-500/50 bg-black"
                      style={{
                        boxShadow: '0 0 15px rgba(168,85,247,0.3)'
                      }}
                    >
                      <h3 className="text-xl font-bold mb-2 uppercase text-fuchsia-400 tracking-wide">
                        {service.name}
                      </h3>
                      <p className="text-cyan-400 font-bold mb-3 text-lg">{service.priceRange}</p>
                      <p className="text-sm text-purple-200 line-clamp-2">{service.overview}</p>
                    </div>
                  ))}
                </motion.div>
              </div>
              
              {/* Gradient overlays for fade effect */}
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent pointer-events-none"></div>
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black to-transparent pointer-events-none"></div>
            </div>

            <div className="text-center mt-8">
              <Button 
                size="lg"
                className="border-2 border-fuchsia-500 bg-black text-fuchsia-400 hover:bg-fuchsia-500/20 uppercase tracking-wider font-bold"
                style={{
                  boxShadow: '0 0 20px rgba(217,70,239,0.5)'
                }}
                asChild
              >
                <Link href="/schedule">
                  ACCESS ALL SERVICES →
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* Reviews Section */}
        <section className="py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="border-2 border-purple-500/50 bg-black/50 p-8"
            style={{
              boxShadow: '0 0 30px rgba(168,85,247,0.3)'
            }}
          >
            <GoogleReviews />
          </motion.div>
        </section>
      </main>

      {/* Neon Footer */}
      <footer className="relative z-10 mt-20 border-t-2 border-fuchsia-500/50 bg-black">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4 uppercase tracking-wider text-fuchsia-400">
                Clean Machine
              </h3>
              <p className="text-sm text-purple-300">
                Next-gen mobile auto detailing powered by AI
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4 uppercase tracking-wider text-purple-400">
                Quick Access
              </h3>
              <div className="flex flex-col gap-2">
                <Link href="/schedule" className="text-sm text-purple-300 hover:text-fuchsia-400 transition-colors uppercase tracking-wide">
                  Book Now
                </Link>
                <Link href="/careers" className="text-sm text-purple-300 hover:text-fuchsia-400 transition-colors uppercase tracking-wide">
                  Careers
                </Link>
                <Link href="/showcase" className="text-sm text-purple-300 hover:text-fuchsia-400 transition-colors uppercase tracking-wide">
                  Showcase
                </Link>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4 uppercase tracking-wider text-cyan-400">
                Connect
              </h3>
              <p className="text-sm text-purple-300 mb-2 font-mono">
                {content?.phoneNumber || '918-856-5711'}
              </p>
              <p className="text-sm text-purple-300 uppercase tracking-wide">
                Tulsa, Oklahoma
              </p>
            </div>
          </div>
          <div className="text-center pt-8 border-t-2 border-fuchsia-500/30">
            <p className="text-sm text-purple-400 uppercase tracking-wider">
              © 2025 Clean Machine Auto Detail. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
