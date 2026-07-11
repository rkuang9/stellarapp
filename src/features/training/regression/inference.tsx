import React from "react";

import OneHotEncoder from '@/lib/data-processing/onehot_encoder';
import { MinMaxScaler, StandardScaler } from "danfojs";

import { Info, Play } from "lucide-react";
import { Input } from "@/components/ui/input";

import { Container } from "@/features/training/container";
import { useProject } from "@/features/training/project-contexts";
import type ProjectConfig from "@/lib/data-processing/project_config";
import { DummyArgs } from "@/lib/data-processing/project_config";
import { SelectField } from "@/components/custom/select-field";
import { toaster } from "@/components/toaster";
import { abbreviatedCount, wait } from "@/lib/utility";
import { RegressionContext } from "@/features/training/regression/regression-contexts";
import { useDialogue } from "@/components/dialogue";
import type RegressionModelWorker from "@/lib/webworker/regression_client";
import { downloadModel } from "@model-io";


export default function Inference() {
    const { worker, project_config, meta, cache, full_render } = useProject<ProjectConfig, RegressionModelWorker>();
    const { dataframe } = React.useContext(RegressionContext);

    const [outputs, setOutputs] = React.useState<number[]>([]);
    const [download_progress, setDownloadProgress] = React.useState<number | undefined>(undefined);
    const is_classification = Object.keys(project_config.preprocessing.onehot_encoding).length > 0;


    const downloadCloudModel = async () => {
        if (!downloadModel) {
            return;
        }

        toaster.info("Downloading model files");

        const { model_json, weights_bin } = await downloadModel({
            username: meta.project!.username,
            project_name: meta.project!.project_name,
            callback: event => {
                setDownloadProgress(event.loaded / event.total!);
            }
        })

        cache.cloud_model_state = "downloaded";
        // keep the download indicator at 100% for a little longer for
        // the user to see that it completed
        wait(2_000).then(() => setDownloadProgress(undefined));

        const { parameters } = await worker!.load({ model_json, weights_bin, project_config });

        toaster.success(`Loaded model with ${abbreviatedCount(parameters, 2)} parameters`);
        full_render();
    }


    // applies standardization or dummy conversion if applicable and transforms
    // the column-value mapping to a number[] that serves as the model input
    const preprocessInputs = (inputs: { readonly [key: string]: string | number; }) => {
        return project_config.preprocessing.input_cols
            // to column's value must have something, if it's not a dummy column then it must be a number
            .filter(col => inputs[col] != undefined &&
                (project_config.preprocessing.dummy_variables[col] || typeof inputs[col] == "number"))
            .flatMap(col => {
                const dummy = project_config.preprocessing.dummy_variables[col];

                // transform into dummy variables encoding
                if (dummy) {
                    const fit = dummy.trap_drop
                        ? dummy.uniques.filter(val => val != dummy.trap_drop)
                        : dummy.uniques;
                    // TODO: verify out of value results in a zeroes tensor
                    const encoded = new OneHotEncoder(fit).transform([inputs[col]]) as number[][];
                    return encoded[0];
                }

                const scale_col = project_config.preprocessing.scale_cols[col];

                // apply min-max scaling
                if (scale_col && scale_col != "placeholder") {
                    const scaler = new MinMaxScaler().fit([scale_col.min, scale_col.max]);
                    const scaled = scaler.transform([inputs[col]]) as number[][];
                    return scaled[0];
                }

                const zscore_col = project_config.preprocessing.zscore_cols[col];

                // apply z-score standardization
                if (zscore_col && zscore_col != "placeholder") {
                    const standardizer = new StandardScaler();
                    standardizer["$mean"] = zscore_col.mean;
                    standardizer["$std"] = zscore_col.std;

                    const standardized = standardizer.transform([inputs[col]]) as number[][];
                    return standardized[0];
                }

                return inputs[col] as number;
            });
    }


    const handleNumericOutput = (prediction: number[][]) => {
        // undo min-max scaling
        for (const scale in project_config.preprocessing.scale_cols) {
            const scale_col = project_config.preprocessing.scale_cols[scale];
            const scale_index = project_config.preprocessing.target_cols.indexOf(scale);

            if (scale_index != -1 && scale_col != "placeholder") {
                const scaler = new MinMaxScaler().fit([scale_col.min, scale_col.max]);
                prediction[scale_index] = scaler.inverseTransform(prediction[scale_index]);
            }
        }

        // undo z-score standardization
        for (const zscore in project_config.preprocessing.zscore_cols) {
            const zscore_col = project_config.preprocessing.zscore_cols[zscore];
            const zscore_index = project_config.preprocessing.target_cols.indexOf(zscore);

            if (zscore_index != -1 && zscore_col != "placeholder") {
                const standardizer = new StandardScaler();
                standardizer["$mean"] = zscore_col.mean;
                standardizer["$std"] = zscore_col.std;
                prediction[zscore_index] = standardizer.inverseTransform(prediction[zscore_index]);
            }
        }

        setOutputs(prediction[0]);
    }


    const handleClassificationOutput = (prediction: number[][]) => {
        if (!prediction[0]) {
            toaster.error("An error occurred, the model failed to return a prediction");
            return;
        }

        setOutputs(prediction[0]);
    }


    const makePrediction = (prediction_input: number[]) => {
        (worker as RegressionModelWorker)?.predict({
            inputs: [prediction_input],
            backend: project_config.model.backend,
            batch_size: 1,
        }).then(prediction => {
            if (prediction.length == 0) {
                return;
            }

            if (Object.keys(project_config.preprocessing.onehot_encoding).length == 0) {
                // numerical regression output
                handleNumericOutput(prediction);
            } else {
                // classification output
                handleClassificationOutput(prediction);
            }
        }).catch(error => {
            toaster.error(`An error occurred while making a prediction: ${error.toString()}`);
        })
    }


    const onChange = async (inputs: { readonly [key: string]: string | number; }) => {
        const prediction_input = preprocessInputs(inputs);

        // don't make a prediction because there aren't enough inputs
        if (project_config.model.input_shape.length > 0 &&
            project_config.model.input_shape[0] != prediction_input.length) {
            setOutputs([]);
            return;
        }

        if (!worker) {
            toaster.error("Failed to create a web worker. Please ensure your browser supports them and try reloading this page.");
            return;
        }

        if (meta.project && !worker?.isBuilt() && cache.cloud_model_state == "can_download" && downloadModel) {
            downloadCloudModel().then(() => {
                makePrediction(prediction_input);
            }).catch(error => {
                setDownloadProgress(undefined);
                cache.cloud_model_state = "error";
                toaster.error(`Error while downloading the model: ${error.toString()}`);
            });

            return;
        }

        if (!worker.isBuilt()) {
            toaster.error("The model needs to be trained before inference is available")
            return;
        }

        makePrediction(prediction_input);
    }

    return <Container
        id="inference"
        heading={`Inference`}
        subheading={`Run the model directly in the browser ${download_progress != undefined ? `(Downloading model files...${(download_progress * 100).toFixed(0)}%)` : ""}`}
        className="h-full grow flex flex-col"
        icon={Play}
    >
        <div className="flex flex-col gap-2 grow overflow-auto">
            <div className="grow text-start md:text-center text-muted-foreground" id="regression-inference-info" suppressHydrationWarning>
                {(!worker?.isBuilt() && cache.cloud_model_state != "can_download") ? "Inference will be available after the model is trained" : ""}
            </div>

            <div className={`flex flex-row grow-10 overflow-auto justify-evenly`}>
                <div className={`w-1/2 lg:w-5/12 xl:w-1/3 overflow-auto p-2`}>
                    <RegressionInput
                        disabled={worker?.isTraining() || (!worker?.isBuilt() && cache.cloud_model_state != "can_download")}
                        columns={project_config.preprocessing.input_cols}
                        dummies={project_config.preprocessing.dummy_variables}
                        dtypes={dataframe?.types}
                        onChange={onChange} />
                </div>

                <div className={`w-1/2 lg:w-5/12 xl:w-1/3 overflow-auto p-2`}>
                    {is_classification
                        ? <RegressionOutputCategorical
                            predictions={outputs}
                            onehot_encoding={project_config.preprocessing.onehot_encoding}
                        />
                        : <RegressionOutputNumeric
                            // create a mapping of column-prediction values
                            predictions={Object.fromEntries(
                                project_config.preprocessing.target_cols
                                    .map((col, index) => [col, outputs[index] ?? ""])
                            )}
                        />}
                </div>
            </div>
        </div>
    </Container>
}


