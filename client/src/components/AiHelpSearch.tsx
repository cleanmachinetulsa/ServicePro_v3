import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Search, Loader2, ArrowRight, Clock, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SearchResult {
  name: string;
  path: string;
  description: string;
}

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY_ITEMS = 5;

export function AiHelpSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

  // Load search history from localStorage on mount
  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (error) {
        console.error('Failed to parse search history:', error);
      }
    }
  }, []);

  // Save search to history
  const saveToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const updatedHistory = [
      searchQuery,
      ...searchHistory.filter(item => item !== searchQuery)
    ].slice(0, MAX_HISTORY_ITEMS);
    
    setSearchHistory(updatedHistory);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
  };

  // Clear individual history item
  const removeFromHistory = (itemToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = searchHistory.filter(item => item !== itemToRemove);
    setSearchHistory(updatedHistory);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
  };

  // Clear all history
  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  // Close dropdown and clear query when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setShowHistory(false);
        setQuery('');  // Clear the search query
        setResults([]); // Clear results
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search function
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiRequest('POST', '/api/search/help', { query });
        const data = await response.json();
        setResults(data.results || []);
        setShowDropdown(true);
        // Save successful search to history
        if (data.results && data.results.length > 0) {
          saveToHistory(query);
        }
      } catch (error) {
        console.error('Search error:', error);
        toast({
          title: 'Search failed',
          description: 'Could not complete search. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSearching(false);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, toast]);

  const handleResultClick = (path: string) => {
    navigate(path);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setShowHistory(false);
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
  };

  const handleInputFocus = () => {
    if (query.trim().length === 0 && searchHistory.length > 0) {
      setShowHistory(true);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search for help... (try: messages, schedule, settings)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleInputFocus}
          className="pl-9 pr-10"
          data-testid="input-ai-search"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search history dropdown */}
      {showHistory && searchHistory.length > 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 shadow-lg max-h-96 overflow-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="p-2">
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <span>Recent searches</span>
              <button
                onClick={clearHistory}
                className="text-blue-600 dark:text-blue-400 hover:underline"
                data-testid="button-clear-history"
              >
                Clear all
              </button>
            </div>
            {searchHistory.map((item, index) => (
              <button
                key={index}
                onClick={() => handleHistoryClick(item)}
                className="w-full text-left p-3 rounded-md hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
                data-testid={`search-history-${index}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{item}</span>
                </div>
                <button
                  onClick={(e) => removeFromHistory(item, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  data-testid={`button-remove-history-${index}`}
                >
                  <X className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                </button>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 shadow-lg max-h-96 overflow-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="p-3">
            {results.map((result, index) => (
              <button
                key={index}
                onClick={() => handleResultClick(result.path)}
                className="w-full text-left p-4 rounded-md hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors flex items-start gap-3 group border-b border-gray-100 dark:border-gray-700 last:border-0"
                data-testid={`search-result-${index}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base flex items-center gap-2 text-gray-900 dark:text-white">
                    {result.name}
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed whitespace-normal break-words line-clamp-2">
                    {result.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* No results message */}
      {showDropdown && !isSearching && query.trim().length > 0 && results.length === 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-300">
            No results found. Try different keywords.
          </div>
        </Card>
      )}
    </div>
  );
}
