import React from "react";

import { ProjectContext } from "@/features/training/project-contexts";
import { updateLayerRank, Padding } from "@/features/training/regression/layers/layer-types";
import { Activations } from "@/types/hyperparameters";
import { LayerContext } from "@/features/training/regression/layers/layer-context";

import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/custom/select-field";
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Layers2, Trash } from "lucide-react";


export function getLayerComponent(identifier: string) {

    switch (identifier) {
        case "dense":
            return DenseLayer;
        case "dropout":
            return DropoutLayer;
        case "batchNormalization":
            return BatchNormalizationLayer;
        case "layerNormalization":
            return LayerNormalizationLayer;
        case "embedding":
            return EmbeddingLayer;
        case "lstm":
            return LSTMLayer;
        case "gru":
            return GRULayer;
        case "conv2d":
            return Conv2DLayer;
        case "globalAveragePooling1d":
            return GlobalAveragePooling1DLayer;
        case "globalMaxPooling1d":
            return GlobalMaxPooling1DLayer;
        case "flatten":
            return FlattenLayer;
        case "maxPooling2d":
            return MaxPooling2D;
        case "averagePooling2d":
            return AveragePooling2D;
        case "transformerEncoder":
            return TransformerEncoderLayer;
        case "transformerDecoder":
            return TransformerDecoderLayer;
        case "tokenAndPositionalEmbedding":
            return TokenAndPositionalEmbeddingLayer;
        default:
            return null;
    }
}


interface LayerArgs {
    index: number;
    error?: boolean;
}


interface BaseLayerArgs extends LayerArgs {
    children?: React.ReactNode;
    label: string;
}


/**
 * The container for all layers. Handles displaying the layer name
 * and removing the layer. The actual layers only need to implement
 * input components and layer update logic. 
 */
export function BaseLayer({ children, label, index, ...rest }: BaseLayerArgs) {
    const { project_config, full_render } = React.useContext(ProjectContext);
    const { selected, setSelected, confirmation, disabled } = React.useContext(LayerContext);

    const swapLayers = (source: number, destination: number) => {
        const layer_count = project_config.model.layers.length;

        if (source == destination || source < 0 || destination < 0 || source >= layer_count || destination >= layer_count) {
            return;
        }

        const temp = project_config.model.layers[source];
        project_config.model.layers[source] = project_config.model.layers[destination];
        project_config.model.layers[destination] = temp;
        updateLayerRank(project_config.model.layers, project_config.model.input_shape);
        setSelected(destination);
    }

    const moveUp = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.stopPropagation(); // stops trigger parent div's onClick that sets selected layer
        swapLayers(index, index - 1);
        full_render();
    }

    const moveDown = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.stopPropagation();
        swapLayers(index, index + 1);
        full_render();
    }

    const removeLayer = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.stopPropagation();
        project_config.model.layers.splice(index, 1);
        updateLayerRank(project_config.model.layers, project_config.model.input_shape);
        setSelected(NaN);
        full_render();
    }

    const removeLayerMobileConfirm = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.stopPropagation();
        if (await confirmation({
            description: `Are you sure you want to delete this ${label} layer?`,
            yes: "Yes"
        })) {
            project_config.model.layers.splice(index, 1);
            updateLayerRank(project_config.model.layers, project_config.model.input_shape);
            setSelected(NaN);
            full_render();
        }
    }

    const LayerControls = ({ view }: { view: "desktop" | "mobile" }) => {
        return (
            <>
                <Button
                    disabled={index == 0 || disabled}
                    id={`${label}-${index}-move-up-${view}`}
                    className="cursor-pointer"
                    variant="outline"
                    size="icon"
                    onClick={moveUp}
                >
                    <ArrowUp />
                </Button>

                <Button
                    disabled={index == project_config.model.layers.length - 1 || disabled}
                    id={`${label}-${index}-move-down-${view}`}
                    className="cursor-pointer"
                    variant="outline"
                    size="icon"
                    onClick={moveDown}
                >
                    <ArrowDown />
                </Button>

                {view == "desktop" && <Button
                    disabled={disabled}
                    id={`${label}-${index}-remove-${view}`}
                    variant="outline"
                    size="icon"
                    className="cursor-pointer hidden md:flex"
                    onClick={removeLayer}>
                    <Trash className="text-error" />
                </Button>}

                {view == "mobile" && <Button
                    disabled={disabled}
                    id={`${label}-${index}-remove-${view}`}
                    variant="outline"
                    size="icon"
                    className="cursor-pointer flex md:hidden"
                    onClick={removeLayerMobileConfirm}>
                    <Trash className="text-error" />
                </Button>}
            </>
        )
    }

    const border_color = index == selected ? "ring-1 ring-theme" : "";

    return (
        <div className={`flex flex-col md:flex-row gap-2 w-full border ${border_color} p-2 rounded-lg`}>

            <div className="grow basis-0 flex items-center gap-2">
                <div id={`${label}-${index}-label`} className="truncate grow flex gap-2 items-center rounded-lg">
                    <Button variant="ghost" size="icon"><Layers2 className="text-theme shrink-0" /></Button>
                    <span className={`text-sm ${rest.error ? "text-error" : "text-muted-foreground"} flex md:hidden`}>{index + 1}</span>
                    <span className={`truncate text-sm ${rest.error ? "text-error" : disabled ? "text-muted-foreground" : ""}`}>{label}</span>
                </div>

                <div className="flex gap-2 md:hidden">
                    <LayerControls view="mobile" />
                </div>
            </div>


            {children && <div className="flex gap-2 grow-2 basis-0">
                {children}
            </div>}

            <div className="hidden gap-2 md:flex">
                <LayerControls view="desktop" />
            </div>
        </div>
    )
}


