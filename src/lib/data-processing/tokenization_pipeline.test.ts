import {
    generatePromptMask,
    tokenizeFinetuneJsonArray,
    tokenizeFinetuneJsonLines,
    tokenizePretrainJson,
    tokenizePretrainJsonLines,
    tokenizePretrainText
} from "@/lib/data-processing/tokenization_pipeline";
import { AutoTokenizer, PreTrainedTokenizer } from "@huggingface/transformers";

const [row1, row2] = [
    { system: "you're a friendly bot", question: "how are you?", response: "I'm doing just normal" },
    { system: "you're a helpful bot", question: "generate a short song", response: "no" }
];

const [expected_row1_tokenized, expected_row2_tokenized] = [
    { prompt_mask: null, tokens: [151644, 8948, 198, 9330, 2299, 264, 11657, 10924, 151645, 198, 151644, 872, 198, 5158, 525, 498, 30, 151645, 198, 151644, 77091, 198, 40, 2776, 3730, 1101, 4622, 151645, 198] },
    { prompt_mask: null, tokens: [151644, 8948, 198, 9330, 2299, 264, 10950, 10924, 151645, 198, 151644, 872, 198, 19366, 264, 2805, 5492, 151645, 198, 151644, 77091, 198, 2152, 151645, 198] }
];

const [expected_row1_system_tokenized, expected_row2_system_tokenized] = [
    { tokens: [9330, 2299, 264, 11657, 10924], prompt_mask: null },
    { tokens: [9330, 2299, 264, 10950, 10924], prompt_mask: null }
];

const features = {
    user: ["question"],
    assistant: ["response"],
    system: ["system"]
}


let tokenizer: PreTrainedTokenizer;


