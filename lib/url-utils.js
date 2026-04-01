export function searchLink(baseUrl, query) {
  return `${baseUrl}${encodeURIComponent(query)}`;
}

export function youtubeSearchUrl(query) {
  return searchLink("https://www.youtube.com/results?search_query=", query);
}
