import React from "react";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { clamp } from "@/lib/utility";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProject } from "@/features/training/project-contexts";
import { type LLMConfig } from "@/lib/data-processing/llm_config";
import { cleanedWikipediaArticle, parseWikiArticleLink } from "@/lib/data-processing/wikipedia_datasets";


export default function WikipediaDataset({ closeMenu }: { closeMenu: () => void }) {
    const { project_config, full_render } = useProject<LLMConfig>();
    const [urls, setUrls] = React.useState<string>("");
    const [bad_urls, setBadURLs] = React.useState<string[]>([]);

    const onSubmit = () => {
        setBadURLs([]);

        const articles = urls.split("\n");
        const bad: string[] = [];

        for (const article of articles) {
            const { language, title } = parseWikiArticleLink(article);

            if (!language || !title) {
                bad.push(article);
            }
        }

        if (bad.length > 0) {
            setBadURLs(bad);
            return;
        }

        for (const article of articles) {
            const article_link = cleanedWikipediaArticle(article);
            project_config.preprocessing.pretraining_datasets[article_link] = null;
        }

        closeMenu();
        full_render();
    }

    const onBlur = () => {
        setUrls(urls.split("\n").filter(link => !!link).join("\n"));
    }

    return <Card id="llm-dataset-wiki-container" className="bg-transparent border-0 flex flex-col h-full min-h-0">
        <CardHeader className="px-0 sm:px-6">
            <CardTitle className="text-xl flex gap-2 items-center">Add Wikipedia Articles</CardTitle>
            <CardDescription className="flex flex-col gap-2">
                Add any Wikipedia article as a training dataset for your language model.
            </CardDescription>
        </CardHeader>

        <CardContent className="text-sm text-muted-foreground space-y-6 flex flex-col grow min-h-0 px-0 sm:px-6">
            <Textarea
                id="llm-dataset-wiki-urls"
                className="bg-secondary field-sizing-fixed w-full resize-none shrink-0 text-sm"
                rows={clamp(4, urls.split("\n").length, 10)}
                value={urls}
                spellCheck={false}
                onChange={event => setUrls(event.target.value)}
                onBlur={onBlur}
                placeholder={[
                    "Example (one URL per line)",
                    "https://en.wikipedia.org/wiki/Generative_pre-trained_transformer",
                    "https://en.wikipedia.org/wiki/Byte-pair_encoding"
                ].join("\n")} />

            {bad_urls.length > 0 && <div className="flex flex-col min-h-0">
                <span className="text-lg">Invalid articles</span>
                <div className="flex flex-col overflow-auto text-error">
                    {bad_urls.map((bad_url, index) => <span key={bad_url + index}>{bad_url}</span>)}
                </div>
            </div>}
        </CardContent>

        <CardContent className="px-0 sm:px-6">
            <DialogFooter className="flex flex-row">
                <DialogClose asChild className="grow sm:grow-0">
                    <Button className="cursor-pointer" variant="outline">Cancel</Button>
                </DialogClose>
                <Button className="cursor-pointer grow sm:grow-0" disabled={urls.length == 0} onClick={onSubmit}>Add</Button>
            </DialogFooter>
        </CardContent>
    </Card>
}
