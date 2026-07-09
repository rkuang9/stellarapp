import { ModelInputShape } from "@/lib/data-processing/base_config";
import { Activation } from "@/types/hyperparameters";

export interface LayerConfig {
    id: string;
    identifier: string;
    label: string;
    input_rank: number; // batched input rank
    output_rank: number; // batched output rank
    auto?: boolean;
    config: { [key: string]: number | string | boolean | number[] };
}


export function dense(id: string): LayerConfig {
    return {
        id,
        identifier: "dense",
        label: "Dense",
        input_rank: 2,
        output_rank: 2,
        config: { units: -9000, activation: Activation.RELU, useBias: true }
    }
}


export function dropout(id: string): LayerConfig {
    return {
        id,
        identifier: "dropout",
        label: "Dropout",
        input_rank: -1,
        output_rank: -1,
        config: { rate: 0.1 },
    }
}


export function flatten(id: string): LayerConfig {
    return {
        id,
        identifier: "flatten",
        label: "Flatten",
        input_rank: -1,
        output_rank: 2,
        config: { dataFormat: "channelsLast" },
    }
}


export function batchNormalization(id: string): LayerConfig {
    return {
        id,
        identifier: "batchNormalization",
        label: "Batch Normalization",
        input_rank: -1,
        output_rank: -1,
        config: { axis: -1, momentum: 0.99, epsilon: 0.001, center: true, scale: true },
    }
}


export function layerNormalization(id: string): LayerConfig {
    return {
        id,
        identifier: "layerNormalization",
        label: "Layer Normalization",
        input_rank: -1,
        output_rank: -1,
        config: { axis: -1, epsilon: 0.001, center: true, scale: true },
    }
}


export function embedding(id: string): LayerConfig {
    return {
        id,
        identifier: "embedding",
        label: "Embedding",
        input_rank: 2,
        output_rank: 3,
        config: { inputDim: 20_000, outputDim: 32 },
        auto: true
    }
}


export function lstm(id: string): LayerConfig {
    return {
        id,
        identifier: "lstm",
        label: "LSTM",
        input_rank: 3,
        output_rank: 2,
        config: { units: -9000, returnSequences: false },
    }
}


export function gru(id: string): LayerConfig {
    return {
        id,
        identifier: "gru",
        label: "GRU",
        input_rank: 3,
        output_rank: 2,
        config: { units: -9000, returnSequences: false },
    }
}


export function conv2d(id: string): LayerConfig {
    return {
        id,
        identifier: "conv2d",
        label: "Convolution 2D",
        input_rank: 4,
        output_rank: 4,
        config: { filters: -9000, kernelSize: -9000, padding: "valid", activation: Activation.RELU },
    }
}


export function maxPooling2d(id: string): LayerConfig {
    return {
        id,
        identifier: "maxPooling2d",
        label: "Max Pooling 2D",
        input_rank: 4,
        output_rank: 4,
        config: { poolSize: 2, padding: "valid" },
    }
}


export function averagePooling2d(id: string): LayerConfig {
    return {
        id,
        identifier: "averagePooling2d",
        label: "Average Pooling 2D",
        input_rank: 4,
        output_rank: 4,
        config: { poolSize: 2, padding: "valid" },
    }
}


export function globalAveragePooling1d(id: string): LayerConfig {
    return {
        id,
        identifier: "globalAveragePooling1d",
        label: "Global Average Pooling 1D",
        input_rank: 3,
        output_rank: 2,
        config: { dataFormat: "channels_last" },
    }
}


export function globalMaxPooling1d(id: string): LayerConfig {
    return {
        id,
        identifier: "globalMaxPooling1d",
        label: "Global Max Pooling 1D",
        input_rank: 3,
        output_rank: 2,
        config: { dataFormat: "channels_last" },
    }
}


export function transformerEncoder(id: string): LayerConfig {
    return {
        id,
        identifier: "transformerEncoder",
        label: "Transformer Encoder",
        input_rank: 3,
        output_rank: 3,
        config: { numHeads: -9000, embedDim: -9000, }
    }
}


export function transformerDecoder(id: string): LayerConfig {
    return {
        id,
        identifier: "transformerDecoder",
        label: "Transformer Decoder",
        input_rank: 3,
        output_rank: 3,
        config: { numHeads: -9000, embedDim: -9000 }
    }
}


export function tokenAndPositionalEmbedding(id: string): LayerConfig {
    return {
        id,
        identifier: "tokenAndPositionalEmbedding",
        label: "Sine Positional Embedding",
        input_rank: 2,
        output_rank: 3,
        config: { embedDim: -9000, vocabularySize: 20_000, maxSequenceLength: 64 },
        auto: true
    }
}


