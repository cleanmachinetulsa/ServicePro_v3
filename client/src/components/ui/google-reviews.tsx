
import { useEffect, useState } from 'react';

interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: number;
}

interface GoogleReviewsProps {
  placeId: string;
}

export function GoogleReviews({ placeId }: GoogleReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch(`/api/google-reviews?placeId=${placeId}`);
        if (!response.ok) throw new Error('Failed to fetch reviews');
        const data = await response.json();
        setReviews(data.reviews);
      } catch (err) {
        setError('Failed to load reviews');
        console.error('Error fetching reviews:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [placeId]);

  if (loading) return <div className="text-center py-8">Loading reviews...</div>;
  if (error) return <div className="text-center text-red-500 py-8">{error}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {reviews.map((review, index) => (
        <div key={index} className="bg-white/5 p-6 rounded-lg backdrop-blur">
          <div className="flex items-center mb-4">
            <div className="text-yellow-400">
              {'★'.repeat(review.rating)}
              {'☆'.repeat(5 - review.rating)}
            </div>
            <span className="ml-2 text-gray-300">{review.author_name}</span>
          </div>
          <p className="text-gray-200">{review.text}</p>
          <div className="mt-2 text-sm text-gray-400">
            {new Date(review.time * 1000).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