export function DenseLayer({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { setSelected, onLayerChange, disabled } = React.useContext(LayerContext);
    const dense = project_config.model.layers[index];

    const is_output_layer = index == project_config.model.layers.length - 1;

    // autofill units based on preprocessing configs
    if (is_output_layer && (
        dense.config.units == -9000 ||
        dense.config.units == 0 ||
        !dense.config.units
    )) {
        dense.config.units = -9000;
    }

    dense.auto = is_output_layer;
    const is_auto = dense.auto;

    const display_value = (dense.config.units != -9000 ? dense.config.units : "") as number | string;

    const onUnitsChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_units = Number(event.target.value);

        if (Number.isNaN(new_units) || new_units == Number.POSITIVE_INFINITY) {
            return;
        }

        if (event.target.value == "" || new_units <= 0) {
            new_units = -9000;
        }

        dense.config.units = new_units;
        onLayerChange();
        return;
    }

    const onActivationChange = (value: string) => {
        dense.config.activation = value;
        onLayerChange();
    }

    return <BaseLayer {...rest} index={index} label="Dense">
        <div className="flex grow gap-1">
            <Input
                id={`layer-${index}-units`}
                className="grow basis-0 truncate"
                placeholder="Units"
                value={is_output_layer && is_auto ? "AUTO" : display_value}
                disabled={disabled || (is_output_layer && is_auto)}
                onChange={onUnitsChange}

            />

            <SelectField
                id={`layer-${index}-activation`}
                onClick={() => setSelected(index)}
                className="grow basis-0 truncate"
                placeholder="Activation function"
                label="Activation function"
                value={dense.config.activation as string}
                onValueChange={onActivationChange}
                options={Activations}
                disabled={disabled}
            />
        </div>
    </BaseLayer>
}