interface RegresssionInputArgs {
    columns: string[];
    dummies: DummyArgs;
    disabled?: boolean;
    onChange: (inputs: { readonly [key: string]: number | string }) => void;
    dtypes?: { [key: string]: "float32" | "int32" | "string" | "boolean" };
}


/**
 * This component renders a column of numeric and dummy input fields and
 * exposes an onChange function that runs when any one of the fields change
 */
export function RegressionInput({ columns, dummies, disabled, onChange, dtypes }: RegresssionInputArgs) {
    const [inputs, setInputs] = React.useState<{ [key: string]: number | string }>({});
    const { Dialogue, notify } = useDialogue();

    const onInputsChange = (val: string, col: string) => {
        if (dtypes?.[col] == "boolean" && (val == "true" || val == "false")) {
            inputs[col] = val == "true" ? 1 : 0;
        } else {
            const new_num = Number(val);

            if (val == undefined || val == "") {
                delete inputs[col];
            } else if (!isNaN(new_num)) {
                inputs[col] = new_num;
            } else {
                inputs[col] = val;
            }
        }

        setInputs({ ...inputs });
        onChange(inputs);
    }

    const showInfo = () => {
        notify({ title: "Boolean columns", description: "For boolean (true/false) columns, enter 1 for true and 0 for false" })
    }

    return <div className="flex flex-col gap-2">
        <span className="text-lg text-muted-foreground flex gap-2 items-center">
            Enter model inputs
            {!dtypes && <Info size={20} className="hover:cursor-pointer" onClick={showInfo} />}
        </span>

        <Dialogue />

        <div className="flex flex-col gap-2">
            {columns.map((col, index) => <React.Fragment key={col + index}>
                <label htmlFor={col + index} title={col} className="text-sm text-theme whitespace-pre-wrap line-clamp-3">
                    {col}
                </label>

                {dummies && dummies[col] && dummies[col].uniques.length > 0
                    // displays a select field for dummy columns
                    ? <SelectField
                        id={`inference-${index}-${col}`}
                        disabled={disabled ?? undefined}
                        value={inputs[col] ? inputs[col].toString() : ""}
                        options={dummies[col].uniques}
                        onValueChange={val => onInputsChange(val, col)}
                    />
                    // displays an input field for numeric inputs
                    : dtypes?.[col] == "boolean"
                        ? <SelectField
                            id={`inference-${index}-${col}`}
                            value={inputs[col] != undefined ? (inputs[col] == 1 ? "true" : "false") : "omg"}
                            options={["true", "false"]}
                            onValueChange={val => onInputsChange(val, col)}
                        />
                        : <Input
                            id={`inference-${index}-${col}`}
                            disabled={disabled}
                            suppressHydrationWarning
                            value={inputs[col] != undefined ? inputs[col] : ""}
                            inputMode="decimal"
                            onChange={event => onInputsChange(event.target.value, col)}
                        />}
            </React.Fragment>)}
        </div>
    </div>
}