export function gpt2DecoderBlock(id: string): LayerConfig {
    return {
        id,
        identifier: "gpt2DecoderBlock",
        label: "GPT2 Decoder Block",
        input_rank: 3,
        output_rank: 3,
        config: { numHeads: -9000, embedDim: -9000 }
    }
}


export function getLayer(identifier: string, uid: string) {
    const layers: { [key: string]: LayerConfig } = {
        "dense": dense(uid),
        "dropout": dropout(uid),
        "flatten": flatten(uid),
        "batchNormalization": batchNormalization(uid),
        "layerNormalization": layerNormalization(uid),
        "embedding": embedding(uid),
        "lstm": lstm(uid),
        "gru": gru(uid),
        "globalAveragePooling1d": globalAveragePooling1d(uid),
        "globalMaxPooling1d": globalMaxPooling1d(uid),
        "conv2d": conv2d(uid),
        "maxPooling2d": maxPooling2d(uid),
        "averagePooling2d": averagePooling2d(uid),
        "transformerEncoder": transformerEncoder(uid),
        "transformerDecoder": transformerDecoder(uid),
        "tokenAndPositionalEmbedding": tokenAndPositionalEmbedding(uid),
        "gpt2DecoderBlock": gpt2DecoderBlock(uid),
    };

    const layer = layers[identifier];

    if (!layer) {
        throw new Error(`Layer ${identifier} is undefined`);
    }

    layer.id = uid;

    return layer;
}


export enum Padding {
    SAME = "same",
    VALID = "valid"
}


/**
 * Checks that the current layer is compatible with the previous layer. If
 * previous layer is not specified, current layer is the first layer. All layers
 * should have their ranks updated prior to this function call.
 * 
 * @param current   the current layer
 * @param prev      the layer prior to current or the unbatched input shape if current is the first layer
 * @param input_shape   the unbatched input shape
 * @returns         boolean for compatibility and the reason if not compatible
 */
export function compatibleWithPrevLayer(current: LayerConfig, prev: LayerConfig | null, input_shape: ModelInputShape): {
    compatible: boolean;
    reason: string
} {
    if ((current.identifier == "embedding" || current.identifier == "tokenAndPositionalEmbedding") && prev) {
        return { compatible: false, reason: `The ${current.label.toLowerCase()} layer must be the first layer of the neural network.` }
    }

    // checks on when the model only has one layer
    if (!prev) {
        if (current.input_rank == -1 && current.identifier == "flatten" && input_shape.length < 3) {
            // for the flatten layer as input case
            return {
                compatible: false,
                reason: `This layer requires that the dataset be` +
                    ` 2 or 3 dimensional (e.g. time series data or images).` +
                    ` The dataset is currently 1 dimensional (tabular data).`
            };
        } else if (current.input_rank != input_shape.length + 1) {
            return {
                compatible: false,
                reason: input_shape.length == 0
                    ? `Unable to validate this input layer because the dataset is missing or no input data was selected.`
                    : `This input layer is not compatible with the dataset.`
            }
        }
        return { compatible: true, reason: "" };
    }

    if (prev.output_rank != current.input_rank) {
        return {
            compatible: false,
            reason: `The previous layer outputs a rank ${prev.output_rank} tensor,` +
                ` this layer expects a rank ${(current.identifier == "flatten" ? "3 or higher" : current.input_rank)} tensor.`

        }
    }

    return { compatible: true, reason: "" }
}


/**
 * Update the input/output ranks of a stack of layers
 * 
 * @param layers the list of layers
 * @param input_shape the model's unbatched input shape
 */
export function updateLayerRank(layers: LayerConfig[], input_shape: ModelInputShape): void {
    const model_input_rank = input_shape.length != 0 ? input_shape.length + 1 : -1;

    for (let i = 0; i < layers.length; i++) {
        // get the default input/output ranks
        const base = getLayer(layers[i].identifier, "");
        const current_layer = layers[i];

        if (base.output_rank == -1) {
            // -1 means dynamic, e.g. Dropout input and output matches the previous layer
            current_layer.output_rank = i > 0 ? layers[i - 1].output_rank : model_input_rank;
        }

        if (base.input_rank == -1) {
            if (base.identifier == "flatten" && (i == 0 || layers[i - 1].output_rank < 3)) {
                continue;
            } else {
                current_layer.input_rank = i > 0 ? layers[i - 1].output_rank : model_input_rank;
            }
        }
    }
}
