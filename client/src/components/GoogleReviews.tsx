import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, StarHalf, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url?: string;
}

interface GoogleReviewsProps {
  placeId: string;
}

const GoogleReviews: React.FC<GoogleReviewsProps> = ({ placeId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const reviewsPerPage = 3;

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        
        // Try to fetch from API first
        const response = await fetch(`/api/google-reviews?placeId=${placeId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.reviews && data.reviews.length > 0) {
            setReviews(data.reviews);
            setLoading(false);
            return;
          }
        }
        
        // Fallback to local reviews data
        const { mockReviews } = await import('@/data/reviews');
        setReviews(mockReviews);
      } catch (err) {
        console.error('Error fetching Google reviews:', err);
        // Load local reviews as fallback
        const { mockReviews } = await import('@/data/reviews');
        setReviews(mockReviews);
      } finally {
        setLoading(false);
      }
    };
    
    if (placeId) {
      fetchReviews();
    } else {
      setError('No Place ID provided');
      setLoading(false);
    }
  }, [placeId]);

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`star-${i}`} className="w-4 h-4 text-yellow-400 fill-yellow-400" />);
    }
    
    if (hasHalfStar) {
      stars.push(<StarHalf key="half-star" className="w-4 h-4 text-yellow-400 fill-yellow-400" />);
    }
    
    return stars;
  };

  // Calculate pagination
  const totalPages = Math.ceil(reviews.length / reviewsPerPage);
  const displayedReviews = reviews.slice(
    currentPage * reviewsPerPage, 
    (currentPage + 1) * reviewsPerPage
  );
  
  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };
  
  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-black/30 animate-pulse">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-24"></div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 bg-blue-900/20 rounded-lg p-6 border border-blue-800/50">
        <div className="inline-block bg-blue-800/30 p-3 rounded-full mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-blue-200 mb-2">Taking a Quick Break</h3>
        <p className="text-blue-300 mb-4">Our review system is freshening up. Don't worry, we'll be back shortly!</p>
        <div className="text-blue-300 mb-4">
          In the meantime, check out what our customers are saying about us directly:
        </div>
        <button 
          onClick={() => window.open('https://g.co/kgs/mZHbtbZ', '_blank')}
          className="px-4 py-2 bg-blue-600/40 hover:bg-blue-600/60 text-blue-100 rounded-md transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/30 transform hover:scale-105"
        >
          View Our Google Business Profile
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block ml-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 bg-blue-900/20 rounded-lg p-6 border border-blue-800/50">
        <div className="inline-block bg-blue-800/30 p-3 rounded-full mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-blue-200 mb-2">Reviews Coming Soon</h3>
        <p className="text-blue-300 mb-4">We're gathering our customer feedback to showcase here.</p>
        <div className="text-blue-300 mb-4">
          Check back soon or visit our Google Business Profile directly:
        </div>
        <button 
          onClick={() => window.open('https://g.co/kgs/mZHbtbZ', '_blank')}
          className="px-4 py-2 bg-blue-600/40 hover:bg-blue-600/60 text-blue-100 rounded-md transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/30 transform hover:scale-105"
        >
          See All Reviews
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block ml-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {displayedReviews.map((review, index) => (
          <Card key={index} className="bg-black/30 border-gray-700 hover:border-blue-700 transition-all duration-300 hover:shadow-md hover:shadow-blue-900/20 transform hover:translate-y-[-5px]">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                {review.profile_photo_url ? (
                  <img 
                    src={review.profile_photo_url} 
                    alt={review.author_name} 
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">{review.author_name}</p>
                  <div className="flex">
                    {renderStars(review.rating)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 line-clamp-4">{review.text}</p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(review.time * 1000).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-center mt-6 space-x-4">
          <Button 
            className="bg-blue-600/50 hover:bg-blue-600/70 text-white border-blue-700 hover:border-blue-500 transition-all duration-300 transform hover:scale-105"
            size="sm" 
            onClick={prevPage}
            disabled={reviews.length <= reviewsPerPage}
          >
            Previous
          </Button>
          <Button 
            className="bg-blue-600/50 hover:bg-blue-600/70 text-white border-blue-700 hover:border-blue-500 transition-all duration-300 transform hover:scale-105"
            size="sm" 
            onClick={nextPage}
            disabled={reviews.length <= reviewsPerPage}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default GoogleReviews;