import { rss } from './_lib.js';
// Google News search feed (backup source for the News check).
export default (req, res) => rss(req, res, 'https://news.google.com/rss/search');
