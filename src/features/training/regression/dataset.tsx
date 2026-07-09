"use client"

import React from "react";

import {
    Check,
    FileText,
    Folder,
    Info
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { useDialogue } from "@/components/dialogue";
import { toaster } from "@/components/toaster";
import { MultiSelect, MultiSelectOption } from "@/components/custom/multi-select";
import { Container } from "@/features/training/container";

import { RegressionContext } from "@/features/training/regression/regression-contexts";
import ForgeFrame from "@/lib/data-processing/forgeframe";
import { reserved_column_names } from "@/lib/data-processing/forgeframe";
import { readJSON, readCSV, readExcel } from "danfojs";
import { ProjectContext, useProject } from "@/features/training/project-contexts";
import useRender from "@/components/use-render";
import type ProjectConfig from "@/lib/data-processing/project_config";
import type RegressionModelWorker from "@/lib/webworker/regression_client";


const file_type_parser: { [key: string]: any } = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": readExcel,
    "text/csv": readCSV,
    "application/json": readJSON,
    "text/json": readJSON,
    "application/vnd.ms-excel": readExcel,
    "text/comma-separated-values": readCSV // used by Firefox Android
};

const accepted_mimes = Object.keys(file_type_parser).toString();


export default function Dataset() {
    const { status, dataframe } = React.useContext(RegressionContext);
    const { project_config, full_render } = React.useContext(ProjectContext);

    React.useEffect(() => {
        let all_ok = true;

        if (project_config.preprocessing.input_cols.length == 0) {
            all_ok = false;
        }

        if (project_config.preprocessing.target_cols.length == 0) {
            all_ok = false;
        }

        if (!dataframe || dataframe.size == 0) {
            all_ok = false;
        }

        if (status.dataset != all_ok) {
            status.dataset = all_ok;
            full_render();
        }
    });


    return <Container
        id="dataset"
        heading="Select Training Data"
        subheading="Choose the data for your regression model to train on."
        icon={FileText}
        className="flex flex-col"
    >
        <div className="flex flex-col overflow-auto gap-4 grow w-full md:max-w-xl lg:max-w-2xl">
            <div>
                <LoadDataset />
            </div>

            <Separator />

            <div className="flex flex-col rounded-lg gap-2">
                <InputColumns />
            </div>

            <div className="flex flex-col rounded-lg gap-2">
                <OutputColumns />
            </div>
        </div>

    </Container>
}


function InputColumns() {
    const { dataframe } = React.useContext(RegressionContext);
    const { project_config, worker, full_render } = useProject<ProjectConfig, RegressionModelWorker>();

    const selected = project_config.preprocessing.input_cols;
    return <>
        <div className="text-base flex gap-2 items-center">
            <span className={`${worker?.isTraining() ? "text-muted-foreground" : ""}`}>Select the input data</span>
        </div>

        <div className="flex gap-2 items-center">
            <MultiSelect
                id="input-cols"
                className="shrink"
                disabled={worker?.isTraining()}
                label={selected.join(", ")}>
                {(!dataframe || dataframe.columns.length == 0) && <MultiSelectOption>No data available</MultiSelectOption>}
                {dataframe?.columns.map((col, index) => <MultiSelectOption
                    id={`input-${index}-${col}`}
                    className={selected.includes(col) ? "bg-elevated-2! hover:bg-elevated-2" : ""}
                    key={col}
                    onClick={() => {
                        if (selected.includes(col)) {
                            project_config.preprocessing.input_cols = selected.filter(selected_col => selected_col != col)
                        } else {
                            const col_dtype = dataframe.types[col];
                            selected.push(col);

                            if ((col_dtype == "float32" || col_dtype == "int32") &&
                                !project_config.preprocessing.zscore_cols[col]) {
                                project_config.preprocessing.zscore_cols[col] = "placeholder";
                            }
                        }

                        project_config.model.input_shape = [project_config.preprocessing.input_cols.length];

                        full_render();
                    }}>
                    <div className="flex justify-between grow max-w-full">
                        <span className="truncate">{col}</span>
                        <span className="text-muted-foreground">{dataframe.types[col]}</span>
                    </div>
                </MultiSelectOption>)}
            </MultiSelect>

            <Check className={`shrink-0 size-5 ${project_config.preprocessing.input_cols.length == 0 ? "invisible" : "text-success"}`} />
        </div>
    </>
}