export function DropoutLayer({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { disabled, onLayerChange } = React.useContext(LayerContext);
    const dropout = project_config.model.layers[index];

    const onRateChange = (value: string) => {
        const drop_rate = Number(value);

        if (!Number.isNaN(drop_rate)) {
            dropout.config.rate = drop_rate;
            onLayerChange();
        }
    }

    return <BaseLayer {...rest} index={index} label="Dropout">
        <SelectField
            id={`layer-${index}-drop-rate`}
            placeholder="Drop rate"
            label="Drop rate"
            value={dropout.config.rate.toString()}
            onValueChange={onRateChange}
            disabled={disabled}
            options={{
                0.1: "10%",
                0.2: "20%",
                0.3: "30%",
                0.4: "40%",
                0.5: "50%",
                0.6: "60%",
                0.7: "70%",
                0.8: "80%",
                0.9: "90%",
            }} />
    </BaseLayer>
}


export function FlattenLayer({ index, ...rest }: LayerArgs) {
    return <BaseLayer {...rest} index={index} label="Flatten" />
}


export function BatchNormalizationLayer({ index, ...rest }: LayerArgs) {
    return <BaseLayer {...rest} index={index} label="Batch Normalization" />
}


export function LayerNormalizationLayer({ index, ...rest }: LayerArgs) {
    return <BaseLayer {...rest} index={index} label="Layer Normalization" />
}


export function GRULayer({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { onLayerChange, disabled } = React.useContext(LayerContext);
    const gru = project_config.model.layers[index];
    const units = gru.config.units as number | string;
    const return_sequences = Boolean(gru.config.returnSequences);

    const onUnitsChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_units = Number(event.target.value);

        if (Number.isNaN(new_units)) {
            return;
        }

        if (event.target.value == "" || new_units <= 0) {
            new_units = -9000;
        }

        gru.config.units = new_units;
        onLayerChange();
    }

    const onReturnSequencesChange = () => {
        gru.config.returnSequences = !return_sequences;
        gru.output_rank = gru.config.returnSequences ? 3 : 2;
        updateLayerRank(project_config.model.layers, project_config.model.input_shape);
        onLayerChange();
    }

    return <BaseLayer {...rest} index={index} label="GRU">
        <div className="flex grow gap-1 items-center">
            <div className="flex grow basis-0">
                <Input
                    id={`layer-${index}-units`}
                    placeholder="Units"
                    value={units != -9000 ? units : ""}
                    onChange={onUnitsChange}
                    disabled={disabled}
                />
            </div>

            <div className={`flex grow basis-0 gap-2 items-center justify-center ${disabled ? "text-muted-foreground" : ""}`}>
                <Checkbox
                    id={`layer-${index}-return-sequences`}
                    className="data-[state=checked]:bg-theme! data-[state=checked]:border-theme!"
                    checked={return_sequences}
                    onClick={onReturnSequencesChange}
                    disabled={disabled}
                />
                Return sequences
            </div>
        </div>
    </BaseLayer>
}


export function LSTMLayer({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { onLayerChange, disabled } = React.useContext(LayerContext);
    const lstm = project_config.model.layers[index];
    const units = Number(lstm.config.units);
    const return_sequences = Boolean(lstm.config.returnSequences);

    const onUnitsChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_units = Number(event.target.value);

        if (Number.isNaN(new_units)) {
            return;
        }

        if (event.target.value == "" || new_units <= 0) {
            new_units = -9000;
        }

        lstm.config.units = new_units;
        onLayerChange();
    }

    const onReturnSequencesChange = () => {
        lstm.config.returnSequences = !return_sequences;
        lstm.output_rank = lstm.config.returnSequences ? 3 : 2;
        updateLayerRank(project_config.model.layers, project_config.model.input_shape);
        onLayerChange();
    }

    return <BaseLayer {...rest} index={index} label="LSTM">
        <div className="flex grow gap-1 items-center">
            <div className="flex grow basis-0">
                <Input
                    id={`layer-${index}-units`}
                    placeholder="Units"
                    value={units != -9000 ? units : ""}
                    onChange={onUnitsChange}
                    disabled={disabled}
                />
            </div>

            <div className={`flex grow basis-0 gap-2 items-center justify-center ${disabled ? "text-muted-foreground" : ""}`}>
                <Checkbox
                    id={`layer-${index}-return-sequences`}
                    className="data-[state=checked]:bg-theme! data-[state=checked]:border-theme!"
                    checked={return_sequences}
                    onClick={onReturnSequencesChange}
                    disabled={disabled}
                />
                Return sequences
            </div>
        </div>
    </BaseLayer>
}


export function EmbeddingLayer({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { onLayerChange, disabled } = React.useContext(LayerContext);

    const embedding = project_config.model.layers[index];
    const output_dim = Number(embedding.config.outputDim);

    const onEmbeddingLengthChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_value = Number(event.target.value);

        if (Number.isNaN(new_value)) {
            return;
        }

        if (event.target.value == "" || new_value <= 0) {
            new_value = -9000;
        }

        embedding.config.outputDim = new_value;
        onLayerChange();
    }

    return <BaseLayer {...rest} index={index} label="Embedding">
        <Input
            id={`layer-${index}-embed-size`}
            className="w-full"
            placeholder="Embedding length"
            value={output_dim != -9000 ? output_dim : ""}
            onChange={onEmbeddingLengthChange}
            disabled={disabled}
        />
    </BaseLayer>
}


export function GlobalAveragePooling1DLayer({ index, ...rest }: LayerArgs) {
    return <BaseLayer {...rest} index={index} label="Global Average Pooling 1D" />
}


export function GlobalMaxPooling1DLayer({ index, ...rest }: LayerArgs) {
    return <BaseLayer {...rest} index={index} label="Global Max Pooling 1D" />
}





export function Conv2DLayer({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { setSelected, onLayerChange, disabled } = React.useContext(LayerContext);
    const conv2d = project_config.model.layers[index];
    const filters = Number(conv2d.config.filters);
    const kernel_size = Number(conv2d.config.kernelSize);

    const onFiltersChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_filter_count = Number(event.target.value);

        if (Number.isNaN(new_filter_count)) {
            return;
        }

        if (event.target.value == "" || new_filter_count <= 0) {
            new_filter_count = -9000;
        }

        conv2d.config.filters = new_filter_count;
        onLayerChange();
    }

    const onKernelSizeChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_kernel_size = Number(event.target.value);

        if (Number.isNaN(new_kernel_size)) {
            return;
        }

        if (event.target.value == "" || new_kernel_size <= 0) {
            new_kernel_size = -9000;
        }

        conv2d.config.kernelSize = new_kernel_size;
        onLayerChange();
    }

    const onActivationChange = (value: string) => {
        conv2d.config.activation = value;
        onLayerChange();
    }

    const onPaddingChange = (value: string) => {
        conv2d.config.padding = value;
        onLayerChange();
    }

    return <BaseLayer {...rest} index={index} label="Conv2D">
        <div className="flex grow">
            <div className="grow grid grid-cols-12 xl:flex gap-1">

                <Input
                    id={`layer-${index}-filters`}
                    className="col-span-6 basis-0 grow"
                    placeholder="Filters"
                    value={filters != -9000 ? filters : ""}
                    onChange={onFiltersChange}
                    disabled={disabled}
                />

                <Input
                    id={`layer-${index}-kernel-size`}
                    className="col-span-6 basis-0 grow"
                    placeholder="Kernel size"
                    value={kernel_size != -9000 ? kernel_size : ""}
                    onChange={onKernelSizeChange}
                    disabled={disabled}
                />

                <SelectField
                    id={`layer-${index}-padding`}
                    className="col-span-6 basis-0 grow"
                    onClick={() => setSelected(index)}
                    placeholder="Padding type"
                    label="Padding type"
                    value={conv2d.config.padding as string}
                    options={{
                        [Padding.VALID]: "Valid padding",
                        [Padding.SAME]: "Same padding"
                    }}
                    onValueChange={onPaddingChange}
                    disabled={disabled}
                />

                <SelectField
                    className="col-span-6 basis-0 grow"
                    onClick={() => setSelected(index)}
                    id={`layer-${index}-activation`}
                    placeholder="Activation function"
                    label="Activation function"
                    value={conv2d.config.activation as string}
                    options={Activations}
                    onValueChange={onActivationChange}
                    disabled={disabled}
                />

            </div>
        </div>
    </BaseLayer>
}


