import BaseConfig, { DeepPartial } from "@/lib/data-processing/base_config";
import { Tokenizer } from "@/lib/data-processing/nlp_sources";


export interface LLMPreprocessingArgs {
    /**
     * The length of each training sample.
     */
    sequence_length: number;
    /**
     * The amount of overlap in training samples. The stride is a fraction of the sequence length.
     * Use `0.0` for `stride=1` (maximum overlap) and `1.0` for `stride=sequence_length` (minimal overlap).
     * Use default rounding if `sequence_length * stride` is not an integer.
     */
    pretraining_stride: number;
    /**
     * Same as `pretraining_stride` but for the finetuning datasets
     */
    finetuning_stride: number;
    /**
     * The Huggingfce finetuning dataset URL and its files and features
     */
    finetuning_datasets: { [url: string]: { files: string[], features: FinetuneFeatureArgs } };
    /**
     * The Huggingface pretraining dataset URL or Wikipedia article URL
     */
    pretraining_datasets: { [url: string]: { files: string[], features: PretrainFeatureArgs } | null };
    /**
     * The official Huggingface tokenizer name.
     */
    tokenizer: Tokenizer | null;
    /**
     * The tokenizer vocabulary size, also serves as the embedding layer depth and the softmax output size.
     */
    vocab_size: number;
    /**
     * The number of heads used in the attention layers.
     */
    num_heads: number;
    /**
     * The number of transformer decoder blocks used in the model.
     */
    num_layers: number;
    /**
     * The token embedding size (hidden size).
     */
    embed_dim: number;
    /**
     * The type of model (for now, gpt-like is just original transformer decoder but LayerNorm-first + original RoPE).
     */
    model_type: string | "gpt-like";
}


export type FinetuneFeatureArgs = { system: string[], user: string[], assistant: string[] };
export type PretrainFeatureArgs = string[][];

export class LLMConfig extends BaseConfig {

    public preprocessing: LLMPreprocessingArgs = {
        pretraining_stride: 1,
        finetuning_stride: 0.5,
        finetuning_datasets: {},
        pretraining_datasets: {},
        tokenizer: null,
        vocab_size: 0,
        num_heads: 4,
        num_layers: 2,
        sequence_length: 64,
        embed_dim: 32,
        model_type: "gpt-like"
    }


    constructor({ load }: { load?: DeepPartial<LLMConfig> } = {}) {
        super();

        if (load) {
            super.load(load);
        }
    }
}
