import { DATASET_CACHE_NAME } from "@/lib/data-processing/tokenization_pipeline";

/**
 * Expected Wikipedia article format: https://<language>.wikipedia.org/wiki/<article_title>
 */
export function parseWikiArticleLink(url: string) {
    const { hostname, pathname } = new URL(url);

    if (!hostname.endsWith("wikipedia.org")) {
        throw Error(`Not a Wikipedia article URL: ${url}`);
    };

    // the language part of the subdomain
    const subdomain = hostname.split('.')[0];

    if (pathname.startsWith("/wiki/")) {
        // the article title is everything after the /wiki/, hashtags and
        // other parameters are discarded by the URL class
        const title = decodeURIComponent(pathname.substring(6));

        return {
            language: subdomain === "wikipedia" ? "www" : subdomain,
            title
        };
    }

    throw Error(`Unexpected Wikipedia article format: ${url}`);
}


export function cleanedWikipediaArticle(url: string) {
    const { language, title } = parseWikiArticleLink(url);

    return `https://${language}.wikipedia.org/wiki/${title}`;
}


interface DownloadWikiArticleToCacheArgs {
    overwrite?: boolean;
    cacheName?: string;
    abort?: AbortController;
}


export async function downloadWikiArticleToCache(url: string, options?: DownloadWikiArticleToCacheArgs) {
    const cache = await caches.open(options?.cacheName ?? DATASET_CACHE_NAME);

    if (!options?.overwrite) {
        // fetch from CacheStorage        
        const cached_file = await cache.match(url);

        if (cached_file) {
            return;
        }
    }

    const { language, title } = parseWikiArticleLink(url);

    if (!title) {
        throw new Error(`Unknown article title for: ${url}`);
    }
    
    const endpoint = `https://${language}.wikipedia.org/w/api.php?action=query&prop=extracts&format=json&explaintext&origin=*&titles=${title}`;

    const article = await fetch(endpoint, {
        signal: options?.abort?.signal
    });

    if (article.status != 200) {
        throw new Error(`Failed to fetch article (status ${article.status}): ${url}`);
    }

    const json = await article.json();
    const pages = json?.query?.pages;

    if (!pages || typeof pages != "object") {
        throw new Error(`Invalid article response structure: ${url}`);
    }

    const page_id = Object.keys(pages)[0];
    const article_text = pages[page_id]?.extract;

    if (!article_text || typeof article_text != "string" || article_text.length == 0) {
        throw new Error(`Article has no extract: ${url}`);
    }

    // save to CacheStorage
    await cache.put(url, new Response(article_text, {
        headers: {
            "content-type": "text/plain",
            retrieved: new Date().toISOString(),
            "Tokenized": "false"
        }
    }));
}