/**
 * Not setting stride, TF defaults stride to pool size
 */
export function MaxPooling2D({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { setSelected, onLayerChange, disabled } = React.useContext(LayerContext);
    const maxpooling2d = project_config.model.layers[index];
    const pool_size = Number(maxpooling2d.config.poolSize);
    const padding = String(maxpooling2d.config.padding);

    const onPoolSizeChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_pool_size = Number(event.target.value);

        if (Number.isNaN(new_pool_size)) {
            return;
        }

        if (event.target.value == "" || new_pool_size <= 0) {
            new_pool_size = -9000;
        }

        maxpooling2d.config.poolSize = new_pool_size;
        onLayerChange();
    }


    const onPaddingChange = (value: string) => {
        maxpooling2d.config.padding = value;
        onLayerChange();
    }


    return <BaseLayer {...rest} index={index} label="Max Pooling 2D">
        <div className="flex grow gap-1">
            <Input
                id={`layer-${index}-pool-size`}
                placeholder="Pool size"
                className="basis-0! grow! shrink-0!"
                value={pool_size != -9000 ? pool_size : ""}
                onChange={onPoolSizeChange}
                disabled={disabled}
            />


            <SelectField
                id={`layer-${index}-padding`}
                onClick={() => setSelected(index)}
                className="basis-0 grow"
                placeholder="Padding type"
                label="Padding type"
                value={padding}
                options={{
                    [Padding.VALID]: "Valid padding",
                    [Padding.SAME]: "Same padding"
                }}
                onValueChange={onPaddingChange}
                disabled={disabled}
            />
        </div>
    </BaseLayer>
}


