import React from "react";

import {
    X as CloseIcon,
    FileText,
    Plus,
    Newspaper,
    Trash2,
    Trash,
    LoaderCircle,
    Download,
    Info,
    Folder,
} from "lucide-react";
import { Container } from "@/features/training/container";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogOverlay
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { toaster } from "@/components/toaster";

import HuggingfaceLogo from "@/components/icons/huggingface";
import WikipediaWLogo from "@/components/icons/wikipedia-letter";

import { GPTContext } from "@/features/training/gpt/gpt-contexts";
import { useProject } from "@/features/training/project-contexts";
import WikipediaDataset from "@/features/training/gpt/dataset-wiki";
import HuggingfaceDataset from "@/features/training/gpt/dataset-huggingface";
import { type LLMConfig } from "@/lib/data-processing/llm_config";
import { parseDatasetURL } from "@/lib/data-processing/huggingface_datasets";
import { useDialogue } from "@/components/dialogue";
import { useDownloadDataset, DownloadState } from "@/hooks/use-download-dataset";
import { parseWikiArticleLink } from "@/lib/data-processing/wikipedia_datasets";
import { DATASET_CACHE_NAME, DATASET_TOKENIZED_CACHE_NAME } from "@/lib/data-processing/tokenization_pipeline";
import { SelectField } from "@/components/custom/select-field";
import { Label } from "@/components/ui/label";
import useRender from "@/components/use-render";
import FileDataset from "@/features/training/gpt/dataset-file";