function OutputColumns() {
    const { dataframe } = React.useContext(RegressionContext);
    const { project_config, worker, full_render } = useProject<ProjectConfig, RegressionModelWorker>();

    const local_render = useRender();
    const { notify, Dialogue } = useDialogue();

    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        // ensure if a string column is selected, it is the sole column
        if (project_config.preprocessing.target_cols.filter(col => dataframe?.types[col] == "string").length > 0 && project_config.preprocessing.target_cols.length != 1) {
            project_config.preprocessing.target_cols = [];
            local_render();
        }
    }, [project_config.preprocessing.target_cols])
    /* eslint-enable react-hooks/exhaustive-deps */

    const selected = project_config.preprocessing.target_cols;

    const outputInfo = () => {
        notify({
            title: "Prediction targets",
            description: "Select the data columns that the model should predict. You may select multiple numeric and true/false columns or a single text (categorical) column."
        })
    }

    return <>
        <div className="text-base flex gap-2 items-center">
            <span className={`${worker?.isTraining() ? "text-muted-foreground" : ""}`}>Select the prediction target</span>
            <Info size={16} className="cursor-pointer text-muted-foreground" onClick={outputInfo} />
        </div>

        <Dialogue />

        <div className="flex gap-2 items-center">
            <MultiSelect
                id="target-cols"
                className="whitespace-pre-wrap break-normal shrink"
                disabled={worker?.isTraining()}
                label={selected.join(", ")}>
                {(!dataframe || dataframe.columns.length == 0) && <MultiSelectOption>No data available</MultiSelectOption>}
                {dataframe?.columns.map((col, index) => <MultiSelectOption
                    key={col}
                    id={`target-${index}-${col}`}
                    className={selected.includes(col) ? "bg-elevated-2! hover:bg-elevated-2" : ""}
                    onClick={() => {
                        if (selected.includes(col)) {
                            project_config.preprocessing.target_cols = selected.filter(selected_col => selected_col != col)
                        } else {
                            if (dataframe.types[col] == "string") {
                                project_config.preprocessing.target_cols = [col];
                            } else {
                                const col_dtype = dataframe.types[col];

                                project_config.preprocessing.target_cols = [
                                    ...project_config.preprocessing.target_cols.filter(col => dataframe.types[col] != "string"),
                                    col
                                ];

                                if ((col_dtype == "float32" || col_dtype == "int32") &&
                                    !project_config.preprocessing.zscore_cols[col]) {
                                    project_config.preprocessing.zscore_cols[col] = "placeholder";
                                }
                            }
                        }

                        full_render();
                    }}
                >
                    <div className="flex justify-between grow max-w-full">
                        <span className="truncate">{col}</span>
                        <span className="text-muted-foreground">{dataframe.types[col]}</span>
                    </div>
                </MultiSelectOption>)}
            </MultiSelect>

            <Check className={`shrink-0 size-5 ${project_config.preprocessing.target_cols.length == 0 ? "invisible" : "text-success"}`} />
        </div>
    </>
}


function LoadDataset() {
    const { dataframeRef, dataframe } = React.useContext(RegressionContext);
    const { project_config, worker, full_render } = useProject<ProjectConfig, RegressionModelWorker>();
    const { notify, confirmation, Dialogue } = useDialogue();
    const [filename, setFileame] = React.useState<string | undefined>(undefined);

    const handleTabularDataset = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length < 1) {
            return;
        }

        const file = event.target.files[0];

        if (!file_type_parser[file.type]) {
            notify(`The dataset file type is unsupported: ${file.type}`);
            return;
        }

        toaster.info(`Loading ${file.name}...`);

        file_type_parser[file.type](file).then(async (df: ForgeFrame) => {
            try {
                const reserved_cols = df.columns.filter((col: string) => reserved_column_names.includes(col));

                if (reserved_cols.length > 0) {
                    notify({
                        title: "Reserved Column Names",
                        description: `This dataset contains column names that are reserved by ` +
                            `${process.env.NEXT_PUBLIC_PROJECT_NAME}. Rename these columns to continue.\n\nReserved column names: ${reserved_cols.join(", ")}`,
                    })

                    return;
                }

                const invalid_cols = [ // check for invalid selected columns
                    ...project_config.preprocessing.input_cols,
                    ...project_config.preprocessing.target_cols,
                    //...Object.keys(project_config.preprocessing.scale_cols),
                    //...Object.keys(project_config.preprocessing.zscore_cols),
                    //...project_config.preprocessing.filters.map(item => item.column),
                    //...Object.keys(project_config.preprocessing.dummy_variables),
                ].filter(col => !df.columns.includes(col));

                if (invalid_cols.length > 0) {
                    if (await confirmation({
                        title: "Invalid columns",
                        description: `Some of your input/target selections were not found in this dataset. Clear the selections and continue?\n\n` +
                            `Invalid columns: ${[...new Set(invalid_cols)].join(", ")}`,
                    })) {
                        project_config.resetColumns();
                    } else {
                        return;
                    }
                }

                if (dataframeRef) {
                    toaster.success(`Loaded dataset with ${df.shape[0].toLocaleString()} samples`)

                    dataframeRef.current = new ForgeFrame(df.values, {
                        columns: df.columns,
                        binaryAsBoolean: true,
                    });

                    setFileame(file.name);
                    full_render();
                }
            } catch (error: any) {
                notify(`An error occurred while loading ${file.name}: ${error.toString()}`);
            }
        }).catch((error: any) => {
            notify(`An error occurred while loading ${file.name}: ${error.toString()}`);
        });
    }

    return <div className="flex gap-2 items-center max-w-full">
        <Dialogue />

        <Button id="load-dataset-button" variant="outline" disabled={worker?.isTraining()} className={`h-auto max-w-full whitespace-pre-wrap! shrink break-normal! ${!dataframe || dataframe.size == 0 ? "border-theme!" : ""} ${worker?.isTraining() ? "text-muted-foreground hover:text-muted-foreground" : ""}`} asChild>
            <label id="load-dataset-label" htmlFor="load-dataset" className="cursor-pointer whitespace-pre-wrap break-normal font-normal">
                <Folder className="text-theme" />
                {filename ? `Dataset: ${filename} (${dataframe?.shape[0].toLocaleString()} samples)` : "Load dataset (Excel, CSV, or JSON)"}
            </label>
        </Button>

        <Check className={`size-5 shrink-0 ${dataframe && dataframe.shape[0] > 0 ? "text-success" : "invisible"}`} />

        <Input
            value="" // set to ""so the same document (for whatever reason) can be loaded in succession
            disabled={worker?.isTraining()}
            onChange={handleTabularDataset}
            hidden
            id="load-dataset"
            multiple
            type="file"
            accept={accepted_mimes} />
    </div>
}