export function AveragePooling2D({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { setSelected, onLayerChange, disabled } = React.useContext(LayerContext);
    const averagepooling2d = project_config.model.layers[index];
    const pool_size = Number(averagepooling2d.config.poolSize);
    const padding = averagepooling2d.config.padding;

    const onPoolSizeChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_pool_size = Number(event.target.value);

        if (Number.isNaN(new_pool_size)) {
            return;
        }

        if (event.target.value == "" || new_pool_size <= 0) {
            new_pool_size = -9000;
        }

        averagepooling2d.config.poolSize = new_pool_size;
        onLayerChange();
    }


    const onPaddingChange = (value: string) => {
        averagepooling2d.config.padding = value;
        onLayerChange();
    }


    return <BaseLayer {...rest} index={index} label="Average Pooling 2D">
        <div className="flex grow">
            <div className="grid grid-cols-12 lg:flex gap-1 md:grow">

                <div className="col-span-6 basis-0 grow">
                    <Input
                        id={`layer-${index}-pool-size`}
                        placeholder="Pool size"
                        value={pool_size != -9000 ? pool_size : ""}
                        disabled={disabled}
                        onChange={onPoolSizeChange}
                    />
                </div>


                <div className="col-span-6 basis-0 grow">
                    <SelectField
                        id={`layer-${index}-padding`}
                        onClick={() => setSelected(index)}
                        placeholder="Padding type"
                        label="Padding type"
                        value={padding as string}
                        options={{
                            [Padding.VALID]: "Valid padding",
                            [Padding.SAME]: "Same padding"
                        }}
                        onValueChange={onPaddingChange}
                        disabled={disabled}
                    />
                </div>

            </div>
        </div>
    </BaseLayer>
}