/**
 * This component renders a column of numeric fields that display the output
 * of predictions.
 * 
 * @param predictions an object whose keys are columns and values their prediction values
 */
export function RegressionOutputNumeric({ predictions }: {
    predictions: { [column: string]: number }
}) {
    return <div className="flex flex-col gap-2">
        <span className="text-lg text-muted-foreground">Model prediction</span>

        <div className="flex flex-col gap-2">
            {Object.keys(predictions).map((col, index) => <React.Fragment key={col + index}>
                <label htmlFor={col + index} title={col} className="text-sm text-theme whitespace-pre-wrap line-clamp-3">
                    {col}
                </label>

                <Input
                    id={`prediction-${index}-${col}`}
                    title="Click to copy outputs"
                    className="select-none cursor-default ring-0 focus:ring-0!"
                    value={predictions[col] != undefined ? predictions[col].toString() : ""}
                    readOnly={true}
                    onClick={() => { navigator.clipboard.writeText(Object.values(predictions).toString()) }}
                    onChange={() => { }}
                />
            </React.Fragment>)}
        </div>
    </div>
}


export function RegressionOutputCategorical({ predictions, onehot_encoding }: {
    predictions: number[];
    onehot_encoding: { [key: string]: number }
}) {
    // index-to-class, the index (as key) is automatically sorted
    const onehot_reverse = Object.fromEntries(Object.entries(onehot_encoding).map(([key, value]) => [value, key]));

    return <div className="flex flex-col gap-2">
        <span className="text-lg text-muted-foreground">Class predictions</span>

        <div className="flex flex-col gap-2">
            {Object.keys(onehot_reverse).map((class_index_str, index) => {
                const class_index = Number(class_index_str);
                const prediction = predictions[class_index];

                return (
                    <React.Fragment key={class_index_str + index}>
                        <label className="text-sm text-theme whitespace-pre-wrap line-clamp-3">
                            {onehot_reverse[class_index_str]}
                        </label>

                        <Input
                            id={`prediction-${index}-${class_index_str}`}
                            className="select-none cursor-default ring-0 focus:ring-0!"
                            value={prediction != undefined ? prediction : ""}
                            readOnly={true}
                            onChange={() => { }}
                        />
                    </React.Fragment>
                )
            })}
        </div>
    </div>
}
