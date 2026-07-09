"use client"

import React from "react";
import { v4 as uuid } from 'uuid';

import {
    FileText,
    Package,
    Rabbit,
    Layers,
    Play,
    ChevronDown
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import ProjectSidebar from "@/features/training/sidebar"
import Welcome from "@/features/training/regression/welcome";
import Dataset from "@/features/training/regression/dataset";
import Hyperparameters from "@/features/training/regression/hyperparameters";
import ModelLayers from "@/features/training/regression/layers";
import ModelTrain from "@/features/training/regression/train";
import Inference from "@/features/training/regression/inference";

import { RegressionContext } from "@/features/training/regression/regression-contexts";
import useRender from "@/components/use-render";
import ProjectConfig from "@/lib/data-processing/project_config";
import { ProjectType } from "@/types/project_types";
import type ForgeFrame from "@/lib/data-processing/forgeframe";
import RegressionModelWorker from "@/lib/webworker/regression_client";
import { ProjectContext, useProject } from "@/features/training/project-contexts";
import { Button } from "@/components/ui/button";
import { getLayer } from "@/features/training/regression/layers/layer-types";
import { Activation, Loss, Metric, Optimizer } from "@/types/hyperparameters";
import { useDialogue } from "@/components/dialogue";
import { toaster } from "@/components/toaster";


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


export interface TabularRegressionInterfaceArgs {
    meta: {
        project?: {
            username: string;
            project_name: string;
            saved_model: boolean;
        }
    }
    load_project?: ProjectConfig | { [key: string]: any };
}


export default function TabularRegressionInterface({
    meta,
    load_project
}: TabularRegressionInterfaceArgs) {
    const { status } = React.useContext(RegressionContext);
    const { cache } = useProject();
    const full_render = useRender();
    const worker = React.useRef<RegressionModelWorker | undefined>(undefined);
    const project_config = React.useRef<ProjectConfig | undefined>(undefined);
    const dataframe = React.useRef<ForgeFrame | undefined>(undefined);

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
                project_type: ProjectType.TABULAR_REGRESSION,
                model: {
                    learning_rate: 0.001,
                    batch_size: 16,
                    epochs: 10,
                    loss_fn: "",
                    optimizer: Optimizer.ADAM,
                },
                preprocessing: {
                    vocab_size: 50257,
                },
            }
        })
    }


    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        if (Worker !== undefined && project_config.current) {
            // this avoids Next.js's server side rendering error
            worker.current = new RegressionModelWorker(project_config.current);
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
        <ProjectContext value={{
            worker: worker.current,
            project_config: project_config.current!,
            meta: project_meta.current,
            cache,
            full_render
        }}>
            <RegressionContext.Provider value={{
                dataframe: dataframe.current,
                dataframeRef: dataframe,
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

                            <div className="px-4">
                                <Applypreset />
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
            </RegressionContext.Provider>
        </ProjectContext>
    </div>
}


const preset_warning = {
    title: "Applying preset",
    description: "Applying a preset will overwrite some of your current configurations."
}


function Applypreset() {
    const { project_config, full_render, cache } = useProject<ProjectConfig>();
    const { confirmation, Dialogue } = useDialogue();

    const presetTrueFalse = async () => {
        if (!await confirmation(preset_warning)) {
            return;
        }

        project_config.model.layers = [
            getLayer("dense", uuid()),
            getLayer("dense", uuid()),
            getLayer("dense", uuid()),
        ];
        project_config.model.layers.at(-1)!.auto = true
        project_config.model.layers.at(-1)!.config.activation = Activation.SIGMOID;
        project_config.model.loss_fn = Loss.BINARY_CROSS_ENTROPY;
        project_config.model.optimizer = Optimizer.ADAM;
        project_config.model.learning_rate = 0.001;
        cache.load.learning_rate = 0.001;
        project_config.model.metrics = [Metric.ACCURACY];
        project_config.model.validation_split = 0.2;
        full_render();
        toaster.success("Logistic regression model preset applied");
    }


    const presetCategorical = async () => {
        if (!await confirmation(preset_warning)) {
            return;
        }

        project_config.model.layers = [
            getLayer("dense", uuid()),
            getLayer("dense", uuid()),
            getLayer("dense", uuid()),
        ];
        project_config.model.layers.at(-1)!.auto = true
        project_config.model.layers.at(-1)!.config.activation = Activation.SOFTMAX;
        project_config.model.loss_fn = Loss.SPARSE_CATEGORICAL_CROSS_ENTROPY;
        project_config.model.optimizer = Optimizer.ADAM;
        project_config.model.learning_rate = 0.001;
        cache.load.learning_rate = 0.001;
        project_config.model.metrics = [Metric.ACCURACY];
        project_config.model.validation_split = 0.2;
        full_render();
        toaster.success("Categorical classification model preset applied");
    }


    const presetRegression = async () => {
        if (!await confirmation(preset_warning)) {
            return;
        }

        project_config.model.layers = [
            getLayer("dense", uuid()),
            getLayer("dense", uuid()),
            getLayer("dense", uuid()),
        ];
        project_config.model.layers.at(-1)!.auto = true
        project_config.model.layers.at(-1)!.config.activation = Activation.RELU;
        project_config.model.loss_fn = Loss.MEAN_SQUARED_ERROR;
        project_config.model.optimizer = Optimizer.ADAM;
        project_config.model.learning_rate = 0.001;
        cache.load.learning_rate = 0.001;
        project_config.model.metrics = [Metric.MEAN_ABSOLUTE_ERROR];
        project_config.model.validation_split = 0.2;
        full_render();
        toaster.success("Numerical regression model preset applied");
    }

    return (
        <DropdownMenu>
            <Dialogue />

            <DropdownMenuTrigger id="preset-trigger" asChild>
                <Button id="preset-button" size="sm" className="ring-0! focus:ring-0! h-7" variant="ghost">
                    <span className="text-xs text-muted-foreground flex gap-2">Apply preset<ChevronDown /></span>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent id="preset-content" align="start">
                <DropdownMenuLabel id="preset-question" className="text-muted-foreground">
                    What will the model predict?
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem id="preset-binary" onClick={presetTrueFalse}>
                    True / False prediction
                </DropdownMenuItem>

                <DropdownMenuItem id="preset-categorical" onClick={presetCategorical}>
                    Categorical prediction
                </DropdownMenuItem>

                <DropdownMenuItem id="preset-regression" onClick={presetRegression}>
                    Numerical prediction
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
