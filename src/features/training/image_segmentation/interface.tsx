"use client"

import React from "react";
import { v4 as uuid } from "uuid";

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
import Welcome from "@/features/training/image_segmentation/welcome";
import Dataset from "@/features/training/image_segmentation/dataset";
import ModelSize from "@/features/training/image_segmentation/model-setup";
import Hyperparameters from "@/features/training/image_segmentation/hyperparameters";
import ModelTrain from "@/features/training/image_segmentation/train";
import Inference from "@/features/training/image_segmentation/inference";

import { SegmentationContext } from "@/features/training/image_segmentation/segmentation-contexts";
import useRender from "@/components/use-render";
import ProjectConfig from "@/lib/data-processing/project_config";
import { ProjectType } from "@/types/project_types";
import { ProjectContext } from "@/features/training/project-contexts";
import SegmentationDataset from "@/lib/data-processing/dataset_segmentation";
import SegmentationModelWorker from "@/lib/webworker/segmentation_client";
import { Metric, Optimizer } from "@/types/hyperparameters";


const sections = [
    {
        title: "Dataset",
        url: "dataset",
        status: "dataset",
        icon: FileText
    },
    {
        title: "Model Setup",
        url: "model-setup",
        status: "model_setup",
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


export interface ImageSegmentationInterfaceArgs {
    meta: {
        project?: {
            username: string;
            project_name: string;
            saved_model: boolean;
        }
    }
    load_project?: ProjectConfig | { [key: string]: any };
}


export default function ImageSegmentationInterface({
    meta,
    load_project
}: ImageSegmentationInterfaceArgs) {
    const { status } = React.useContext(SegmentationContext);
    const { cache } = React.useContext(ProjectContext);
    const full_render = useRender();
    const worker = React.useRef<SegmentationModelWorker | undefined>(undefined);
    const project_config = React.useRef<ProjectConfig | undefined>(undefined);
    const segmentationset = React.useRef<SegmentationDataset | undefined>(undefined);

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
        const shape = [256, 256, 3];

        project_config.current = new ProjectConfig({
            load: load_project ? load_project : {
                project_type: ProjectType.IMAGE_SEGMENTATION,
                model: {
                    layers: [{
                        id: uuid(),
                        label: "U-Net",
                        identifier: "unetModel",
                        input_rank: 4,
                        output_rank: 4,
                        config: {
                            filters: 16,
                            depth: 4,
                            //categories: 2, // set via UI
                            activation: "sigmoid",
                            residual: true,
                        }
                    }],
                    input_shape: shape,
                    learning_rate: 0.001,
                    batch_size: 4,
                    epochs: 1,
                    loss_fn: "",
                    optimizer: Optimizer.ADAM,
                    metrics: [Metric.ACCURACY]
                },
            }
        })
    }

    if (!segmentationset.current) {
        segmentationset.current = new SegmentationDataset();
    }

    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        if (Worker !== undefined && project_config.current) {
            // this avoids Next.js's server side rendering error
            worker.current = new SegmentationModelWorker(project_config.current);
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
            <SegmentationContext.Provider value={{
                segmentationset: segmentationset.current,
                status,
            }}>
                <SidebarProvider>
                    <ProjectSidebar sections={sections} sectionStatus={status} />
                    <SidebarInset className="bg-inherit h-full flex flex-col grow min-w-0">
                        <div className="flex justify-between py-2 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:py-2">
                            <div className="flex items-center gap-2 px-4">
                                <SidebarTrigger className="cursor-pointer" />
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

                            <Hyperparameters />

                            <ModelTrain />

                            <Inference />
                        </main>

                    </SidebarInset>
                </SidebarProvider>
            </SegmentationContext.Provider>
        </ProjectContext.Provider>
    </div>
}
