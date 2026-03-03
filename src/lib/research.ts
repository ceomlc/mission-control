import { invoke } from './openclaw';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  siteName?: string;
}

/**
 * Web search using OpenClaw's Brave Search
 */
export async function web_search(query: string, count: number = 5): Promise<SearchResult[]> {
  try {
    const result = await invoke<{
      results?: SearchResult[];
      externalContent?: {
        results?: SearchResult[];
      };
    }>('web_search', { query, count });
    
    // Handle wrapped response format
    if (result.externalContent?.results) {
      return result.externalContent.results;
    }
    return result.results || [];
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}