export function TokenAndPositionalEmbeddingLayer({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { onLayerChange, disabled } = React.useContext(LayerContext);

    const sinusoidal = project_config.model.layers[index];
    const embed_dim = sinusoidal.config.embedDim;

    const onEmbeddingLengthChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_value = Number(event.target.value);

        if (Number.isNaN(new_value)) {
            return;
        }

        if (event.target.value == "" || new_value <= 0) {
            new_value = -9000;
        }

        sinusoidal.config.embedDim = new_value;
        onLayerChange();
    }

    return <BaseLayer {...rest} index={index} label="Sinusoidal Embedding">
        <Input
            id={`layer-${index}-embed-size`}
            className="w-full"
            placeholder="Embedding length"
            value={(embed_dim != -9000 ? embed_dim : "").toString()}
            onChange={onEmbeddingLengthChange}
            disabled={disabled}
        />
    </BaseLayer>
}


export function TransformerEncoderLayer({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { onLayerChange, disabled } = React.useContext(LayerContext);

    const encoder = project_config.model.layers[index];

    const display_heads = (encoder.config.numHeads != -9000 ? encoder.config.numHeads : "") as string;
    const display_embedding = (encoder.config.embedDim != -9000 ? encoder.config.embedDim : "") as string;

    const onHeadsChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_heads = Number(event.target.value);

        if (Number.isNaN(new_heads) || new_heads == Number.POSITIVE_INFINITY) {
            return;
        }

        if (event.target.value == "" || new_heads <= 0) {
            new_heads = -9000;
        }

        encoder.config.numHeads = new_heads;
        onLayerChange();
        return;
    }


    const onEmbedDimChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_embed = Number(event.target.value);

        if (Number.isNaN(new_embed) || new_embed == Number.POSITIVE_INFINITY) {
            return;
        }

        if (event.target.value == "" || new_embed <= 0) {
            new_embed = -9000;
        }

        encoder.config.embedDim = new_embed;
        onLayerChange();
        return;
    }


    return <BaseLayer index={index} label="Transformer Encoder">
        <div className="flex grow gap-1">
            <Input
                id={`layer-${index}-heads`}
                placeholder="Heads"
                value={display_heads}
                title="Number of heads"
                onChange={onHeadsChange}
                disabled={disabled}
            />

            <Input
                id={`layer-${index}-embed-size`}
                placeholder="Embedding length" value={display_embedding}
                title="Embedding length"
                onChange={onEmbedDimChange}
                disabled={disabled}
            />
        </div>
    </BaseLayer>
}


export function TransformerDecoderLayer({ index, ...rest }: LayerArgs) {
    const { project_config } = React.useContext(ProjectContext);
    const { onLayerChange, disabled } = React.useContext(LayerContext);

    const decoder = project_config.model.layers[index];

    const display_heads = (decoder.config.numHeads != -9000 ? decoder.config.numHeads : "") as string;
    const display_embedding = (decoder.config.embedDim != -9000 ? decoder.config.embedDim : "") as string;

    const onHeadsChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_heads = Number(event.target.value);

        if (Number.isNaN(new_heads) || new_heads == Number.POSITIVE_INFINITY) {
            return;
        }

        if (event.target.value == "" || new_heads <= 0) {
            new_heads = -9000;
        }

        decoder.config.numHeads = new_heads;
        onLayerChange();
        return;
    }


    const onEmbedDimChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let new_embed = Number(event.target.value);

        if (Number.isNaN(new_embed) || new_embed == Number.POSITIVE_INFINITY) {
            return;
        }

        if (event.target.value == "" || new_embed <= 0) {
            new_embed = -9000;
        }

        decoder.config.embedDim = new_embed;
        onLayerChange();
        return;
    }


    return <BaseLayer index={index} label="Transformer Decoder">
        <div className="flex grow gap-1">
            <Input
                id={`layer-${index}-heads`}
                placeholder="Number of heads" value={display_heads}
                title="Number of heads"
                onChange={onHeadsChange}
                disabled={disabled}
            />

            <Input
                id={`layer-${index}-embed-size`}
                placeholder="Embedding length"
                value={display_embedding}
                title="Embedding length"
                onChange={onEmbedDimChange}
                disabled={disabled}
            />
        </div>
    </BaseLayer>
}
