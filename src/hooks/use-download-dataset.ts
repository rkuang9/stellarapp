import React from "react";

import { datasetFileURL, downloadHFDatasetToCache } from "@/lib/data-processing/huggingface_datasets";
import { downloadWikiArticleToCache } from "@/lib/data-processing/wikipedia_datasets";
import { getFromCacheStorage } from "@/lib/data-processing/tokenization_pipeline";

const PARALLEL_DOWNLOAD_LIMIT = 5;

type DownloadStatus = "pending" | "downloading" | "complete" | "error";

interface DownloadPaths {
    [url: string]: { files: string[] } | null;
}

export interface DownloadState {
    [url: string]: {
        status: DownloadStatus,
        controller: AbortController,
        files: string[] | null,
        note?: string
    }
}


export function useDownloadDataset(urls: DownloadPaths, cache_name: string, do_download: boolean) {
    const download_plan = Object.keys(urls)
        .sort()
        .map(url => `${url}${urls[url]?.files?.toSorted().join(",")}`)
        .join(",");

    const [downloads, setDownloads] = React.useState<DownloadState>({});
    const inflight = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        // stops all in-progress downloads, the set state is for
        // getting the most recent state
        return () => {
            setDownloads(old => {
                Object.values(old).forEach(url => {
                    if (url.status === "downloading" || url.status === "pending") {
                        url.controller.abort();
                    }
                });

                return old;
            });
        };
    }, []);


    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        // queue new URLs
        setDownloads(old => {
            const new_status = { ...old };
            let changed = false;

            for (const url of Object.keys(urls)) {
                if (!old[url]) {
                    // adding new dataset
                    changed = true;

                    new_status[url] = {
                        status: "pending",
                        controller: new AbortController(),
                        files: urls[url]?.files ? structuredClone(urls[url].files) : null,
                    }
                } else if (urls[url]?.files && old[url].files &&
                    urls[url].files.toSorted().join(",") !=
                    old[url].files?.toSorted().join(",")
                ) {
                    // changing already added dataset's files (e.g. Huggingface file selections changed)
                    changed = true;

                    old[url].controller.abort();
                    new_status[url] = {
                        files: structuredClone(urls[url].files),
                        status: "pending",
                        controller: new AbortController()
                    }
                }
            }

            for (const url of Object.keys(old)) {
                if (!(url in urls)) {
                    if (old[url].status == "downloading") {
                        old[url].controller.abort();
                    }

                    changed = true;
                    delete new_status[url];
                }
            }

            return changed ? new_status : old;
        });
    }, [download_plan]);


    React.useEffect(() => {
        const queued_urls = Object.keys(downloads)
            .filter(i => downloads[i].status == "pending" && !inflight.current.has(i))
            .slice(0, Math.max(0, PARALLEL_DOWNLOAD_LIMIT - inflight.current.size));

        if (queued_urls.length == 0) {
            return;
        }

        let is_stale = false;

        if (inflight.current.size >= PARALLEL_DOWNLOAD_LIMIT) {
            return;
        }

        if (!do_download) {
            // don't run downloads, just check if they exist in the CacheStorage
            const getAlreadyDownloadedQueuedUrls = async () => {
                const already_downloaded: string[] = [];

                // check CacheStorage for the existence of the dataset
                for (const url of queued_urls) {
                    if (!downloads[url].files) {
                        // single datasets e.g. Wikipedia articles
                        if (await getFromCacheStorage(cache_name, url)) {
                            already_downloaded.push(url);
                        }
                    } else {
                        // dataset that may have multiple files e.g. Huggingface
                        const files = await Promise.all(downloads[url].files
                            .map(file => getFromCacheStorage(cache_name, datasetFileURL(url, file))))
                        const missing = files.filter(response => !response);

                        if (missing.length == 0) {
                            already_downloaded.push(url);
                        }
                    }
                }
                return already_downloaded;
            };

            getAlreadyDownloadedQueuedUrls().then(already_cached => {
                if (is_stale || already_cached.length == 0) {
                    return;
                }

                setDownloads(old => {
                    const new_status = { ...old };
                    already_cached.forEach(url => {
                        new_status[url] = { ...new_status[url], status: "complete" };
                    });

                    return new_status;
                });
            })
        } else {
            // set the queued URLs status to download for the caller
            setDownloads(old => {
                const new_status = { ...old };
                queued_urls.forEach(url => {
                    new_status[url] = { ...new_status[url], status: "downloading" };
                });
                return new_status;
            });

            for (const queued_url of queued_urls) {
                inflight.current.add(queued_url);

                // state updater function for the current queued URL
                const updateDownloads = (status: DownloadStatus, note?: string) => {
                    setDownloads(old => {
                        return { ...old, [queued_url]: { ...old[queued_url], status, note } };
                    });
                }

                let origin: URL;

                try {
                    origin = new URL(queued_url);
                } catch {
                    updateDownloads("error", "Dataset URL is invalid");
                    continue;
                }

                if (origin.hostname == "localhost" && origin.pathname.startsWith("/files/")) {
                    // handles local files, they are downloaded but we just verify they exist
                    // and track them
                    getFromCacheStorage(cache_name, queued_url).then(response => {
                        updateDownloads("complete")
                    }).catch(error => {
                        updateDownloads("error", error.toString());
                    });
                } else if (origin.hostname == "huggingface.co") {
                    const files = urls[queued_url]?.files

                    if (!files) {
                        inflight.current.delete(queued_url);
                        updateDownloads("error", `No files selected for ${queued_url}`)
                        continue;
                    }

                    downloadHFDatasetToCache(queued_url, files, {
                        cacheName: cache_name,
                        abort: downloads[queued_url].controller
                    }).then(() => {
                        updateDownloads("complete");
                    }).catch(error => {
                        updateDownloads("error", error.toString());
                    }).finally(() => {
                        inflight.current.delete(queued_url);
                    });
                } else if (origin.hostname.endsWith("wikipedia.org")) {
                    downloadWikiArticleToCache(queued_url, {
                        cacheName: cache_name
                    }).then(() => {
                        updateDownloads("complete");
                    }).catch(error => {
                        updateDownloads("error", error.toString());
                    }).finally(() => {
                        inflight.current.delete(queued_url);
                    });
                } else {
                    inflight.current.delete(queued_url);
                    updateDownloads("error", "Unsupported dataset source");
                }
            }
        }

        return () => { is_stale = true };
    }, [downloads, do_download]);
    /* eslint-enable react-hooks/exhaustive-deps */

    return { downloads }
}
