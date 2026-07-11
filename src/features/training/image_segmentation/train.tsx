"use client"

import React from "react";

import { Container } from "@/features/training/container";
import { Button } from "@/components/ui/button";
import {
    Play,
    RefreshCw,
    Rabbit,
    Square,
    Flame,
} from "lucide-react";

import { SegmentationContext } from "@/features/training/image_segmentation/segmentation-contexts";
import useRender from "@/components/use-render";
import { useDialogue } from "@/components/dialogue";
import { SelectField } from "@/components/custom/select-field";
import { useProject } from "@/features/training/project-contexts";
import { abbreviatedCount } from "@/lib/utility";
import { toaster } from "@/components/toaster";
import { Spinner } from "@/components/ui/spinner";
import { MetricsChart, TrainingProgress } from "@/features/training/training-progress";
import { logError } from "@/lib/errors/error_handling_client";
import { TrainingBackend, Backend, Loss } from "@/types/hyperparameters";
import SegmentationModelWorker from "@/lib/webworker/segmentation_client";
import type ProjectConfig from "@/lib/data-processing/project_config";
import { downloadModel } from "@model-io";


const BATCH_NORM_THRESHOLD = 4;


export default function ModelTrain() {
    const { status, segmentationset } = React.useContext(SegmentationContext);
    const { project_config, worker, full_render, meta, cache } = useProject<ProjectConfig>();
    const render = useRender();
    const [download_progress, setDownloadProgress] = React.useState<number | undefined>(undefined);
    const { notify, Dialogue, confirmation } = useDialogue();

    const onChangeUseGPU = (backend: Backend) => {
        project_config.model.backend = backend;
        full_render(); // full render to ensure inference section gets the updated value
    }


    const resetWorker = async () => {
        const ask = await confirmation({
            title: "Reset model",
            description: "Are you sure you want to reset the model?"
        });

        if (ask) {
            worker?.reset(project_config);
            project_config.metrics_history = [];
            full_render();
            toaster.success("Model has been reset");
        }
    }


    const trainStop = async () => {
        confirmation({
            title: "Pause training",
            description: "Are you sure you want to end the current epoch?"
        }).then(answer => {
            if (answer) {
                worker?.stop().then(() => {
                    full_render();
                });
            }
        })

    }


    const trainStart = async () => {
        if (!(worker instanceof SegmentationModelWorker)) {
            await notify({
                title: "Web worker missing",
                description: "Failed to create a web worker. Please ensure your browser supports them and try reloading this page."
            });

            return;
        }

        try {
            if (!status.dataset || !status.model_setup || !status.hyperparameters) {
                notify({
                    title: "Not ready to train yet",
                    description: "The previous sections must be complete before the model can start training."
                });
                return;
            }

            let mode: "new" | "resume" = project_config.metrics_history.length == 0 ||
                (!worker?.isBuilt() && !meta.project?.saved_model)
                ? "new" : "resume";

            if (segmentationset.size == 0) {
                notify({
                    title: "Empty training dataset",
                    description: "There are no image-mask pairs in your dataset.",
                });

                return;
            }

            // doing a second isChanged check just in case any configurations changed after generating the dataset
            if (mode != "new" && worker?.isChanged(project_config)) {
                if (!await confirmation({
                    title: "Breaking change found",
                    description: "Changes were made in the training setup that require a new model to be trained. Continue?",
                })) {
                    return;
                }

                worker?.reset(project_config);
                project_config.metrics_history = [];
                mode = "new";
            }

            project_config.resolvePlaceholders();

            if (project_config.model.layers.at(0)?.config && mode == "new") {
                // on new models, set batch normalization based on batch size
                project_config.model.layers[0].config.batchNorm = project_config.model.batch_size >= BATCH_NORM_THRESHOLD;
                project_config.model.layers[0].config.activation = project_config.model.layers[0].config.units == 1 ? "sigmoid" : "softmax";

                if (project_config.model.layers[0].config.units == 1) {
                    // change categorical to binary
                    if (project_config.model.loss_fn == Loss.SPARSE_CATEGORICAL_CROSS_ENTROPY) {
                        project_config.model.loss_fn = Loss.BINARY_CROSS_ENTROPY;
                    } else if (project_config.model.loss_fn == Loss.DICE_CATEGORICAL_CROSS_ENTROPY) {
                        project_config.model.loss_fn = Loss.DICE_BINARY_CROSS_ENTROPY;
                    }
                } if ((project_config.model.layers[0].config.units as number) > 1) {
                    // change binary to categorical
                    if (project_config.model.loss_fn == Loss.BINARY_CROSS_ENTROPY) {
                        project_config.model.loss_fn = Loss.SPARSE_CATEGORICAL_CROSS_ENTROPY;
                    } else if (project_config.model.loss_fn == Loss.DICE_BINARY_CROSS_ENTROPY) {
                        project_config.model.loss_fn = Loss.DICE_CATEGORICAL_CROSS_ENTROPY;
                    }
                }
            }

            if (cache.cloud_model_state == "can_download" && !worker.isBuilt() && mode == "resume" && downloadModel) {
                if (await confirmation({
                    title: "Download pretrained model?",
                    description: "A pretrained model exists for this project. Would you like to download and train with it?",
                    yes: "Download",
                    no: "No, train from scratch"
                })) {
                    try {
                        toaster.info("Downloading model files");

                        const { model_json, weights_bin } = await downloadModel({
                            username: meta.project!.username,
                            project_name: meta.project!.project_name,
                            callback: event => {
                                setDownloadProgress(event.loaded / event.total!);
                            }
                        })

                        cache.cloud_model_state = "downloaded";
                        const { parameters } = await worker!.load({ model_json, weights_bin, project_config });
                        toaster.success(`Downloaded model with ${abbreviatedCount(parameters, 2)} parameters`);
                    } catch (error: any) {
                        cache.cloud_model_state = "error";
                        toaster.error(`Error while downloading the model: ${error.toString()}`)

                        logError({
                            source: "training/image_segmentation/train",
                            code: `downloadModel(${meta.project!.username}, ${meta.project!.project_name}) and worker!.load({ model_json, weights_bin, project_config })`,
                            description: JSON.stringify(error)
                        })
                    }

                    setDownloadProgress(undefined);
                } else {
                    cache.cloud_model_state = "declined";
                    mode = "new";
                }
            }

            (worker as SegmentationModelWorker)?.train({
                project_config,
                mode: `${mode}_train`,
                dataset: await segmentationset.dataset(),
            }).then(() => {
                if (mode == "new" && worker.isTraining()) {
                    project_config.metrics_history = [];
                }

                full_render(); // allow components to become disabled during training
            })
            render(); // turns the train button into the pause button
        } catch (error: any) {
            notify({
                title: "An error occurred",
                description: `An error occurred when launching a training session: ${error.toString()}`
            })
        }
    }

    return <Container
        id="training"
        heading="Train Model"
        subheading="Train the model until the dice loss is as close to zero as possible. A browser with strong WebGPU support (Chrome) is recommended for faster training. To prevent interruptions, keep this tab in the foreground. Browsers may throttle or sleep tabs not in view."
        className="grow flex flex-col h-11/12 w-full"
        icon={Rabbit}
    >
        <div className="flex flex-col lg:flex-row gap-2 grow">
            <div className="flex flex-col gap-2 grow basis-1 overflow-x-auto">
                <div id="train-start" className="flex gap-2 flex-wrap w-full max-w-full lg:w-2/3 xl:w-1/2 py-1">
                    <Dialogue />

                    <Button
                        disabled={download_progress != undefined}
                        variant="outline"
                        id="train-model"
                        className="grow basis-0 cursor-pointer bg-theme! hover:bg-theme/80! text-primary-foreground hover:text-primary-foreground font-bold"
                        onClick={() => worker?.isTraining() ? trainStop() : trainStart()}
                    >
                        {download_progress
                            ? <div className="flex gap-2 items-center">
                                <span>Downloading</span>
                                <Spinner />
                                <span>{(download_progress * 100).toFixed(0)}%</span>
                            </div>
                            : worker?.isTraining()
                                ? <><Square />Pause</>
                                : <><Play />Train</>}
                    </Button>

                    <SelectField
                        id="training-backend"
                        value={project_config.model.backend}
                        options={TrainingBackend}
                        className="grow basis-0 cursor-pointer text-center"
                        disabled={worker?.isTraining()}
                        onValueChange={(value) => {
                            onChangeUseGPU(value as Backend);
                        }}
                        icon={<Flame className="text-theme" />}
                    />

                    <Button
                        disabled={!worker?.isBuilt() && project_config.metrics_history.length == 0 || worker?.isChanged(project_config)}
                        variant="outline"
                        id="reset-model"
                        className="grow basis-0 cursor-pointer"
                        onClick={() => resetWorker()}
                    >
                        <RefreshCw className="text-error" /> Reset
                    </Button>
                </div>

                <TrainingProgress notify={notify} />

                <MetricsChart />
            </div>
        </div>
    </Container>
}
