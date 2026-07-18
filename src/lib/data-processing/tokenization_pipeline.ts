import { SupportedMimeTypes } from "@/lib/data-processing/huggingface_datasets";
import { FinetuneFeatureArgs, PretrainFeatureArgs } from "@/lib/data-processing/llm_config";
import { Tokenizer, Tokenizers } from "@/lib/data-processing/nlp_sources";
import { AutoTokenizer, PreTrainedTokenizer } from "@huggingface/transformers";
import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";


export const DATASET_CACHE_NAME = "stellar-datasets";
export const DATASET_TOKENIZED_CACHE_NAME = `${DATASET_CACHE_NAME}-tokenized`;


interface TokenizeOptions {
    /**
     * Name of CacheStorage containing the untokenized dataset, default to `DATASET_CACHE_NAME`
     */
    cacheNameOrigin?: string;
    /**
     * Name of CacheStorage to save the tokenized dataset to, default to `DATASET_TOKENIZED_CACHE_NAME`
     */
    cacheNameTarget?: string;
    /**
     * Include a binary mask with the tokens. All assistant tokens are marked `1`,
     * including the assistant end token but excluding the assistant start tokens.
     * All other tokens are marked `0` (not `-100` like in PyTorch because TFJS
     * doesn't support this). Defaults to `true`.
     */
    maskPrompt?: boolean;
}


export interface TrainingSample {
    tokens: number[];
    prompt_mask: number[] | null;
}


type ChatRole = "user" | "assistant" | "system" | (string & {});
type ChatFormat = { role: ChatRole, content: string }[]

function formatChatTurn(role: ChatRole, content: string) {
    return { role, content }
}


export async function tokenize(tokenizer_name: Tokenizer, features: PretrainFeatureArgs | FinetuneFeatureArgs, url: string, options?: TokenizeOptions) {
    const tokenizer = await AutoTokenizer.from_pretrained(tokenizer_name);

    const {
        cacheNameOrigin: cache_name_origin = DATASET_CACHE_NAME,
        cacheNameTarget: cache_name_target = DATASET_TOKENIZED_CACHE_NAME,
        maskPrompt: mask_prompt = true,
    } = options ?? {};

    const check = await getFromCacheStorage(cache_name_target, url);

    if (check &&
        check.headers.get("tokenized") === "true" &&
        check.headers.get("tokenizer") == tokenizer_name) {
        // already tokenized
        return;
    }

    const dataset = await getFromCacheStorage(cache_name_origin, url);

    if (!dataset) {
        throw Error(`Dataset not found in CacheStorage for ${url}`);
    }

    const headers = Object.fromEntries(dataset.headers.entries());
    const { "content-type": mime_type } = headers;

    if (!Object.values(SupportedMimeTypes).includes(mime_type)) {
        throw Error(`Unsupported format (${mime_type}) for dataset ${url}`);
    }

    let tokens: TrainingSample[] = [];

    const prompt_mask_args = mask_prompt ? {
        assistant_start_tokens: Tokenizers[tokenizer_name].prompt_mask.assistant_start,
        assistant_end_token: Tokenizers[tokenizer_name].prompt_mask.assistant_end
    } : undefined;

    if (mime_type == "text/plain") {
        // plain text is pretrain only
        tokens = tokenizePretrainText(tokenizer, await dataset.text());
    } else if (mime_type == "application/json") {
        tokens = Array.isArray(features)
            ? tokenizePretrainJson(tokenizer, await dataset.json(), features)
            : tokenizeFinetuneJsonArray(tokenizer, await dataset.json(), features, prompt_mask_args)
    } else if (mime_type == "application/jsonl") {
        tokens = Array.isArray(features)
            ? tokenizePretrainJsonLines(tokenizer, await dataset.text(), features)
            : tokenizeFinetuneJsonLines(tokenizer, await dataset.text(), features, prompt_mask_args);
    } else if (mime_type == "application/vnd.apache.parquet") {
        tokens = Array.isArray(features)
            ? await tokenizePretrainParquet(tokenizer, await dataset.arrayBuffer(), features)
            : await tokenizeFinetuneParquet(tokenizer, await dataset.arrayBuffer(), features, prompt_mask_args)
    } else {
        throw Error(`Unsupported format (${mime_type}) for dataset ${url}`);
    }

    await saveToCacheStorage(
        cache_name_target, url, new Response(JSON.stringify(tokens), {
            headers: {
                ...headers,
                "content-type": "application/json",
                tokenized: "true",
                tokenizer: tokenizer_name as string,
                token_count: String(tokens.reduce((running_sum, current) => running_sum + current.tokens.length, 0))
            }
        }));
}


