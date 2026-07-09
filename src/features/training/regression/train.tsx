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

import { RegressionContext } from "@/features/training/regression/regression-contexts";
import useRender from "@/components/use-render";
import { useDialogue } from "@/components/dialogue";
import { getDummyColumns } from "@/lib/data-processing/preprocess";
import { generateDataset } from "@/features/training/api/generate-dataset";
import { SelectField } from "@/components/custom/select-field";
import { useProject } from "@/features/training/project-contexts";
import { ProjectType } from "@/types/project_types";
import { abbreviatedCount } from "@/lib/utility";
import { toaster } from "@/components/toaster";
import { Spinner } from "@/components/ui/spinner";
import { MetricsChart, TrainingProgress } from "@/features/training/training-progress";
import RegressionModelWorker from "@/lib/webworker/regression_client";
import { TrainingBackend, Backend } from "@/types/hyperparameters";
import type ProjectConfig from "@/lib/data-processing/project_config";
import { downloadModel } from "@/features/training/model_io";


export default function ModelTrain() {
    const { status, dataframe } = React.useContext(RegressionContext);
    const { project_config, worker, full_render, meta, cache } = useProject<ProjectConfig>();
    const render = useRender();
    const [download_progress, setDownloadProgress] = React.useState<number | undefined>(undefined);
    const { notify, Dialogue, confirmation } = useDialogue();

    const onChangeUseGPU = (backend: Backend) => {
        project_config.model.backend = backend;
        full_render(); // full render to ensure inference section gets the updated value
    }


    const resetWorker = async () => {
        if (worker?.isChanged(project_config) && !worker.isTraining()) {
            // no need to reset because a breaking change will start a new model,
            // but re-render to make the button disabled
            render();
            return;
        }

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
        if (!(worker instanceof RegressionModelWorker)) {
            await notify({
                title: "Web worker missing",
                description: "Failed to create a web worker. Please ensure your browser supports them and try reloading this page."
            });

            return;
        }

        try {
            if (!status.dataset || !status.layers || !status.hyperparameters || !dataframe) {
                notify({
                    title: "Not ready to train yet",
                    description: "The previous sections must be complete before the model can start training."
                });
                return;
            }

            let mode: "new" | "resume" = project_config.metrics_history.length == 0 ||
                (!worker?.isBuilt() && !meta.project?.saved_model)
                ? "new" : "resume";

            // handle dummy variables
            const string_cols = project_config.preprocessing.input_cols.filter(col => dataframe.types[col] == "string");

            if (project_config.project_type == ProjectType.TABULAR_REGRESSION && string_cols.length > 0) {
                if (mode == "resume" &&
                    Object.keys(project_config.preprocessing.dummy_variables).length == 0) {
                    // dummy variables are involved but not found, user needs to agree to train new model
                    if (!await confirmation({
                        title: "Dummy variables not found",
                        description: "A text column was selected for this tabular regression project," +
                            " but the dummy variables were not found. A new model with a new set of dummy variables will be trained. Continue?",
                        yes: "Yes"
                    })) {
                        return;
                    }

                    mode = "new";
                }

                if (mode == "new") {
                    // generate dummy variables configuration
                    project_config.preprocessing.dummy_variables = getDummyColumns(dataframe, string_cols);
                }
            } else {
                project_config.preprocessing.dummy_variables = {};
            }

            // generate the dataset
            const {
                xs = [], ys = [],
                input_shape, onehot_encoding = {},
                scale_cols = {}, zscore_cols = {}
            } = generateDataset(dataframe, project_config, mode);

            if (xs.length == 0 || ys.length == 0) {
                notify({
                    title: "Empty training dataset",
                    description: "No samples and/or labels were found in the dataset. Check your preprocessing steps.",
                });

                return;
            }

            if (mode == "resume") {
                // if the generated scale_cols configurations are different to the current ones,
                // do not allow training unless user agrees to retrain from scratch
                for (const i in scale_cols) {
                    if (scale_cols[i] == "placeholder") {
                        continue;
                    }

                    // check that the calculated and existing min-max are within 1e-7 (this number comes from
                    // gradient checking, change if this causes issues on different machines)
                    if (project_config.preprocessing.scale_cols[i] == "placeholder" ||
                        Math.abs(scale_cols[i].min - project_config.preprocessing.scale_cols[i].min) > 1e7 ||
                        Math.abs(scale_cols[i].max - project_config.preprocessing.scale_cols[i].max) > 1e7) {
                        if (await confirmation({
                            title: "Numeric normalization changed",
                            description: "The column normalizations have changed from the previous" +
                                " training. A new model will be trained. Continue?"
                        })) {
                            mode = "new";
                            break;
                        } else {
                            return;
                        }
                    }
                }

                for (const i in zscore_cols) {
                    if (zscore_cols[i] == "placeholder") {
                        continue;
                    }

                    // check that the calculated and existing min-max are within 1e-7 (this number comes from
                    // gradient checking, change if this causes issues on different machines)
                    if (project_config.preprocessing.zscore_cols[i] == "placeholder" ||
                        Math.abs(zscore_cols[i].mean - project_config.preprocessing.zscore_cols[i].mean) > 1e7 ||
                        Math.abs(zscore_cols[i].std - project_config.preprocessing.zscore_cols[i].std) > 1e7) {
                        if (await confirmation({
                            title: "Numeric standardizations changed",
                            description: "The column standardizations have changed from the previous" +
                                " training. A new model will be trained. Continue?"
                        })) {
                            mode = "new";
                            break;
                        } else {
                            return;
                        }
                    }
                }
            }

            if (mode == "new") {
                project_config.model.input_shape = input_shape;
                project_config.preprocessing.onehot_encoding = onehot_encoding;
                project_config.preprocessing.scale_cols = scale_cols;
                project_config.preprocessing.zscore_cols = zscore_cols;
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

                // this is done a second time in case mode isn't changed to new due to
                // no changes in standardization and dummy variables
                project_config.model.input_shape = input_shape;
                project_config.preprocessing.onehot_encoding = onehot_encoding;
                project_config.preprocessing.scale_cols = scale_cols;
                project_config.preprocessing.zscore_cols = zscore_cols;
            }

            project_config.resolvePlaceholders(dataframe.types);

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
                    }

                    setDownloadProgress(undefined);
                } else {
                    cache.cloud_model_state = "declined";
                    mode = "new";
                }
            }

            (worker as RegressionModelWorker)?.train({
                project_config,
                mode: `${mode}_train`,
                dataset: { x_train: xs, y_train: ys }
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
        subheading="Train the model until the accuracy metric is as close to 100% and loss metric to zero as possible. A browser with strong WebGPU support (Chrome) is recommended for faster training. To prevent interruptions, keep this tab in the foreground. Browsers may throttle or sleep tabs not in view."
        className="grow flex flex-col h-11/12 w-full"
        icon={Rabbit}
    >
        <div className="flex flex-col lg:flex-row gap-2 grow ">
            <div className="flex flex-col gap-2 grow basis-1 overflow-x-auto">
                <div id="train-start" className="flex gap-2 flex-wrap w-full lg:w-2/3 xl:w-1/2 py-1">
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
