import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Search, Loader2, ArrowRight, Clock, X, Settings, Layout, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import Fuse from 'fuse.js';
import { searchableItems, SearchableItem } from '@/lib/searchIndex';

interface SearchResult {
  name: string;
  path: string;
  description: string;
}

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY_ITEMS = 5;

// Initialize Fuse.js for fuzzy search
const fuse = new Fuse(searchableItems, {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'description', weight: 1.5 },
    { name: 'keywords', weight: 1 },
    { name: 'section', weight: 0.5 }
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
});

export function AiHelpSearch() {
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<SearchableItem[]>([]);
  const [aiResults, setAiResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);

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
        setQuery('');
        setLocalResults([]);
        setAiResults([]);
        setSelectedIndex(0);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (resultRefs.current[selectedIndex]) {
      resultRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // Instant local search with AI fallback
  useEffect(() => {
    if (query.trim().length === 0) {
      setLocalResults([]);
      setAiResults([]);
      setShowDropdown(false);
      setSelectedIndex(0);
      return;
    }

    // Instant local search
    const fuseResults = fuse.search(query);
    const localSearchResults = fuseResults
      .slice(0, 10)
      .map(result => result.item);
    
    setLocalResults(localSearchResults);
    setShowDropdown(true);
    setShowHistory(false);
    setSelectedIndex(0);

    // AI fallback: only query if local results < 3 AND query > 3 chars
    if (localSearchResults.length < 3 && query.trim().length > 3) {
      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Debounce AI search
      debounceTimer.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const response = await apiRequest('POST', '/api/search/help', { query });
          const data = await response.json();
          setAiResults(data.results || []);
        } catch (error) {
          console.error('AI search error:', error);
        } finally {
          setIsSearching(false);
        }
      }, 500);

      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    } else {
      setAiResults([]);
      setIsSearching(false);
    }
  }, [query]);

  // Combine and categorize results
  const allResults = [...localResults];
  
  // Add AI results that don't duplicate local results
  const localPaths = new Set(localResults.map(r => r.path));
  const uniqueAiResults = aiResults
    .filter(ai => !localPaths.has(ai.path))
    .map(ai => ({
      id: `ai-${ai.path}`,
      name: ai.name,
      description: ai.description,
      path: ai.path,
      category: 'action' as const,
      keywords: []
    }));
  
  allResults.push(...uniqueAiResults);

  // Group results by category
  const groupedResults = allResults.reduce((acc, item, index) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push({ ...item, globalIndex: index });
    return acc;
  }, {} as Record<string, (SearchableItem & { globalIndex: number })[]>);

  // Category display order and labels
  const categoryOrder: Array<'page' | 'setting' | 'action'> = ['page', 'setting', 'action'];
  const categoryLabels = {
    page: 'Pages',
    setting: 'Settings',
    action: 'Actions'
  };
  const categoryIcons = {
    page: Layout,
    setting: Settings,
    action: Zap
  };

  const handleResultClick = (path: string) => {
    saveToHistory(query);
    navigate(path);
    setQuery('');
    setLocalResults([]);
    setAiResults([]);
    setShowDropdown(false);
    setShowHistory(false);
    setSelectedIndex(0);
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
  };

  const handleInputFocus = () => {
    if (query.trim().length === 0 && searchHistory.length > 0) {
      setShowHistory(true);
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle keyboard navigation when dropdown is shown
    if (!showDropdown || allResults.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        setShowHistory(false);
        setQuery('');
        setLocalResults([]);
        setAiResults([]);
        setSelectedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allResults[selectedIndex]) {
          handleResultClick(allResults[selectedIndex].path);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setShowHistory(false);
        setQuery('');
        setLocalResults([]);
        setAiResults([]);
        setSelectedIndex(0);
        break;
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search pages, settings, actions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
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

      {/* Categorized results dropdown */}
      {showDropdown && allResults.length > 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 shadow-lg max-h-96 overflow-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="p-2">
            {categoryOrder.map(category => {
              const items = groupedResults[category];
              if (!items || items.length === 0) return null;

              const CategoryIcon = categoryIcons[category];

              return (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                    <CategoryIcon className="h-3 w-3" />
                    {categoryLabels[category]}
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      ref={(el) => { resultRefs.current[item.globalIndex] = el; }}
                      onClick={() => handleResultClick(item.path)}
                      className={`w-full text-left p-3 rounded-md transition-all flex items-start gap-3 group border-b border-gray-100 dark:border-gray-700 last:border-0 ${
                        selectedIndex === item.globalIndex
                          ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500 dark:ring-blue-400'
                          : 'hover:bg-blue-50 dark:hover:bg-gray-700'
                      }`}
                      data-testid={`search-result-${item.globalIndex}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-base flex items-center gap-2 text-gray-900 dark:text-white">
                          {item.name}
                          {item.section && (
                            <span className="text-xs font-normal text-muted-foreground">
                              · {item.section}
                            </span>
                          )}
                          <ArrowRight className={`h-4 w-4 flex-shrink-0 transition-opacity ${
                            selectedIndex === item.globalIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          } text-blue-600 dark:text-blue-400`} />
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed whitespace-normal break-words line-clamp-2">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
            
            {/* AI results indicator */}
            {isSearching && (
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching for more results...
              </div>
            )}
          </div>
        </Card>
      )}

      {/* No results message */}
      {showDropdown && !isSearching && query.trim().length > 0 && allResults.length === 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="p-4 text-center">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              No results found for "{query}"
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Try different keywords or check spelling
            </div>
          </div>
        </Card>
      )}

      {/* Empty state hint */}
      {query.trim().length === 0 && !showHistory && showDropdown && (
        <Card className="absolute top-full mt-2 w-full z-50 shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="p-4 text-sm text-muted-foreground">
            Start typing to search pages, settings, and actions...
          </div>
        </Card>
      )}
    </div>
  );
}
