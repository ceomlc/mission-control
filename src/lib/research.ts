import { invoke } from './openclaw';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  siteName?: string;
}

export interface FetchResult {
  text: string;
  url: string;
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

/**
 * Fetch webpage content using OpenClaw
 */
export async function web_fetch(url: string, maxChars: number = 10000): Promise<FetchResult> {
  try {
    const result = await invoke<{
      text?: string;
      content?: string;
      url?: string;
    }>('web_fetch', { url, maxChars });
    
    return {
      text: result.text || result.content || '',
      url: result.url || url
    };
  } catch (error) {
    console.error('Web fetch error:', error);
    return { text: '', url };
  }
}