export async function getTokenizedDataset(url: string, cache_name: string = DATASET_TOKENIZED_CACHE_NAME) {
    const dataset = await getFromCacheStorage(cache_name, url);

    if (!dataset) {
        throw Error(`Dataset not found in CacheStorage for ${url}`);
    }

    if (dataset.headers.get("tokenized") != "true") {
        throw Error(`Dataset has not been tokenized yet for ${url}`);
    }
}


export function tokenizePretrainJson(tokenizer: PreTrainedTokenizer, json: any, features: string[][]) {
    for (let feature of features) {
        if (feature.at(0) == "default") {
            feature = feature.slice(1);
        }
    }

    const tokenized: TrainingSample[] = [];

    for (const row of json) {
        if (!row) {
            continue;
        }

        for (const feature of features) {
            tokenized.push({
                tokens: tokenizer.encode(getNestedJsonValue(row, feature)),
                prompt_mask: null
            });
        }
    }

    return tokenized;
}


export function tokenizePretrainJsonLines(tokenizer: PreTrainedTokenizer, text: string, features: string[][]) {
    for (let feature of features) {
        if (feature.at(0) == "default") {
            feature = feature.slice(1);
        }
    }

    const tokenized: TrainingSample[] = [];

    const jsonl = text.split("\n");

    for (const row of jsonl) {
        if (!row) {
            continue;
        }

        for (const feature of features) {
            tokenized.push({
                tokens: tokenizer.encode(getNestedJsonValue(JSON.parse(row), feature)),
                prompt_mask: null
            });
        }
    }

    return tokenized;
}


export async function tokenizePretrainParquet(
    tokenizer: PreTrainedTokenizer,
    parquet: ArrayBuffer,
    features: PretrainFeatureArgs
) {
    for (let feature of features) {
        if (feature.at(0) == "default") {
            feature = feature.slice(1);
        }
    }

    const tokenized: TrainingSample[] = [];
    const rows = await parquetReadObjects({ file: parquet, compressors });

    for (const row of rows) {
        if (!row) {
            continue;
        }

        for (const feature of features) {
            tokenized.push({
                tokens: tokenizer.encode(getNestedJsonValue(row, feature)),
                prompt_mask: null
            });
        }
    }

    return tokenized;
}


export function tokenizePretrainText(tokenizer: PreTrainedTokenizer, text: string): TrainingSample[] {
    return [{ tokens: tokenizer.encode(text), prompt_mask: null }];
}


/**
 * For a given tokenized sequence, generate a mask where tokens between
 * the designated start and end tokens are marked as 1 (kept), all else set to 0 (ignored).
 * 
 * This is typically used for loss masking to ignore the non-assistant tokens.
 * 
 * Example: `<|user|>hello<|end|><|assistant|>hi<|end|>`, all tokens but `hi<|end|>` are masked
 */
export function generatePromptMask(tokens: number[], assistant_start_tokens: number[], assistant_end_token: number) {
    if (assistant_start_tokens.length == 0) {
        throw Error("generatePromptMask: assistant tokens are not defined")
    }

    if (new Set(assistant_start_tokens).size != assistant_start_tokens.length) {
        throw Error("generatePromptMask: the assistant start tokens should be unique");
    }

    const mask: number[] = Array(tokens.length).fill(0);
    let is_assistant = false;

    // skip table defines how much we skip ahead on non-matches, if
    // the non-match occurs in the middle of the assistant tokens then
    // we skip do a partial skip ahead rather than a full skip
    const skip_table = new Map<number, number>();

    for (let i = 0; i < assistant_start_tokens.length - 1; i++) {
        // we only define partial skips for all assistant tokens except the last
        // because it and all other tokens are a full skip
        skip_table.set(assistant_start_tokens[i], assistant_start_tokens.length - i - 1);
    }

    const last_assistant_token = assistant_start_tokens.length - 1;
    const full_skip = assistant_start_tokens.length;

    for (let i = 0; i < tokens.length;) {
        let increment = 1;

        if (!is_assistant) {
            let match = true;

            // for a sub-array of the same size as assistant tokens, do a backwards
            // comparison with the assistant tokens and if no match, then do a skip
            for (let j = last_assistant_token; j >= 0; j--) {
                const current_index = i + j;

                if (current_index < tokens.length) { // tokens array bounds checking
                    if (tokens[current_index] != assistant_start_tokens[j]) {
                        match = false;
                        increment = skip_table.get(tokens[current_index]) ?? full_skip;
                        break;
                    }
                }
            }

            if (match) {
                // found the assistant marker token, the next tokens are unmasked
                is_assistant = true;
                // skip ahead of the assistant markers to the first repsonse token
                increment = full_skip;
            }
        } else {
            mask[i] = 1;

            if (tokens[i] == assistant_end_token) {
                is_assistant = false;
            }
        }

        i += increment;
    }

    return mask;
}


