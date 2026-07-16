import { extractText, getDocumentProxy } from "unpdf";
import { DATASET_CACHE_NAME } from "@/lib/data-processing/tokenization_pipeline";
import { parquetReadObjects } from "hyparquet";


interface SaveToCacheOptions {
    cacheName?: string;
}


export async function savePdfToCache(file: File, options?: SaveToCacheOptions) {
    const cache = await caches.open(options?.cacheName ?? DATASET_CACHE_NAME);

    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    const { text } = await extractText(pdf, { mergePages: true });
    const url = createLocalFileUrl(file.name);

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


export async function saveTextFileToCache(file: File, options?: SaveToCacheOptions) {
    const cache = await caches.open(options?.cacheName ?? DATASET_CACHE_NAME);

    const text = await file.text();
    const url = createLocalFileUrl(file.name);

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


export async function saveParquetFileToCache(file: File, options?: SaveToCacheOptions) {
    const cache = await caches.open(options?.cacheName ?? DATASET_CACHE_NAME);

    const url = createLocalFileUrl(file.name);

    await cache.put(url, new Response(file.stream(), {
        headers: {
            "content-type": "application/vnd.apache.parquet",
            retrieved: new Date().toISOString(),
            "Tokenized": "false"
        }
    }))

    return url;
}


function createLocalFileUrl(file_name: string) {
    return `https://localhost/files/${file_name}`;
}
