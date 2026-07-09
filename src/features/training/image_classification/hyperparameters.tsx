"use client"

import React from "react";

import { Container } from "@/features/training/container";

import { ImageContext } from "@/features/training/image_classification/image-contexts";
import { Settings2, Check, } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/custom/select-field";

import { isInt, isNumeric } from "validator";
import useRender from "@/components/use-render";
import { Losses, MetricsLabels, Metrics, Optimizers, Metric, Loss, Optimizer } from '@/types/hyperparameters';
import { useDialogue } from "@/components/dialogue";
import { MultiSelect, MultiSelectOption } from "@/components/custom/multi-select";
import { HyperparameterError, HyperparameterInfo } from "@/types/project_types";
import { useProject } from "@/features/training/project-contexts";
import { FieldLabel } from "@/features/training/regression/hyperparameters";
import { val_split_options, field_layout_css, error_text_css } from "@/features/training/regression/hyperparameters";
import type ProjectConfig from "@/lib/data-processing/project_config";


export default function Hyperparameters() {
    const { status } = React.useContext(ImageContext);
    const { project_config, full_render, worker, cache } = useProject<ProjectConfig>();
    const render = useRender();
    const [learning_rate, setLearningRate] = React.useState<string>(String(project_config.model.learning_rate));
    const { notify, Dialogue } = useDialogue();

    const field_errors: { [key: string]: string | undefined } = {
        learning_rate: project_config.model.learning_rate > 0 ? undefined : HyperparameterError.learning_rate,
        epochs: project_config.model.epochs > 0 ? undefined : HyperparameterError.epochs,
        batch_size: project_config.model.batch_size > 0 ? undefined : HyperparameterError.batch_size,
        loss_function: !!(Losses as any)[project_config.model.loss_fn as Loss] ? undefined : "Choose a loss function",
        optimizer: !!Optimizers[project_config.model.optimizer as Optimizer] ? undefined : "Choose an optimizer",
        metrics: undefined,
        validation_split: project_config.model.validation_split >= 0 && project_config.model.validation_split < 1 ? undefined : HyperparameterError.validation_split
    }

    const iconStyle = (field: string) => `shrink-0 size-5 ${field_errors[field] ? "invisible" : "text-success"}`;


    React.useEffect(() => {
        const all_ok = Object.values(field_errors).filter(error => error != undefined).length == 0;

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


    const onChangeLossFunction = (loss_fn: string) => {
        project_config.model.loss_fn = loss_fn as Loss;
        render();
    }


    const onChangeOptimizer = (optimizer: string) => {
        project_config.model.optimizer = optimizer as Optimizer;
        render();
    }


    const onChangeValidationSplit = (split: number) => {
        project_config.model.validation_split = split;
        render();
    }


    const onChangeMetrics = (metric: string) => {
        if (!project_config.model.metrics.includes(metric as Metric)) {
            project_config.model.metrics.push(metric as Metric)
        } else {
            project_config.model.metrics =
                project_config.model.metrics.filter(existing => existing != metric);
        }

        full_render();
    }

    // handle split options not part of default list, ensure within range [0, 1)
    if (!val_split_options[project_config.model.validation_split]) {
        if (project_config.model.validation_split < 0 ||
            project_config.model.validation_split >= 1) {
            project_config.model.validation_split = 0.2;
        }

        const split_pretty = Number(project_config.model.validation_split) * 100;
        val_split_options[project_config.model.validation_split.toString()] =
            `Training ${100 - split_pretty}% · Validation ${split_pretty}%`;
    }

    return <Container
        id="hyperparameters"
        heading="Set Hyperparameters"
        subheading="Hyperparameters determine the type of model and how effectively it is trained. They are frequently adjusted to help the model reach its optimal state."
        icon={Settings2}
        className="flex flex-col"
    >
        <Dialogue />

        <div className="md:grid grid-cols-12 flex flex-col overflow-auto gap-y-2 grow w-full md:max-w-2xl py-1">
            {/* Epochs label */}
            <div className={field_layout_css}>
                <FieldLabel
                    disabled={worker?.isTraining()}
                    error={!!field_errors.epochs}
                    notify={notify}
                    title={HyperparameterInfo.epochs.title}
                    description={HyperparameterInfo.epochs.description}
                />
            </div>

            {/* Epochs value */}
            <div className={field_layout_css}>
                <div className="grow">
                    <Input
                        id="hyperparameters-epochs"
                        disabled={worker?.isTraining()}
                        type="text"
                        value={project_config.model.epochs ? project_config.model.epochs : ""}
                        onChange={onChangeEpochs} />
                    {field_errors.epochs && <span className={error_text_css}>{field_errors.epochs}</span>}
                </div>
                <Check className={iconStyle("epochs")} />
            </div>


            {/* Batch size label */}
            <div className={field_layout_css}>
                <FieldLabel
                    disabled={worker?.isTraining()}
                    error={!!field_errors.batch_size}
                    notify={notify}
                    title={HyperparameterInfo.batch_size.title}
                    description={HyperparameterInfo.batch_size.description}
                />
            </div>

            {/* Batch size value */}
            <div className={field_layout_css}>
                <div className="grow">
                    <Input
                        id="hyperparameters-batch-size"
                        disabled={worker?.isTraining()}
                        type="text"
                        value={project_config.model.batch_size ? project_config.model.batch_size : ""}
                        onChange={onChangeBatchSize} />
                    {field_errors.batch_size && <span className={error_text_css}>{field_errors.batch_size}</span>}
                </div>
                <Check className={iconStyle("batch_size")} />
            </div>

            {/* Optimizer label */}
            <div className={field_layout_css}>
                <FieldLabel
                    disabled={worker?.isTraining()}
                    error={!!field_errors.optimizer}
                    notify={notify}
                    title={HyperparameterInfo.optimizer.title}
                    description={HyperparameterInfo.optimizer.description}
                />
            </div>

            {/* Optimizer value */}
            <div className={field_layout_css}>
                <div className="grow">
                    <SelectField
                        id="hyperparameters-optimizer"
                        disabled={worker?.isTraining()}
                        value={project_config.model.optimizer}
                        placeholder="Optimizer"
                        onValueChange={onChangeOptimizer} options={Optimizers} />
                    {field_errors.optimizer && <span className={error_text_css}>{field_errors.optimizer}</span>}
                </div>
                <Check className={iconStyle("optimizer")} />
            </div>


            {/* Learning rate label */}
            <div className={field_layout_css}>
                <FieldLabel
                    disabled={worker?.isTraining()}
                    error={!!field_errors.learning_rate}
                    notify={notify}
                    title={HyperparameterInfo.learning_rate.title}
                    description={HyperparameterInfo.learning_rate.description}
                />
            </div>

            {/* Learning rate value */}
            <div className={field_layout_css}>
                <div className="grow">
                    <Input
                        id="hyperparameters-learning-rate"
                        disabled={worker?.isTraining()}
                        type="text"
                        value={learning_rate}
                        onChange={onChangeLearningRate} />
                    {field_errors.learning_rate && <span className={error_text_css}>{field_errors.learning_rate}</span>}
                </div>
                <Check className={iconStyle("learning_rate")} />
            </div>

            {/* Loss function label */}
            <div className={field_layout_css}>
                <FieldLabel
                    disabled={worker?.isTraining()}
                    notify={notify}
                    title={HyperparameterInfo.loss_function.title}
                    description={HyperparameterInfo.loss_function.description}
                />
            </div>

            {/* Loss function value */}
            <div className={field_layout_css}>
                <div className="grow">
                    <SelectField
                        id="hyperparameters-loss-function"
                        disabled={worker?.isTraining()}
                        placeholder="Loss function"
                        options={Losses}
                        value={project_config.model.loss_fn}
                        onValueChange={onChangeLossFunction} />
                </div>
                <Check className={iconStyle("loss_function")} />
            </div>


            {/* Validation split label */}
            <div className={field_layout_css}>
                <FieldLabel
                    disabled={worker?.isTraining()}
                    notify={notify}
                    title={HyperparameterInfo.validation_split.title}
                    description={HyperparameterInfo.validation_split.description}
                />
            </div>

            {/* Validation split value */}
            <div className={field_layout_css}>
                <div className="grow">
                    <SelectField
                        id="hyperparameters-val-split"
                        value={project_config.model.validation_split.toString()}
                        options={val_split_options}
                        onValueChange={value => onChangeValidationSplit(Number(value))}
                    />
                    {field_errors.validation_split && <span className="text-muted-foreground text-sm">{field_errors.validation_split}</span>}
                </div>
                <Check className={iconStyle("validation_split")} />
            </div>

            {/* Metrics label */}
            <div className={field_layout_css}>
                <FieldLabel
                    disabled={worker?.isTraining()}
                    notify={notify}
                    title={HyperparameterInfo.metrics.title}
                    description={HyperparameterInfo.metrics.description}
                />
            </div>

            {/* Metrics value */}
            <div className={field_layout_css}>
                <div className="grow">
                    <MultiSelect
                        id="hyperparameters-metrics"
                        className={project_config.model.metrics.length == 0 ? "text-muted-foreground" : ""}
                        label={project_config.model.metrics.length == 0 ? "None" : project_config.model.metrics.map(metric => MetricsLabels[metric]).join(", ")}
                    >
                        {Object.keys(Metrics).map(metric => <MultiSelectOption
                            className={project_config.model.metrics.includes(metric as Metric) ? "bg-elevated-2! hover:bg-elevated-2" : ""}
                            onClick={() => onChangeMetrics(metric)}
                            key={metric}
                        >
                            {Metrics[metric]}
                        </MultiSelectOption>)}
                    </MultiSelect>
                </div>
                <Check className={iconStyle("")} />
            </div>
        </div>

    </Container>
}