/**
 * Tokenizes a JSONL dataset. Expects the format [{...}, {...}, {...}], where
 * {...} is either a flat object structure or a role-content conversation array
 */
export function tokenizeFinetuneJsonArray(
    tokenizer: PreTrainedTokenizer,
    json_array: Record<string, any>[],
    features: FinetuneFeatureArgs,
    mask_prompt?: { assistant_start_tokens: number[], assistant_end_token: number }) {
    if (features.user.at(0) == "default") {
        features.user = features.user.slice(1);
    }

    if (features.assistant.at(0) == "default") {
        features.assistant = features.assistant.slice(1);
    }

    if (features.system.at(0) == "default") {
        features.system = features.system.slice(1);
    }

    const chat = json_array.map(json => {
        const tokens = features.user.length > 1
            ? tokenizeMultiTurnConversation(tokenizer, json, features.user, features.assistant)
            : tokenizeFinetuneSingleJsonRow(tokenizer, json, features.user, features.assistant, features.system) as number[];

        if (tokens.length == 0) {
            return null;
        }

        const result: TrainingSample = {
            tokens,
            prompt_mask: mask_prompt ? generatePromptMask(tokens, mask_prompt.assistant_start_tokens, mask_prompt.assistant_end_token) : null
        };

        return result;
    }).filter(tokens => tokens != null);

    return chat;
}


/**
 * Tokenizes a JSONL dataset. Expects the format {...}\n{...}\n....\n{...}, where
 * {...} is either a flat object structure or a role-content conversation array
 */
export function tokenizeFinetuneJsonLines(
    tokenizer: PreTrainedTokenizer,
    json_text: string,
    features: FinetuneFeatureArgs,
    mask_prompt?: { assistant_start_tokens: number[], assistant_end_token: number }
) {
    if (features.user.at(0) == "default") {
        features.user = features.user.slice(1);
    }

    if (features.assistant.at(0) == "default") {
        features.assistant = features.assistant.slice(1);
    }

    if (features.system.at(0) == "default") {
        features.system = features.system.slice(1);
    }

    const chat = json_text.trim().split("\n").map(row => {
        const tokens = features.user.length > 1
            ? tokenizeMultiTurnConversation(tokenizer, JSON.parse(row), features.user, features.assistant)
            : tokenizeFinetuneSingleJsonRow(tokenizer, JSON.parse(row), features.user, features.assistant, features.system) as number[];

        if (tokens.length == 0) {
            return null;
        }


        const result: TrainingSample = {
            tokens,
            prompt_mask: mask_prompt
                ? generatePromptMask(tokens, mask_prompt.assistant_start_tokens, mask_prompt.assistant_end_token)
                : null
        };

        return result;
    }).filter(tokens => tokens != null);

    return chat;
}


export async function tokenizeFinetuneParquet(
    tokenizer: PreTrainedTokenizer,
    parquet: ArrayBuffer,
    features: FinetuneFeatureArgs,
    mask_prompt?: { assistant_start_tokens: number[], assistant_end_token: number }
) {
    if (features.user.at(0) == "default") {
        features.user = features.user.slice(1);
    }

    if (features.assistant.at(0) == "default") {
        features.assistant = features.assistant.slice(1);
    }

    if (features.system.at(0) == "default") {
        features.system = features.system.slice(1);
    }

    const rows = await parquetReadObjects({ file: parquet, compressors });

    const chat = rows.map(row => {
        const tokens = features.user.length > 1
            ? tokenizeMultiTurnConversation(tokenizer, row, features.user, features.assistant)
            : tokenizeFinetuneSingleJsonRow(tokenizer, row, features.user, features.assistant, features.system) as number[];

        if (tokens.length == 0) {
            return null;
        }

        const result: TrainingSample = {
            tokens,
            prompt_mask: mask_prompt
                ? generatePromptMask(tokens, mask_prompt.assistant_start_tokens, mask_prompt.assistant_end_token)
                : null
        };

        return result;
    }).filter(tokens => tokens != null);

    return chat;
}


