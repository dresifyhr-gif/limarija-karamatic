/**
 * Prepoznavanje zahtjeva koji NISU stvarno otvaranje stranice od strane čovjeka:
 * roboti za pregled poveznica (WhatsApp, Viber, Facebook/iMessage, Telegram, Slack…), tražilice, alati (curl…),
 * HEAD zahtjevi i prefetch/prerender preglednika. Koristi /ponuda/[token] (prvo otvaranje → viewed_at + obavijest).
 *
 * Pazi: ugrađeni preglednici aplikacija (Viber, Telegram, LinkedIn, Teams, Facebook…) otvaraju stranicu za STVARNOG
 * čovjeka i u User-Agentu nose ime aplikacije — zato se roboti prepoznaju po imenu robota (TelegramBot, LinkedInBot…),
 * a ne po golom imenu aplikacije, i ugrađeni preglednici se provjeravaju PRIJE popisa robota.
 */
const BOT_UA =
  /(?<!cu)bot\b|bot\/|spider|crawl|slurp|preview|whatsapp|facebookexternalhit|facebot|meta-externalagent|telegrambot|slackbot|slack-imgproxy|discordbot|viber|skypeuripreview|linkedinbot|twitterbot|pinterest|embedly|quora|vkshare|w3c_validator|redditbot|applebot|google(?:-|other|-inspectiontool)|bingpreview|yandex|baidu|duckduck|petal|semrush|ahrefs|mj12|headless|lighthouse|pagespeed|phantom|puppeteer|playwright|python|curl|wget|httpie|go-http|java\/|okhttp|axios|node-fetch|undici|libwww|scrapy|feed|mastodon|bytespider|gptbot|claude|perplexity|microsoft office|outlook-link|signal/i;

/** Oznake ugrađenih preglednika aplikacija (čovjek je dodirnuo poveznicu u aplikaciji). */
const IN_APP_TOKEN = /\b(?:Viber\/|Telegram-Android\/|Telegram-iOS|LinkedInApp|Teams\/|FBAN\/|FBAV\/|FB_IAB|Instagram \d|Line\/)/;

/** Pravi preglednički engine na mobitelu: Android WebView ("; wv)") ili iOS WebKit ("Mobile/…"). */
const MOBILE_WEBVIEW = /AppleWebKit\/[\d.]+/;
const MOBILE_MARK = /; wv\)|(?:iPhone|iPad|iPod).*Mobile\//;

/** Je li User-Agent ugrađeni preglednik aplikacije na mobitelu (čovjek), a ne robot za pregled poveznice. */
export function isInAppBrowser(ua: string): boolean {
  return IN_APP_TOKEN.test(ua) && MOBILE_WEBVIEW.test(ua) && MOBILE_MARK.test(ua) && !/(?<!cu)bot\b|bot\/|preview/i.test(ua);
}

/** true = User-Agent robota/alata (ili prazan). */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  const s = (ua ?? '').trim();
  if (!s) return true;
  if (isInAppBrowser(s)) return false;
  return BOT_UA.test(s);
}

/** true = prefetch/prerender (Chrome speculation rules, <link rel=prefetch>, Firefox). */
export function isPrefetch(request: Request): boolean {
  const h = request.headers;
  const purpose = `${h.get('sec-purpose') ?? ''} ${h.get('purpose') ?? ''} ${h.get('x-purpose') ?? ''} ${h.get('x-moz') ?? ''}`.toLowerCase();
  return /prefetch|prerender|preview/.test(purpose);
}

/** true = ne broji kao otvaranje (robot, pregled poveznice, HEAD ili prefetch). */
export function isPreviewRequest(request: Request): boolean {
  if (request.method !== 'GET') return true;
  return isBotUserAgent(request.headers.get('user-agent')) || isPrefetch(request);
}
