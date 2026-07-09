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
import { Download } from "lucide-react";
import { PretrainFeatureArgs } from "@/lib/data-processing/llm_config";
import { savePdfToCache, saveTextFileToCache } from "@/lib/data-processing/local_dataset";
import { DATASET_CACHE_NAME, getFromCacheStorage } from "@/lib/data-processing/tokenization_pipeline";
import { toaster } from "@/components/toaster";


const SupportedFileMimeTypes: Record<string, string> = {
    "txt": "text/plain",
    "pdf": "application/pdf"
}


export default function FileDataset({ type, closeMenu }: { type: "pretrain" | "finetune", closeMenu: () => void }) {
    const { project_config, full_render } = useProject<LLMConfig>();
    const [files, setFiles] = React.useState<File[]>([]);

    const allowed_mimes = Object.values(SupportedFileMimeTypes);
    const allowed_file_types = Object.keys(SupportedFileMimeTypes)
        .map(i => i.toUpperCase()).join(", ");


    const onChangeFiles = (file_list: FileList | null) => {
        if (!file_list || file_list?.length == 0) {
            return;
        }

        const valid_files = [...file_list]
            .filter(file => !!file.name && allowed_mimes.includes(file.type));

        setFiles(valid_files);
    }


    const onSubmit = async () => {
        for (const file of files) {
            let url: string;
            if (file.type == "application/pdf") {
                url = await savePdfToCache(file);
            } else if (file.type == "text/plain") {
                url = await saveTextFileToCache(file);
            } else {
                continue;
            }

            project_config.preprocessing.pretraining_datasets[url] = null;
        }

        closeMenu();
        full_render();
    }


    return <Card id="llm-dataset-wiki-container" className="bg-transparent border-0 flex flex-col h-full min-h-0">
        <CardHeader className="px-0 sm:px-6">
            <CardTitle className="text-xl flex gap-2 items-center">Load your own datasets</CardTitle>
            <CardDescription className="flex flex-col gap-2">
                <span>Use your own text files and PDF documents for training. These files do not leave your device and are stored in your browser&apos;s CacheStorage.</span>
            </CardDescription>
        </CardHeader>

        <CardContent className="text-sm text-muted-foreground space-y-6 flex flex-col grow min-h-0 px-0 sm:px-6 overflow-auto">
            <label htmlFor="llm-dataset-file-input" className="border-2 border-dashed rounded-md flex flex-col gap-2 justify-center items-center p-5 sm:p-10 cursor-pointer">
                {files.length == 0
                    ? <>
                        <Download />
                        <span>Browse {allowed_file_types} files</span>
                    </>
                    : <span className="wrap-anywhere text-center">{files.map(file => file.name).join(", ")}</span>}
            </label>
            <input
                id="llm-dataset-file-input" type="file" hidden multiple
                accept={Object.values(SupportedFileMimeTypes).join(",")}
                onChange={event => onChangeFiles(event.target.files)}
            />
        </CardContent>

        <CardContent className="px-0 sm:px-6">
            <DialogFooter className="flex flex-row">
                <DialogClose asChild className="grow sm:grow-0">
                    <Button className="cursor-pointer" variant="outline">Cancel</Button>
                </DialogClose>
                <Button className="cursor-pointer grow sm:grow-0" disabled={files.length == 0} onClick={onSubmit}>Add</Button>
            </DialogFooter>
        </CardContent>
    </Card>
}