describe("LLM dataset tokenization", () => {
    test("tokenizing finetune JSON", async () => {
        // using Qwen because it uses ChatML and is most downloaded on Huggingface
        tokenizer = await AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B-Instruct");

        const [row1_tokenized, row2_tokenized] = tokenizeFinetuneJsonArray(tokenizer, [row1, row2], features);

        expect(row1_tokenized).toEqual(expected_row1_tokenized);
        expect(row2_tokenized).toEqual(expected_row2_tokenized);

    });


    test("tokenizing finetune JSON Lines", async () => {
        const [row1_tokenized, row2_tokenized] = tokenizeFinetuneJsonLines(
            tokenizer, `${JSON.stringify(row1)}\n${JSON.stringify(row2)}`, features)

        expect(row1_tokenized).toEqual(expected_row1_tokenized);
        expect(row2_tokenized).toEqual(expected_row2_tokenized);
    });


    test("tokenizing pretrain text", async () => {
        expect(tokenizePretrainText(tokenizer, row1.system)).toEqual([expected_row1_system_tokenized]);
        expect(tokenizePretrainText(tokenizer, row2.system)).toEqual([expected_row2_system_tokenized]);
    });


    test("tokenizing pretrain JSON", async () => {
        expect(tokenizePretrainJson(tokenizer, [row1, row2], [features.system])).toEqual([
            expected_row1_system_tokenized, expected_row2_system_tokenized
        ]);
    });


    test("tokenizing pretrain JSON using duplicate features results in duplicate tokens", async () => {
        expect(tokenizePretrainJson(tokenizer, [row1, row2], [features.system, features.system])).toEqual([
            expected_row1_system_tokenized, expected_row1_system_tokenized,
            expected_row2_system_tokenized, expected_row2_system_tokenized
        ]);
    });


    test("tokenizing pretrain JSON Lines", async () => {
        expect(tokenizePretrainJsonLines(
            tokenizer, `${JSON.stringify(row1)}\n${JSON.stringify(row2)}`, [features.system]
        )).toEqual([
            expected_row1_system_tokenized, expected_row2_system_tokenized
        ]);
    });


    test("prompt masking, mask all non-assistant tokens", () => {
        const assistant_start = [20, 21, 22];
        const assistant_end = 30;

        expect(generatePromptMask([
            20, 21, 22, 2, 20, 21, 22, 1, 1, 1, 1, 1, 30, 2, 2, 2
        ], assistant_start, assistant_end)).toEqual([
            0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0
        ]);

        expect(generatePromptMask([
            2, 2, 2, 2, 20, 21, 22, 1, 1, 1, 1, 1, 30, 2, 2, 2
        ], assistant_start, assistant_end)).toEqual([
            0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0
        ]);

        expect(generatePromptMask([
            2, 2, 20, 21, 20, 21, 22, 1, 1, 1, 1, 1, 30, 2, 2, 2
        ], assistant_start, assistant_end)).toEqual([
            0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0
        ]);

        expect(generatePromptMask([
            2, 2, 21, 22, 20, 21, 22, 1, 1, 1, 1, 1, 30, 2, 2, 2
        ], assistant_start, assistant_end)).toEqual([
            0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0
        ]);

        expect(generatePromptMask([
            2, 2, 21, 22, 20, 21, 22, 1, 1, 1, 1, 1, 1, 2, 2, 2
        ], assistant_start, assistant_end)).toEqual([
            0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1
        ]);

        expect(generatePromptMask([
            20, 21, 22, 1, 1, 1, 1, 1, 1, 2, 2, 2
        ], assistant_start, assistant_end)).toEqual([
            0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1
        ]);

        expect(() => generatePromptMask([1, 2, 3], [], assistant_end)).toThrow();
        expect(() => generatePromptMask([1, 2, 3], [1, 1, 1], assistant_end)).toThrow();
    });


    test("tokenizing multi-turn conversation", async () => {
        const dataset = [{
            "dummy": "row",
            "ignore": "this",
            "messages": [
                { "role": "system", "content": "you're a friendly bot" },
                { "role": "user", "content": "what's the best anime?" },
                { "role": "assistant", "content": "Gundam" },
                { "role": "user", "content": "why is that?" },
                { "role": "assistant", "content": "because it's the best" },
            ]
        }];

        const feature_paths = {
            user: ["messages", "role"],
            assistant: ["messages", "content"],
            system: []
        }

        const expected = [
            151644, 8948, 198, 9330, 2299, 264, 11657, 10924, 151645, 198, 151644, 872, 198,
            12555, 594, 279, 1850, 22809, 30, 151645, 198, 151644, 77091, 198, 38, 1241, 309,
            151645, 198, 151644, 872, 198, 34634, 374, 429, 30, 151645, 198, 151644, 77091,
            198, 27653, 432, 594, 279, 1850, 151645, 198
        ];

        const tokenized = tokenizeFinetuneJsonArray(tokenizer, dataset, feature_paths)[0].tokens;

        expect(tokenized).toEqual(expected);
        expect(tokenizeFinetuneJsonLines(tokenizer, `${JSON.stringify(dataset[0])}`, feature_paths)[0].tokens).toEqual(expected);
        expect(tokenizer.decode(tokenized)).toEqual(
            "<|im_start|>system\nyou're a friendly bot<|im_end|>\n<|im_start|>user\nwhat's the best anime?<|im_end|>\n<|im_start|>assistant\nGundam<|im_end|>\n<|im_start|>user\nwhy is that?<|im_end|>\n<|im_start|>assistant\nbecause it's the best<|im_end|>\n"
        );

        // path lengths aren't equal
        expect(() => tokenizeFinetuneJsonArray(tokenizer, dataset, { ...feature_paths, assistant: ["messages", "content", "extra_invalid_path"] })).toThrow();
        // path length less than 2
        expect(() => tokenizeFinetuneJsonArray(tokenizer, dataset, { ...feature_paths, assistant: ["messages"] })).toThrow();
        // paths don't point in the same direction
        expect(() => tokenizeFinetuneJsonArray(tokenizer, dataset, { ...feature_paths, assistant: ["different", "path"] })).toThrow();


        // copy the dataset and set the last content to undefined
        const dataset_with_undefined = structuredClone(dataset);
        dataset_with_undefined[0].messages[dataset_with_undefined[0].messages.length - 1].content = undefined as any;

        // if the conversation contains an undefined value, then it's skipped
        const tokenized_with_undefined = tokenizeFinetuneJsonArray(tokenizer, dataset_with_undefined, feature_paths)[0].tokens;

        expect(tokenized_with_undefined).not.toEqual(expected);

        // the tokens are still a subset of the original tokens since the last chat turn was skipped
        expect(expected.toString().includes(tokenized_with_undefined.toString())).toBe(true);
    })
});
