"use client"

import React from "react";

import { Container } from "@/features/training/container";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Play,
    RefreshCw,
    Rabbit,
    Flame,
    Info,
    Square,
    Activity,
    AudioLines,
    LucideIcon
} from "lucide-react"

import { Separator } from "@/components/ui/separator";
import { isInt, isNumeric } from "validator";
import { GPTContext } from "@/features/training/gpt/gpt-contexts";
import useRender from "@/components/use-render";
import { useDialogue } from "@/components/dialogue";
import { abbreviatedCount, webgpuIsAvailable } from "@/lib/utility";
import { HyperparameterError, HyperparameterInfo } from "@/types/project_types";
import { useProject } from "@/features/training/project-contexts";
import GPTModelWorker from "@/lib/webworker/gpt_client";
import { MetricsChart, TrainingProgress } from "@/features/training/training-progress";
import { Spinner } from "@/components/ui/spinner";
import { toaster } from "@/components/toaster";
import { TrainMode } from "@/lib/webworker/worker_types";
import { SelectField } from "@/components/custom/select-field";
import { TrainingBackend, Backend } from "@/types/hyperparameters";
import { type LLMConfig } from "@/lib/data-processing/llm_config";
import { downloadModel } from "@/features/training/model_io";


export default function ModelTrain() {
    const { project_config, worker, cache, meta, full_render } = useProject<LLMConfig>();
    const { status } = React.useContext(GPTContext);
    const render = useRender();
    const [download_progress, setDownloadProgress] = React.useState<number | undefined>(undefined);
    const [learning_rate, setLearningRate] = React.useState<string>(String(project_config.model.learning_rate));
    const { notify, Dialogue, confirmation } = useDialogue();

    const train_button_style = "grow basis-0 cursor-pointer";
    const train_button_options: { label: string, value: "train" | "finetune", Icon: LucideIcon }[] = [
        { label: "Pre-train model", value: "train", Icon: AudioLines },
        { label: "Fine-tune model", value: "finetune", Icon: Activity }
    ];

    React.useEffect(() => {
        const all_ok = project_config.model.epochs > 0 &&
            project_config.model.learning_rate > 0 &&
            project_config.model.batch_size > 0 &&
            !!project_config.model.backend;

        if (status.hyperparameters != all_ok) {
            status.hyperparameters = all_ok;
            full_render();
        }
    });


    React.useEffect(() => {
        // handles setting learning rate from loading existing project
        if (cache.load.learning_rate && cache.load.learning_rate > 0) {
            setLearningRate(cache.load.learning_rate.toString());
            delete cache.load.learning_rate;
        }
    }, [cache.load.learning_rate]);


    const onChangeLearningRate = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;

        if (isNumeric(value)) {
            project_config.model.learning_rate = Number(value);
        } else {
            project_config.model.learning_rate = -9000;
        }

        setLearningRate(value);
    }


    const onChangeEpochs = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value ? event.target.value : "0";

        if (isInt(value)) {
            project_config.model.epochs = Number(value);
            render();
        }
    }


    const onChangeBatchSize = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value ? event.target.value : "0";

        if (isInt(value)) {
            project_config.model.batch_size = Number(value);
            full_render();
        }
    }


    const onChangeUseGPU = async (backend: Backend) => {
        const check = await webgpuIsAvailable();

        if (backend == "webgpu") {
            if (!check.available) {
                notify({
                    title: "WebGPU unavailble",
                    description: <div className="flex flex-col gap-2 text-muted-foreground text-sm text-start">
                        <span>{check.reason}</span>
                        <span>View the WebGPU <a href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status" target="_blank" className="hover:underline text-theme">implementation status</a> to see supported browsers</span>
                    </div>
                });
                return false;
            }
        }

        if (backend != "webgpu" && check.available) {
            toaster.info("WebGPU is available and strongly recommended");
        }

        project_config.model.backend = backend;
        full_render();
        return true;
    }


    const field_style = (field: "epochs" | "learning_rate" | "batch_size") => {
        const value = project_config.model[field];
        return value <= 0 ? "text-error! border-error!" : "";
    }


    const errors = {
        epochs: project_config.model.epochs <= 0 ? HyperparameterError.epochs : undefined,
        learning_rate: project_config.model.learning_rate <= 0 ? HyperparameterError.learning_rate : undefined,
        batch_size: project_config.model.batch_size <= 0 ? HyperparameterError.batch_size : undefined,
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


    const trainStart = async (training_type: "train" | "finetune") => {
        if (!(worker instanceof GPTModelWorker)) {
            notify({
                title: "Web worker missing",
                description: "Failed to create a web worker. Please ensure your browser supports them and try reloading this page."
            });

            return;
        }

        try {
            if (!status.dataset || !status.model_size) {
                notify({
                    title: "Not ready to train yet",
                    description: "The previous sections must be complete before the model can start training."
                }).then(async () => {
                    document.getElementById("dataset")?.scrollIntoView({ behavior: "smooth" });
                });
                return;
            }

            if (project_config.model.backend == "cpu" &&
                !await confirmation({ description: "Training using the CPU instead of GPU will be very slow. Continue?" })) {
                return;
            }

            let mode: TrainMode = project_config.metrics_history.length == 0 || (!worker?.isBuilt() && cache.cloud_model_state != "can_download") ? "new" : "resume";

            const has_dataset = training_type == "train"
                ? Object.keys(project_config.preprocessing.pretraining_datasets).length > 0
                : Object.keys(project_config.preprocessing.finetuning_datasets).length;

            if (!has_dataset) {
                notify({
                    title: "No training dataset found",
                    description: "Load some Huggingface datasets or text documents to begin training",
                }).then(() => {
                    document.getElementById("dataset")?.scrollIntoView({ behavior: "smooth" });
                });
                return;
            }

            // user made a change to the model architecture and needs to confirm this
            if (mode != "new" && worker?.isChanged(project_config)) {
                // a confirmation popup should be triggered later
                mode = "new";

                if ((project_config.metrics_history.length > 0 || worker?.isBuilt()) && !await confirmation({
                    title: "Model size changed",
                    description: "Changes were made to the model's size. A new model will be trained. Continue?",
                })) {
                    return;
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
                    }

                    setDownloadProgress(undefined);
                } else {
                    cache.cloud_model_state = "declined";
                    mode = "new";
                }
            }

            if (project_config.model.backend == "webgpu" && !await onChangeUseGPU(project_config.model.backend)) {
                return;
            }

            worker?.train({
                project_config,
                mode: `${mode}_${training_type}`,
            }).then(({ parameters, backend }) => {
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
        <div className="flex flex-col lg:flex-row gap-2 grow">
            <div className="flex flex-col gap-2 grow basis-1 overflow-x-auto">
                <div id="train-start" className="flex gap-2 flex-wrap w-full lg:w-2/3 xl:w-1/2 pt-1">
                    <Dialogue />

                    {worker?.isTraining()
                        ? <Button
                            variant="outline"
                            id="train-model"
                            className={`${train_button_style}`}
                            onClick={() => trainStop()}
                        >
                            <Square /> Pause
                        </Button>
                        : <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    id="train-model"
                                    className={`${train_button_style} bg-theme! hover:bg-theme/80! text-primary-foreground hover:text-primary-foreground font-bold`}
                                >
                                    {download_progress
                                        ? <div className="flex gap-2 items-center">
                                            <span>Downloading</span>
                                            <Spinner />
                                            <span>{(download_progress * 100).toFixed(0)}%</span>
                                        </div>
                                        : <><Play /> Train</>}

                                </Button>
                            </DropdownMenuTrigger>

                            {!worker?.isTraining() && <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] border-theme flex flex-col gap-0.5">
                                {train_button_options.map((option, index) => (
                                    <React.Fragment key={index}>
                                        <DropdownMenuItem
                                            id={option.value}
                                            onClick={() => worker?.isTraining() ? trainStop() : trainStart(option.value)}
                                            className="focus:bg-elevated-2 flex justify-center space-y-1"
                                            key={option.label}
                                        >
                                            <option.Icon /> {option.label}
                                        </DropdownMenuItem>
                                        {index != train_button_options.length - 1 && <Separator className="w-11/12" />}
                                    </React.Fragment>
                                ))}
                            </DropdownMenuContent>}
                        </DropdownMenu>}

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
                        suppressHydrationWarning
                        disabled={!worker?.isBuilt()}
                        variant="outline"
                        id="reset-model"
                        className="grow basis-0 cursor-pointer"
                        onClick={() => resetWorker()}
                    >
                        <RefreshCw className="text-error" /> Reset
                    </Button>
                </div>

                <Separator />

                <div id="hyperparameters" className="flex gap-3 flex-wrap w-full lg:w-2/3 xl:w-1/2">
                    <div className="flex flex-col gap-2 grow basis-0">
                        <Label className={`${field_style("epochs")}`}>
                            {HyperparameterInfo.epochs.title}
                            <Info
                                className="cursor-pointer text-muted-foreground"
                                size={16}
                                onClick={() => notify({
                                    title: HyperparameterInfo.epochs.title,
                                    description: HyperparameterInfo.epochs.description
                                })} />
                        </Label>
                        <Input
                            id="epochs"
                            disabled={worker?.isTraining()}
                            className={field_style("epochs")}
                            type="text"
                            value={project_config.model.epochs ? project_config.model.epochs : ""}
                            onChange={onChangeEpochs} />
                        {errors.epochs && <span className="text-muted-foreground text-sm">{errors.epochs}</span>}
                    </div>

                    <div className="flex flex-col gap-2 grow basis-0">
                        <Label className={`${field_style("batch_size")}`}>
                            {HyperparameterInfo.batch_size.title}
                            <Info
                                className="cursor-pointer text-muted-foreground"
                                size={16}
                                onClick={() => notify({
                                    title: HyperparameterInfo.batch_size.title,
                                    description: HyperparameterInfo.batch_size.description
                                })} />
                        </Label>
                        <Input
                            id="batch-size"
                            disabled={worker?.isTraining()}
                            className={field_style("batch_size")}
                            type="text"
                            value={project_config.model.batch_size ? project_config.model.batch_size : ""}
                            onChange={onChangeBatchSize} />
                        {errors.batch_size && <span className="text-muted-foreground text-sm">{errors.batch_size}</span>}
                    </div>

                    <div className="flex flex-col gap-2 grow basis-0">
                        <Label className={`${field_style("learning_rate")}`}>
                            {HyperparameterInfo.learning_rate.title}
                            <Info
                                className="cursor-pointer text-muted-foreground"
                                size={16}
                                onClick={() => notify({
                                    title: HyperparameterInfo.learning_rate.title,
                                    description: HyperparameterInfo.learning_rate.description
                                })} />
                        </Label>
                        <Input
                            id="learning-rate"
                            className={field_style("learning_rate")}
                            disabled={worker?.isTraining()}
                            type="text"
                            value={learning_rate != "-9000" ? learning_rate : ""}
                            onChange={onChangeLearningRate} />
                        {errors.learning_rate && <span className="text-muted-foreground text-sm">{errors.learning_rate}</span>}
                    </div>
                </div>

                <TrainingProgress notify={notify} />

                <MetricsChart />
            </div>
        </div>
    </Container>
}
