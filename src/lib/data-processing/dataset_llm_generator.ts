import * as tf from "@tensorflow/tfjs";
import { DatasetGenerator } from "@/lib/data-processing/dataset_base_generator";
import { DATASET_TOKENIZED_CACHE_NAME, getFromCacheStorage, TrainingSample } from "@/lib/data-processing/tokenization_pipeline";
import * as tfs from "@stellarapp/tfjs-stellar";


/**
 * This class expects datasets in tokenized form.
 * 
 * @param urls   the URLs of the tokenized datasets residing in CacheStorage
 * @param shuffle   shuffle the URL order (not samples within each dataset)
 */
export class LlmDatasetGenerator extends DatasetGenerator {

    protected urls: string[];
    protected cache_name: string;


    constructor({
        urls, cacheName: cache_name = DATASET_TOKENIZED_CACHE_NAME
    }: { urls: string[], cacheName?: string }) {
        // do not shuffle else the actual sample count might not match the
        // calculated sample count (due to sample packing)
        super({ shuffle: false });
        this.urls = urls;
        this.cache_name = cache_name;
    }


    public skip(size: number): DatasetGenerator {
        throw Error("DatasetLlmGenerator: skip() is not supported")
    }


    public take(size: number): DatasetGenerator {
        throw Error("DatasetLlmGenerator: take() is not supported")
    }


    public override async generator(mode: "pretraining" | "finetuning", sequence_length: number, stride: number, tokenizer_name: string) {
        await this.verify(this.cache_name, tokenizer_name);

        const urls = this.urls;
        const cache_name = this.cache_name;

        return async function* () {
            for (const url of urls) {
                const cached_dataset = (await getFromCacheStorage(cache_name, url))!;

                const dataset: TrainingSample[] = await cached_dataset.json();

                yield* llmDatasetGenerator(dataset, mode, sequence_length, stride, false);
            }
        }
    }


    /**
     * Check that the cached dataset headers for tokenization and file type
     */
    protected async verify(cache_name: string, tokenizer_name: string) {
        for (const url of this.urls) {
            const dataset = await getFromCacheStorage(cache_name, url);

            if (!dataset) {
                throw Error(`LlmDatasetGenerator: a tokenized dataset was not found for ${url}`);
            }

            const content_type = dataset.headers.get("content-type");

            if (content_type !== "application/json") {
                throw Error(`LlmDatasetGenerator: unsupported dataset type "${content_type}", expected "application/json": ${url}`)
            }

            if (dataset.headers.get("tokenized") !== "true") {
                throw Error(`LlmDatasetGenerator: dataset has not been tokenized yet: ${url}`);
            }

            if (dataset.headers.get("tokenizer") !== tokenizer_name) {
                throw Error(`LlmDatasetGenerator: dataset was tokenized with ${dataset.headers.get("tokenizer_name")} instead of ${tokenizer_name}: ${url}`);
            }
        }
    }


    public get length(): number | undefined {
        throw new Error("LlmDatasetGenerator.length: use size() instead.");
    }


    /**
     * Calculates the number of training samples that can be generated from the datasets.
     * Uses the formula `[(total_length - seq_len - 1) / stride] + 1` to calculate
     * how many samples can be created from each row (subtract by 1 due to labels being
     * shifted 1 over).
     */
    public async size(sequence_length: number, stride: number, tokenizer_name: string): Promise<number> {
        await this.verify(this.cache_name, tokenizer_name);

        const urls = this.urls;

        let total_samples = 0;

        for (const url of urls) {
            const cached_dataset = (await getFromCacheStorage(this.cache_name, url))!;
            const dataset: TrainingSample[] = await cached_dataset.json();

            total_samples += getSamplesCount(dataset, sequence_length, stride);
        }

        return total_samples;
    }
}


/**
 * Calculates the total number of training sample that will be generated from
 * a dataset by slidingWindowTrainingSamples()
 */
export function getSamplesCount(
    dataset: TrainingSample[],
    sequence_length: number,
    stride: number): number {

    const sample_min_length = sequence_length + 1; // +1 for labels shifting // + stride
    let total_samples = 0;

    let packed_size = 0; // track size of packed samples

    for (let i = 0; i < dataset.length; i++) {
        const tokens_length = dataset[i].tokens.length;

        if (tokens_length < sample_min_length) {
            // pack tokens
            packed_size += tokens_length;

            if (packed_size < sample_min_length) {
                continue; // keep packing
            } else {
                total_samples += Math.floor((packed_size - sequence_length - 1) / stride) + 1;

                // left over tokens that the sliding window cannot fully cover are not used
                packed_size = 0;
            }
        } else {
            // dataset row is long enough, don't need to pack it
            total_samples += Math.floor((tokens_length - sequence_length - 1) / stride) + 1;
        }
    }

    return total_samples;
}