export default function Dataset() {
    const { project_config, full_render, worker } = useProject<LLMConfig>();
    const { status } = React.useContext(GPTContext);
    const { Dialogue, confirmation, notify } = useDialogue();
    const [can_clear_cache, setCanClearCache] = React.useState<boolean>(false);
    const [auto_download, setAutoDownload] = React.useState<boolean>(false);
    const local_render = useRender();

    // combines finetune and pretrain datasets into a single list for the download hook
    const total_dataset = (() => {
        const total = Object.fromEntries(Object.entries(project_config.preprocessing.pretraining_datasets).map(([url, meta]) => {
            return [url, meta?.files ? { files: structuredClone(meta.files) } : null]
        }));

        const pretrain = project_config.preprocessing.finetuning_datasets;

        Object.keys(pretrain).forEach(url => {
            if (pretrain[url].files) {
                total[url] = {
                    files: [...new Set([
                        ...total[url]?.files || [],
                        ...pretrain[url].files])]
                };
            }
        });
        return total;
    })();

    const { downloads } = useDownloadDataset(total_dataset, DATASET_CACHE_NAME, auto_download);

    React.useEffect(() => {
        // must be on https to work (required in dev mode if viewed on a different device)
        try {
            caches.open(DATASET_CACHE_NAME).then(async cache => {
                setCanClearCache((await cache.keys()).length > 0);
            }).catch(() => {
                setCanClearCache(false);
            })
        } catch (error: any) {
            toaster.error(error.toString());
        }
    }, [project_config.preprocessing.pretraining_datasets, project_config.preprocessing.finetuning_datasets])

    React.useEffect(() => {
        let all_ok = true;

        const dataset_urls = Object.keys(total_dataset);

        if (dataset_urls.length == 0) {
            all_ok = false;
        } else {
            for (const i of dataset_urls) {
                if (downloads[i] && downloads[i].status != "complete") {
                    all_ok = false;
                }
            }
        }

        if (status.dataset != all_ok) {
            status.dataset = all_ok;
            full_render();
        }
    });


    const enableAutoDownload = async () => {
        if (!auto_download) {
            const confirm_download = await confirmation({
                title: "Enable dataset downloading",
                description: "Datasets will now be downloaded automatically as you add them." +
                    " Consider using a Wi-Fi connection to avoid significant data consumption for large downloads." +
                    "\n\nDatasets are stored in your browser's CacheStorage. If you are using" +
                    " incognito/private mode, check your browser's CacheStorage limit.",
                yes: "Download"
            });

            if (confirm_download) {
                setAutoDownload(true);
            }
        } else {
            setAutoDownload(false);
        }
    }


    const confirmClearCacheStorage = async () => {
        const dataset_cache_is_empty =
            (await (await caches.open(DATASET_CACHE_NAME)).keys()).length == 0 &&
            (await (await caches.open(DATASET_TOKENIZED_CACHE_NAME)).keys()).length == 0;

        const clear_the_cache = Object.keys(project_config.preprocessing.finetuning_datasets).length == 0 &&
            Object.keys(project_config.preprocessing.pretraining_datasets).length == 0 && (!dataset_cache_is_empty);

        if (clear_the_cache) {
            if (await confirmation({
                title: "Clear the dataset cache?",
                description: "This will clear your browser's CacheStorage of all downloaded datasets. Are you sure?"
            })) {

                if (await caches.delete(DATASET_CACHE_NAME) && await caches.delete(DATASET_TOKENIZED_CACHE_NAME)) {
                    toaster.success("The browser's CacheStorage has been cleared.");
                    setCanClearCache(false);
                } else {
                    toaster.error(`Failed to completely clear the CacheStorage. Use the browser's` +
                        ` developer console to delete ${DATASET_CACHE_NAME} and ${DATASET_TOKENIZED_CACHE_NAME}`);
                }

                full_render();
            }

            return;
        }

        if (await confirmation({
            title: "Remove all datasets?",
            description: `Are you sure you want to remove all datasets from this project?\n\n${!clear_the_cache ? "Use this option again to clear your CacheStorage of all downloaded datasets." : ""}`
        })) {
            project_config.preprocessing.finetuning_datasets = {};
            project_config.preprocessing.pretraining_datasets = {};
            full_render();
        }
    }

    const stride_options = {
        "1.00": "No overlap (best for large datasets)",
        "0.50": "Some overlap (50% of context length)",
        "0.25": "Significant overlap (25% of context length)",
        "0.00": "Maximum overlap (for small datasets)"
    }

    const explainStride = () => {
        notify({
            title: "Stride",
            description: <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-sm">Stride determines the amount of overlap when generating training samples</span>

                <div>
                    <span className="text-muted-foreground text-sm">Zero overlap</span>
                    <ul>
                        <li className="list-disc list-inside text-sm text-muted-foreground pl-5">
                            Uses stride = context length
                        </li>
                        <li className="list-disc list-inside text-sm text-muted-foreground pl-5">
                            Lower training sample count due to less redundancy
                        </li>
                        <li className="list-disc list-inside text-sm text-muted-foreground pl-5">
                            Ideal for large datasets or pre-training
                        </li>
                    </ul>
                </div>

                <div>
                    <span className="text-muted-foreground text-sm">Maximum overlap</span>
                    <ul>
                        <li className="list-disc list-inside text-sm text-muted-foreground pl-5">
                            Uses stride = 1 token
                        </li>
                        <li className="list-disc list-inside text-sm text-muted-foreground pl-5">
                            Highest training sample count
                        </li>
                        <li className="list-disc list-inside text-sm text-muted-foreground pl-5">
                            Ideal for very small datasets
                        </li>
                    </ul>
                </div>
            </div>
        })
    }


    const onChangeStride = (type: "pretraining" | "finetuning", stride: string) => {
        const stride_value = Number(stride);

        if (!isNaN(stride_value)) {
            project_config.preprocessing[`${type}_stride`] = stride_value;
            local_render();
        }
    }


    return <Container
        id="dataset"
        heading="Add Datasets"
        subheading="Add Huggingface datasets and Wikipedia articles to your project. Downloaded datasets are stored in the browser's CacheStorage."
        icon={FileText}
        className="border-0 w-full"
    >
        <div className="flex flex-col gap-3">
            <div className={`flex flex-col gap-6`}>
                <Dialogue />

                <div className="flex gap-2 items-center flex-wrap">
                    <div>
                        <Button onClick={() => enableAutoDownload()}
                            disabled={worker?.isTraining()}
                            id="llm-auto-download-dataset"
                            variant="outline"
                            className={`${auto_download ? "border-success!" : "animate-pulse border-theme/50!"} cursor-pointer`}
                        >
                            <Download className={auto_download ? "" : "text-muted-foreground"} />
                            <span className={`leading-snug text-sm ${auto_download ? "" : "text-muted-foreground"}`}>
                                Download pending datasets
                            </span>
                        </Button>
                    </div>

                    <Button
                        id="clear-cache-storage"
                        variant="outline"
                        onClick={confirmClearCacheStorage}
                        suppressHydrationWarning
                        disabled={
                            worker?.isTraining() ||
                            (Object.keys(project_config?.preprocessing?.finetuning_datasets || {}).length == 0 &&
                                Object.keys(project_config?.preprocessing?.pretraining_datasets || {}).length == 0 &&
                                !can_clear_cache)}
                        className="cursor-pointer"
                    >
                        {Object.keys(project_config.preprocessing.finetuning_datasets).length == 0 &&
                            Object.keys(project_config.preprocessing.pretraining_datasets).length == 0 && can_clear_cache
                            ? <><Trash className="text-error" /><span>Clear dataset cache</span></>
                            : <><Trash2 className="text-error" /><span>Remove all datasets</span></>}
                    </Button>
                </div>

                <div className="w-full sm:w-1/2">
                    <Separator />
                </div>

                <div className="flex flex-col gap-2">
                    <LoadDatasetMenu
                        disabled={worker?.isTraining()}
                        label="Add pre-training dataset"
                        description="Pre-training is the initial training where the model learns knowledge, language, and vocabulary from large, diverse datasets."
                        type="pretrain" />
                    <ListOfDatasets downloads={downloads} type="pretraining" />
                </div>

                <div className="flex flex-col gap-2">
                    <LoadDatasetMenu
                        disabled={worker?.isTraining()}
                        label="Add fine-tuning dataset"
                        description="With fine-tuning, the model learns domain specific knowledge and the ability to perform tasks like question answering and instruction following."
                        type="finetune" />
                    <ListOfDatasets downloads={downloads} type="finetuning" />
                </div>

                <div className="w-full sm:w-1/2">
                    <Separator />
                </div>


                <div className="flex flex-col gap-2">
                    <div className="flex flex-col">
                        <Label className="text-lg">Choose a stride
                            <Info className="size-4 cursor-pointer text-muted-foreground" onClick={() => explainStride()} />
                        </Label>

                    </div>

                    <div className="flex flex-col gap-2">
                        <Label className="text-sm text-muted-foreground">
                            Pre-training stride
                        </Label>
                        <SelectField
                            disabled={worker?.isTraining()}
                            className="w-full sm:w-sm text-start cursor-pointer"
                            value={project_config.preprocessing.pretraining_stride.toFixed(2)}
                            options={stride_options}
                            onValueChange={val => onChangeStride("pretraining", val)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label className="text-sm text-muted-foreground">Fine-tuning stride</Label>
                        <SelectField
                            disabled={worker?.isTraining()}
                            className="w-full sm:w-sm text-start cursor-pointer"
                            value={project_config.preprocessing.finetuning_stride.toFixed(2)}
                            options={stride_options}
                            onValueChange={val => onChangeStride("finetuning", val)}
                        />
                    </div>
                </div>
            </div>
        </div>
    </Container >
}


const dataset_color_code = {
    pending: "border-l-2! border-l-theme!",
    complete: "border-l-2! border-l-success!",
    error: "border-l-2! border-l-error!",
    downloading: "border-l-2! border-l-theme!",
    undefined: "",
}


function ListOfDatasets({ type, downloads }: { type: "pretraining" | "finetuning", downloads: DownloadState }) {
    const { project_config, full_render, worker } = useProject<LLMConfig>();
    const list = Object.keys(project_config.preprocessing[`${type}_datasets`]);

    const { confirmation, Dialogue } = useDialogue();

    const removeDataset = async (url: string) => {
        if (await confirmation({
            title: "Remove dataset?",
            description: `Are you sure you want to remove the dataset ${url}?`
        })) {
            delete project_config.preprocessing[`${type}_datasets`][url];
            full_render();
        }
    }

    if (list.length == 0) {
        return <></>
    }

    return <div className="flex flex-col gap-2">

        {list.length > 0 && <div className="flex flex-wrap gap-4 max-w-full">
            <Dialogue />
            {list.map(link => {
                const url = new URL(link);
                let icon = <FileText />;
                let display = link;

                if (url.hostname == "huggingface.co") {
                    icon = <HuggingfaceLogo className="size-5" />;
                    const { owner, name, path } = parseDatasetURL(link);
                    display = [owner, name, path].filter(Boolean).join("/");
                } else if (url.hostname.endsWith("wikipedia.org")) {
                    const { title } = parseWikiArticleLink(link);

                    if (title) {
                        display = title;
                    }

                    icon = <WikipediaWLogo className="fill-foreground!" />
                } else if (url.hostname == "localhost" && url.pathname.startsWith("/files/")) {
                    // remove the fake URL (needed for CacheStorage) to get the file name
                    display = url.pathname.replace("/files/", "");
                }

                return <Button
                    disabled={worker?.isTraining()}
                    data-url={`dataset-[${link}]`}
                    title={downloads[link]?.status ?? ""}
                    variant="outline"
                    className={`cursor-pointer col-span-4 justify-between max-w-md ${dataset_color_code[downloads[link]?.status]}`}
                    key={link}
                >
                    {icon}

                    <span className="truncate text-start text-sm">
                        {display}
                    </span>

                    {downloads[link]?.status == "downloading" && <LoaderCircle className="animate-spin text-theme" />}

                    <CloseIcon
                        data-remove={`dataset-[${link}]-remove`}
                        className="text-error pointer-events-auto! cursor-pointer size-4"
                        onClick={event => {
                            event.stopPropagation();
                            removeDataset(link);
                        }}
                    />
                </Button>
            })}
        </div>}
    </div>
}


function LoadDatasetMenu({ label, description, type, disabled }: { label: string, description: string, type: "pretrain" | "finetune", disabled?: boolean }) {
    const [open, setOpen] = React.useState<boolean>(false);
    const [tab, setTab] = React.useState<"llm-dataset-tab-files" | "llm-dataset-tab-hf" | "llm-dataset-tab-wiki">("llm-dataset-tab-hf");


    const closeDialog = () => {
        setOpen(false);
    }

    return <Dialog open={open} onOpenChange={setOpen}>

        <div className="flex flex-col gap-1">
            <DialogTrigger asChild suppressHydrationWarning>
                <Button disabled={disabled} onClick={() => setOpen(true)} id={`llm-add-dataset-${type}`} className="w-full sm:w-sm cursor-pointer" variant="outline">
                    <Plus />
                    <span>{label}</span>
                </Button>
            </DialogTrigger>
            <span className="text-muted-foreground text-xs">{description}</span>
        </div>

        <DialogOverlay className="backdrop-blur-sm" />

        <DialogContent aria-describedby={undefined} className="bg-inherit max-w-[95%] md:max-w-4xl flex flex-col top-[3%] max-h-[94%] translate-y-0 min-h-0">
            <DialogHeader>
                <DialogTitle className="capitalize text-center text-xl">{label}</DialogTitle>
            </DialogHeader>

            <Tabs className="flex flex-col grow min-h-0" value={tab} onValueChange={new_tab => setTab(new_tab as any)}>
                <TabsList className="w-full border-b" variant="line">
                    <TabsTrigger value="llm-dataset-tab-hf" className="after:bg-theme cursor-pointer">
                        Huggingface <HuggingfaceLogo className="size-6" />
                    </TabsTrigger>

                    <TabsTrigger value="llm-dataset-tab-files" className="after:bg-theme cursor-pointer">
                        Load File <Folder className="size-4" />
                    </TabsTrigger>

                    {type == "pretrain" && <TabsTrigger value="llm-dataset-tab-wiki" className="after:bg-theme cursor-pointer">
                        Wikipedia <Newspaper className="size-4" />
                    </TabsTrigger>}
                </TabsList>

                <TabsContent value="llm-dataset-tab-hf" id="llm-dataset-tab-huggingface" className="flex flex-col min-h-0 grow">
                    <HuggingfaceDataset url="" type={type} closeMenu={closeDialog} />
                </TabsContent>

                {type == "pretrain" && <TabsContent value="llm-dataset-tab-wiki" id="llm-dataset-tab-wiki" className="flex flex-col min-h-0 grow">
                    <WikipediaDataset closeMenu={closeDialog} />
                </TabsContent>}

                {type == "pretrain" && <TabsContent value="llm-dataset-tab-files" id="llm-dataset-tab-files" className="flex flex-col grow overflow-auto">
                    <FileDataset type={type} closeMenu={closeDialog} />
                </TabsContent>}
            </Tabs>
        </DialogContent>

    </Dialog>
}
