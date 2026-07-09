import * as tf from "@tensorflow/tfjs";
import { TrainingSample, } from "@/lib/data-processing/tokenization_pipeline";
import { llmDatasetGenerator, getSamplesCount } from "@/lib/data-processing/dataset_llm_generator";


// avoid TFJS node message during Jest testing
tf.env().set('IS_NODE', false);


function createDummyTokens(amount: number): TrainingSample {
    return {
        tokens: Array(amount).fill(0),
        prompt_mask: Array(amount).fill(0)
    }
}


describe("test LLM dataset generator", () => {

    it("should generate and calculate the expected number of sample-label pairs", () => {
        const scenarios = [{
            dataset: [
                createDummyTokens(10), // packed
                createDummyTokens(30), // packed, 8
                createDummyTokens(10), // 0
            ],
            expected_count: 8,
            sequence_length: 32,
            stride: 1
        }, {
            dataset: [
                createDummyTokens(10), // packed
                createDummyTokens(30), // packed, 1
                createDummyTokens(10), // 0
            ],
            expected_count: 1,
            sequence_length: 32,
            stride: 32
        }, {
            dataset: [
                createDummyTokens(32), // packed
                createDummyTokens(32), // packed, 32
                createDummyTokens(32), // 0
            ],
            expected_count: 32,
            sequence_length: 32,
            stride: 1
        }, {
            dataset: [
                createDummyTokens(64), // 2
                createDummyTokens(64), // 2
                createDummyTokens(10), // 0
            ],
            expected_count: 4,
            sequence_length: 32,
            stride: 16
        }, {
            dataset: [
                createDummyTokens(64), // 1
                createDummyTokens(64), // 1
                createDummyTokens(10), // 0
            ],
            expected_count: 2,
            sequence_length: 32,
            stride: 32
        }];


        for (const { dataset, expected_count, sequence_length, stride } of scenarios) {
            const generator = llmDatasetGenerator(dataset, "finetuning", sequence_length, stride, false);

            let generated_samples = 0;

            let sample = generator.next();

            while (!sample.done) {
                generated_samples++;
                sample = generator.next();
            }

            expect(generated_samples).toEqual(expected_count);
            expect(getSamplesCount(dataset, sequence_length, stride)).toEqual(expected_count);
        }
    });

});