/**
 * A generator function that yields tensors used in LLM training. If a sample is
 * shorter than the specified `sequence_length`, it is packed with other short
 * samples until its length exceeds the desired `sequence_length`.
 * 
 * The following tensors are yielded:
 * - xs, the sample, aka input
 * - ys, the label, aka target
 * - loss_mask, masks the non-assistant tokens
 * - packing_mask, prevent cross document contamination for packed samples
*/
export function* llmDatasetGenerator(
    dataset: TrainingSample[],
    mode: "pretraining" | "finetuning",
    sequence_length: number,
    stride: number,
    shuffle: boolean) {

    const sample_min_length = sequence_length + 1; // +1 for labels shifting // + stride

    // for now we assume pretraining documents are much longer than the
    // sequence length and do not need packing
    const use_masks = mode == "finetuning";

    let packed_tokens = new Int32Array(sample_min_length);
    let packing_loss_mask = new Uint8Array(sample_min_length);
    let packing_attn_mask = new Int32Array(sample_min_length);

    // when packing, make sure the packing buffer is big enough to include the
    // next sample, grow by doubling its size
    const ensurePackedBufferSize = (required_size: number) => {
        if (required_size <= packed_tokens.length) {
            return;
        }

        // double the buffer size until it's big enough
        let new_buffer_size = Math.max(1, packed_tokens.length);

        while (new_buffer_size < required_size) {
            new_buffer_size *= 2;
        }

        // copy old token and mask buffers into the newly resized ones
        const new_token_buffer = new Int32Array(new_buffer_size);
        new_token_buffer.set(packed_tokens, 0);
        packed_tokens = new_token_buffer;

        const new_loss_mask_buffer = new Uint8Array(new_buffer_size);
        new_loss_mask_buffer.set(packing_loss_mask, 0);
        packing_loss_mask = new_loss_mask_buffer;

        const new_attn_pack_mask_buffer = new Int32Array(new_buffer_size);
        new_attn_pack_mask_buffer.set(packing_attn_mask, 0);
        packing_attn_mask = new_attn_pack_mask_buffer;
    }


    // keeping track of packed tokens size, it is always at the end
    // of the current set of packed tokens
    let packed_size = 0;

    if (shuffle) {
        DatasetGenerator.shuffle(dataset);
    }

    for (let i = 0; i < dataset.length; i++) {
        const sample = dataset[i];

        const tokens = new Int32Array(sample.tokens);

        const loss_mask = sample.prompt_mask
            ? Uint8Array.from(sample.prompt_mask)
            : undefined;

        if (mode == "finetuning" && !loss_mask) {
            throw Error(`datasetGenerator: loss mask missing`);
        }

        ensurePackedBufferSize(packed_size + tokens.length);

        if (tokens.length < sample_min_length) {
            // an array of zeroes, the first element is marked 1 to denote the start
            // of a new sequence within the packing
            const packing_mask = new Int32Array(tokens.length);
            packing_mask[0] = 1;

            packing_attn_mask.set(packing_mask, packed_size);

            // packing route, runs only for samples that are too short
            packed_tokens.set(tokens, packed_size);

            if (loss_mask) {
                packing_loss_mask.set(loss_mask, packed_size);
            }

            packed_size += tokens.length;

            if (packed_size < sample_min_length) {
                // keep packing until the buffer meets the minimum size
                continue;
            } else {
                yield* slidingWindowTrainingSamples(
                    packed_tokens.subarray(0, packed_size),
                    use_masks ? packing_loss_mask.subarray(0, packed_size) : undefined,
                    use_masks ? packing_attn_mask.subarray(0, packed_size) : undefined,
                    sequence_length,
                    stride);

                // if stride != 1, left over tokens that the sliding window
                // cannot fully cover are not used
                packed_size = 0;
            }
        } else {
            // non-packing route
            yield* slidingWindowTrainingSamples(tokens, loss_mask, undefined, sequence_length, stride);
        }
    }

}


/**
 * Create tensors out of tokens (via sliding window, baesd on a stride)
 * and their accompanying mask
 */
function* slidingWindowTrainingSamples(
    tokens: Int32Array,
    loss_mask: Uint8Array | undefined,
    packing_mask: Int32Array | undefined,
    sequence_length: number,
    stride: number) {

    const window_end = tokens.length - sequence_length;

    for (let window_start = 0; window_start < window_end; window_start += stride) {
        const end = window_start + sequence_length;

        // do not include any NaN values or they will NaN the whole model
        const inputs = {
            xs: tf.tensor1d(tokens.subarray(window_start, end), "float32"),
            ys: tf.tensor1d(tokens.subarray(window_start + 1, end + 1), "float32"),
            loss_mask: loss_mask
                ? tf.tensor1d(loss_mask.subarray(window_start + 1, end + 1), "float32")
                : tf.ones([sequence_length]),
            packing_mask: packing_mask
                ? tfs.masks.packing(packing_mask.subarray(window_start, end))
                : tf.zeros([1, sequence_length, sequence_length])
        }

        yield inputs;
    }
}
