"use client"

import React from "react";

import {
    FileText,
    Package,
    Rabbit,
    Layers,
    Play
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

import ProjectSidebar from "@/features/training/sidebar"
import Welcome from "@/features/training/image_classification/welcome";
import Dataset from "@/features/training/image_classification/dataset";
import ModelLayers from "@/features/training/image_classification/layers";
import Hyperparameters from "@/features/training/image_classification/hyperparameters";
import ModelTrain from "@/features/training/image_classification/train";
import Inference from "@/features/training/image_classification/inference";

import { ImageContext } from "@/features/training/image_classification/image-contexts";
import useRender from "@/components/use-render";
import ProjectConfig from "@/lib/data-processing/project_config";
import { ProjectType } from "@/types/project_types";
import { ProjectContext } from "@/features/training/project-contexts";
import ImageDataset from "@/lib/data-processing/dataset_image";
import ImageModelWorker from "@/lib/webworker/image_client";
import { Loss, Metric, Optimizer } from "@/types/hyperparameters";


const sections = [
    {
        title: "Dataset",
        url: "dataset",
        status: "dataset",
        icon: FileText
    },
    {
        title: "Model Layers",
        url: "layers",
        status: "layers",
        icon: Layers
    },
    {
        title: "Hyperparameters",
        url: "hyperparameters",
        status: "hyperparameters",
        icon: Package
    },
    {
        title: "Training",
        url: "training",
        status: "training",
        icon: Rabbit
    },
    {
        title: "Predict",
        status: "inference",
        url: "inference",
        icon: Play,
    },
];


export interface ImageClassificationInterfaceArgs {
    meta: {
        project?: {
            username: string;
            project_name: string;
            saved_model: boolean;
        }
    }
    load_project?: ProjectConfig | { [key: string]: any };
}


export default function ImageClassificationInterface({
    meta,
    load_project
}: ImageClassificationInterfaceArgs) {
    const { status } = React.useContext(ImageContext);
    const { cache } = React.useContext(ProjectContext);
    const full_render = useRender();
    const worker = React.useRef<ImageModelWorker | undefined>(undefined);
    const project_config = React.useRef<ProjectConfig | undefined>(undefined);
    const imageset = React.useRef<ImageDataset | undefined>(undefined);

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
        project_config.current = new ProjectConfig({
            load: load_project ? load_project : {
                project_type: ProjectType.IMAGE_CLASSIFICATION,
                model: {
                    learning_rate: 0.001,
                    batch_size: 16,
                    epochs: 10,
                    loss_fn: Loss.SPARSE_CATEGORICAL_CROSS_ENTROPY,
                    optimizer: Optimizer.ADAM,
                    metrics: [Metric.ACCURACY]
                },
            }
        })
    }

    if (!imageset.current) {
        imageset.current = new ImageDataset();
    }

    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        if (Worker !== undefined && project_config.current) {
            // this avoids Next.js's server side rendering error
            worker.current = new ImageModelWorker(project_config.current);
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
            <ImageContext.Provider value={{
                imageset: imageset.current,
                status,
            }}>
                <SidebarProvider>
                    <ProjectSidebar sections={sections} sectionStatus={status} />
                    <SidebarInset className="bg-inherit h-full flex flex-col grow min-w-0">
                        <div className="flex justify-between py-2 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:py-2">
                            <div className="flex items-center gap-2 px-4">
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

                            <ModelLayers />

                            <Hyperparameters />

                            <ModelTrain />

                            <Inference />
                        </main>

                    </SidebarInset>
                </SidebarProvider>
            </ImageContext.Provider>
        </ProjectContext.Provider>
    </div>
}
