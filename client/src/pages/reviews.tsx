import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft, Star } from "lucide-react";
import { Link } from "wouter";
import GoogleReviews from "@/components/GoogleReviews";

export default function ReviewsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-950/10 to-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              asChild
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/50"
              data-testid="button-back-home"
            >
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>

            <Button
              variant="outline"
              className="border-blue-500 text-blue-300 hover:bg-blue-950/50"
              asChild
              data-testid="button-leave-review"
            >
              <a 
                href="https://g.page/r/CQo53O2yXrN8EBM/review" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Star className="h-4 w-4 mr-2" />
                Leave a Review on Google
                <ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200">
              Customer Reviews
            </h1>
            <p className="text-blue-200/70 text-lg max-w-2xl mx-auto">
              See what our customers are saying about Clean Machine Auto Detail
            </p>
          </div>

          {/* Google Reviews Component */}
          <GoogleReviews placeId="ChIJVX4B3d2TtocRCjnc7bJevHw" />

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-16 text-center"
          >
            <div className="bg-gradient-to-r from-blue-900/30 to-blue-950/30 rounded-2xl p-8 max-w-2xl mx-auto border border-blue-800/30">
              <h3 className="text-2xl font-bold mb-4 text-blue-100">
                Ready to Experience Premium Detailing?
              </h3>
              <p className="text-blue-200/70 mb-6">
                Join hundreds of satisfied customers who trust Clean Machine for their auto detailing needs
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                  asChild
                  data-testid="button-book-now"
                >
                  <Link href="/chat">
                    Book Your Detail Now
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-blue-500 text-blue-300 hover:bg-blue-950/50"
                  asChild
                  data-testid="button-view-gallery"
                >
                  <Link href="/gallery">
                    View Our Work
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
