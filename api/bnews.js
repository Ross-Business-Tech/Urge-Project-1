import { rss } from './_lib.js';
// Bing News search feed for the News check.
export default (req, res) => rss(req, res, 'https://www.bing.com/news/search');