export function tokenizeFinetuneSingleJsonRow(tokenizer: PreTrainedTokenizer, json: Record<string, any>, user_path: string[], assistant_path: string[], system_path: string[]) {
    const chat: ChatFormat = [];

    if (system_path.length != 0) {
        chat.push(formatChatTurn("system", getNestedJsonValue(json, system_path)))
    }

    chat.push(formatChatTurn("user", getNestedJsonValue(json, user_path)));
    chat.push(formatChatTurn("assistant", getNestedJsonValue(json, assistant_path)));

    return tokenizer.apply_chat_template(chat, {
        tokenize: true, // perform tokenization
        return_tensor: false, // returns number[]
        return_dict: false // returns just tokens
    });
}


export async function getFromCacheStorage(cache_name: string, url: string) {
    return (await caches.open(cache_name)).match(url);
}


export async function saveToCacheStorage(cache_name: string, url: string, response: Response) {
    return (await caches.open(cache_name)).put(url, response);
}


type NestedObject = string | number | boolean | null | { [key: string]: NestedObject };


export function getNestedJsonValue(json: NestedObject, path: string[]) {
    let current = json;

    for (let i = 0; i < path.length; i++) {
        const key = path[i];

        if (current != null && typeof current === "object") {
            if (!(key in current) && i == 0) {
                continue;
            }

            current = current[key];
        } else {
            throw Error(`Tokenization: unexpected value found for the feature "${path.join(".")}": ${JSON.stringify(current)}`);
        }
    }

    if (current == null) {
        throw Error(`Tokenization: NULL value found for the feature ${path.join(".")}`);
    }

    return String(current);
}


/**
 * Tokenizes a JSON dataset row of the format. The row can be nested multiple layers,
 * but the role and content paths must end at an array { [key]: { [key]: { [key]: NestedObject | Array } } }
 */
export function tokenizeMultiTurnConversation(tokenizer: PreTrainedTokenizer, json_row: Record<string, any>, role_path: string[], content_path: string[]): number[] {
    if (role_path.length < 2 || content_path.length < 2) {
        throw Error(`Tokenization: expected the multi-turn conversation's user, assistant, and system (if used) feature paths to` +
            ` be greater than 2, got ${role_path.join(".")}, ${content_path.join(".")}`);
    }

    if (role_path.length != content_path.length) {
        throw Error(`Tokenization: expected the multi-turn conversation's user, assistant, and system (if used) feature paths to` +
            ` be equal in length, got ${role_path.join(".")}, ${content_path.join(".")}`);
    }

    for (let i = 0; i < role_path.length - 1; i++) {
        // the feature path must be the same up to before the conversation array
        if (role_path[i] != content_path[i]) {
            throw Error(`Tokenization: the dataset feature paths must be identical up until` +
                ` the last element: got ${role_path.join(".")}, ${content_path.join(".")}`);
        }
    }

    // drill down to the conversation array
    let current = json_row;

    for (let i = 0; i < role_path.length - 1; i++) {
        const key = role_path[i];

        if (current != null && typeof current === "object" && key in current) {
            current = current[key];
        }
    }

    if (!Array.isArray(current)) {
        throw Error(`Tokenization: expected an array of multi-turn user-assistant conversations, got ${typeof current}`);
    }

    const role = role_path.at(-1);
    const content = content_path.at(-1);

    if (!role) {
        throw Error(`Tokenization: invalid role path ${role_path.join(".")}`);
    }

    if (!content) {
        throw Error(`Tokenization: invalid content path: ${content_path.join(".")}`);
    }

    // at this point, the current object is an array formatted as [{ role: "...", content: "..." }],
    // now we populate the chat array with the multi-turn conversation
    const chat: ChatFormat = [];

    for (const row of current) {
        if (!row) {
            continue;
        }

        const role_value = row[role];
        const content_value = row[content];

        if (role_value && content_value) {
            chat.push(formatChatTurn(row[role], row[content]))
        }
    }

    return tokenizer.apply_chat_template(chat, {
        tokenize: true, // perform tokenization
        return_tensor: false, // returns number[]
        return_dict: false // returns just tokens
    }) as number[];
}
