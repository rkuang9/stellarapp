/**
 * A list of supported finetune datasets, their path and relevant keys
 */
export const FinetuneDatasets = {
    "alpaca-cleaned": {
        path: "/finetune/alpaca-cleaned.json",
        fields: ["instruction", "input", "output"]
    },
    "databricks-dolly-15k": {
        path: "/finetune/databricks-dolly-15k.json",
        fields: ["instruction", "context", "response"]
    },
}


export type FinetuneDataset = keyof typeof FinetuneDatasets;


// the tokenizer names should be acceptable by the Huggingface's AutoTokenizer.from_pretrained
export const Tokenizers = {
    "HuggingFaceTB/SmolLM2-1.7B-Instruct": {
        label: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
        vocab_size: 49_152,
        "bos_token": "<|im_start|>",
        "bos_token_id": 1,
        "eos_token": "<|im_end|>",
        "eos_token_id": 2,
        "pad_token": "<|im_end|>", // same as eos
        "pad_token_id": 2,
        "prompt_mask": {
            "assistant_start": [1, 520, 9531], // ["<|im_start|>", "ass", "istant"]
            "assistant_end": 2
        }
    },
    "mistralai/Mixtral-8x7B-Instruct-v0.1": {
        label: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        vocab_size: 32_000,
        "bos_token": "<s>",
        "bos_token_id": 1,
        "eos_token": "</s>",
        "eos_token_id": 2,
        "pad_token": null,
        "pad_token_id": null,
        "prompt_mask": {
            "assistant_start": [733, 28748, 16289, 28793], // ["[", "/", "INST", "]"]
            "assistant_end": 2,
        }
    },
    "Qwen/Qwen3-4B-Instruct-2507": {
        label: "Qwen/Qwen3-4B-Instruct-2507",
        vocab_size: 151_669,
        // https://huggingface.co/Qwen/Qwen2-7B-Instruct/discussions/15#66bc689abcf136906383c8c5
        "bos_token": null, // use <|endoftext|> 151643
        "bos_token_id": null, // use <|endoftext|> 151643
        "eos_token": "<|im_end|>",
        "eos_token_id": 151_645,
        "pad_token": "<|endoftext|>",
        "pad_token_id": 151_643,
        "prompt_mask": {
            "assistant_start": [151644, 77091], // ["<|im_start|>", "assistant"]
            "assistant_end": 151645,
        }
    },
    "microsoft/Phi-3.5-mini-instruct": {
        label: "microsoft/Phi-3.5-mini-instruct",
        vocab_size: 32_011,
        "bos_token": "<s>",
        "bos_token_id": 1,
        "eos_token": "<|endoftext|>",
        "eos_token_id": 32000,
        "pad_token": "<|endoftext|>",
        "pad_token_id": 32000,
        "prompt_mask": {
            "assistant_start": [32001], // ["<|assistant|>"]
            "assistant_end": 32007 // <|end|>
        }
    }
} as const satisfies Record<string, {
    label: string;
    vocab_size: number;
    bos_token: string | null;
    bos_token_id: number | null;
    eos_token: string;
    eos_token_id: number;
    pad_token: string | null;
    pad_token_id: number | null;
    prompt_mask: {
        assistant_start: number[];
        assistant_end: number;
    };
}>


export type Tokenizer = keyof typeof Tokenizers;
