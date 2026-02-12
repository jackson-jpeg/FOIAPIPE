import client from './client';

export interface SearchResults {
  results: {
    foia: { id: string; case_number: string; status: string }[];
    articles: { id: string; headline: string; source: string }[];
    videos: { id: string; title: string; status: string }[];
    agencies: { id: string; name: string; email: string | null }[];
  };
}

export async function globalSearch(q: string): Promise<SearchResults> {
  const { data } = await client.get('/search', { params: { q } });
  return data;
}
