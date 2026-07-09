import { extractText, getDocumentProxy } from "unpdf";
import { DATASET_CACHE_NAME } from "@/lib/data-processing/tokenization_pipeline";


interface SavePdfToCacheArgs {
    cacheName?: string;
}


export async function savePdfToCache(file: File, options?: SavePdfToCacheArgs) {
    const cache = await caches.open(options?.cacheName ?? DATASET_CACHE_NAME);

    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    const { text } = await extractText(pdf, { mergePages: true });
    const url = `https://localhost/files/${file.name}`;

    // save to CacheStorage
    await cache.put(url, new Response(text, {
        headers: {
            "content-type": "text/plain",
            retrieved: new Date().toISOString(),
            "Tokenized": "false"
        }
    }));

    return url;
}


export async function saveTextFileToCache(file: File, options?: SavePdfToCacheArgs) {
    const cache = await caches.open(options?.cacheName ?? DATASET_CACHE_NAME);

    const text = await file.text();
    const url = `https://localhost/files/${file.name}`;

    // save to CacheStorage
    await cache.put(url, new Response(text, {
        headers: {
            "content-type": "text/plain",
            retrieved: new Date().toISOString(),
            "Tokenized": "false"
        }
    }));

    return url;
}
