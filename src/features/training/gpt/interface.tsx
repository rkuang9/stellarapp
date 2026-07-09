"use client"

import React from "react";

import {
    FileText,
    Package,
    MessageCircle,
    Rabbit
} from "lucide-react"

import { Separator } from "@/components/ui/separator";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

import ProjectSidebar from "@/features/training/sidebar"
import Welcome from "@/features/training/gpt/welcome";
import Dataset from "@/features/training/gpt/dataset";
import ModelSize from "@/features/training/gpt/model-size";
import ModelTrain from "@/features/training/gpt/train";

import { GPTContext } from "@/features/training/gpt/gpt-contexts";
import useRender from "@/components/use-render";
import GPTModelWorker from "@/lib/webworker/gpt_client";
import { ProjectType } from "@/types/project_types";
import ModelInference from "@/features/training/gpt/inference";
import { ProjectContext } from "@/features/training/project-contexts";
import { Loss, Metric, Optimizer } from "@/types/hyperparameters";
import { Tokenizers } from "@/lib/data-processing/nlp_sources";
import { LLMConfig } from "@/lib/data-processing/llm_config";


const sections = [
    {
        title: "Datasets",
        url: "dataset",
        status: "dataset",
        icon: FileText,
        items: [
            { title: "Load Documents", url: "#load-documents" },
            { title: "Wikipedia Articles", url: "#wiki-links" },
        ],
    },
    {
        title: "Model Size",
        url: "model-size",
        status: "model_size",
        icon: Package,
        items: [
            { title: "Presets", url: "#model-presets" },
            { title: "Layers", url: "#layers", }
        ]
    },
    {
        title: "Training",
        url: "training",
        status: "training",
        icon: Rabbit,
        items: [
            { title: "Hyperparameters", url: "#hyperparameters", status: "hyperparameters" },
            { title: "Train", url: "#train-start", },
        ]
    },
    {
        title: "Chat",
        status: "inference",
        url: "inference",
        icon: MessageCircle,
    },
];


export interface GPTInterfaceArgs {
    meta: {
        project?: {
            username: string;
            project_name: string;
            saved_model: boolean;
        }
    }
    load_project?: LLMConfig | { [key: string]: any };
}


export default function GPTInterface({
    meta,
    load_project
}: GPTInterfaceArgs) {
    const { status } = React.useContext(GPTContext);
    const { cache } = React.useContext(ProjectContext);
    const full_render = useRender();
    const worker = React.useRef<GPTModelWorker | undefined>(undefined);
    const project_config = React.useRef<LLMConfig | undefined>(undefined);

    const project_meta = React.useRef<{
        project?: {
            username: string;
            project_name: string;
            saved_model: boolean;
        }
    } | undefined>(undefined);

    if (!project_meta.current) {
        project_meta.current = meta;

        if (meta.project?.saved_model) {
            // model is available to download
            cache.cloud_model_state = "can_download";
        }
    }

    if (!project_config.current) {
        const tokenizer_name = "HuggingFaceTB/SmolLM2-1.7B-Instruct";
        const tokenizer = Tokenizers[tokenizer_name];

        project_config.current = new LLMConfig({
            load: load_project ? load_project : {
                project_type: ProjectType.TEXT_GENERATION,
                model: {
                    learning_rate: 0.001,
                    batch_size: 2,
                    epochs: 10,
                    loss_fn: Loss.SPARSE_CATEGORICAL_CROSS_ENTROPY,
                    optimizer: Optimizer.ADAM,
                    validation_split: 0,
                    metrics: [Metric.ACCURACY, Metric.PERPLEXITY],
                    input_shape: [null], // no required input shape
                },
                preprocessing: {
                    vocab_size: tokenizer?.vocab_size ?? 0,
                    tokenizer: tokenizer_name,
                    pretraining_stride: 1,
                    finetuning_stride: 0.5
                },
            }
        })
    }


    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        if (Worker !== undefined && project_config.current) {
            // this avoids Next.js's server side rendering error
            worker.current = new GPTModelWorker(project_config.current);
            full_render();
        }

        if (process.env.NODE_ENV != "development") {
            // In order for this to work, there must not be any <Link> that changes
            // the current page's URL. Either use <Link> to open a new tab or <a>
            window.onbeforeunload = () => true; // confirm navigating away from page	
        }
    }, []);
    /* eslint-enable react-hooks/exhaustive-deps */


    return <div className="h-screen flex flex-col overflow-auto">
        <ProjectContext.Provider value={{
            worker: worker.current,
            project_config: project_config.current!,
            meta: project_meta.current,
            cache,
            full_render
        }}>
            <GPTContext.Provider value={{
                status
            }}>
                <SidebarProvider>
                    <ProjectSidebar sections={sections} sectionStatus={status} />
                    <SidebarInset className="bg-inherit h-full flex flex-col grow min-w-0">
                        <div className="flex justify-between pt-1 pl-2 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:py-2">
                            <div className="flex items-center gap-2">
                                <SidebarTrigger className="-ml-1 cursor-pointer" />
                                <Separator
                                    orientation="vertical"
                                    className="mr-2 data-[orientation=vertical]:h-4"
                                />
                            </div>
                        </div>

                        <Toaster position="top-center" />

                        <main className="overflow-auto grow px-4 w-full h-full space-y-16">
                            <Welcome />

                            <Dataset />

                            <ModelSize />

                            <ModelTrain />

                            <ModelInference />
                        </main>

                    </SidebarInset>
                </SidebarProvider>
            </GPTContext.Provider>
        </ProjectContext.Provider>
    </div>
}
