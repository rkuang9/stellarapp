import { Losses, Metrics, Optimizers } from "@/types/hyperparameters";
import * as tf from "@tensorflow/tfjs";
import * as tfs from "@stellarapp/tfjs-stellar";

tf.env().set('IS_NODE', false);


describe("test hyperparameters", () => {
    it("loss functions", async () => {
        const losses = Object.keys(Losses);

        for (const loss of losses) {
            const model = tf.sequential({
                layers: [
                    tf.layers.dense({ units: 1, inputShape: [1] })
                ]
            });

            model.compile({ loss, optimizer: "adam" });
        }
    });


    it("optimizers", async () => {
        const optimizers = Object.keys(Optimizers);

        for (const optimizer of optimizers) {
            const model = tf.sequential({
                layers: [
                    tf.layers.dense({ units: 1, inputShape: [1] })
                ]
            });

            model.compile({ loss: "binaryCrossentropy", optimizer });
        }
    });


    it("metrics", async () => {
        const metrics = Object.keys(Metrics).filter(
            name => name != "recall" && name != "precision" && name != "perplexity");

        const model = tf.sequential({
            layers: [
                tf.layers.dense({ units: 1, inputShape: [1] })
            ]
        });

        expect(() => model.compile({
            loss: "binaryCrossentropy",
            optimizer: "adam",
            metrics
        })).not.toThrow();

        const lm = tfs.models.gptModel({ numHeads: 1, numLayers: 1, embedDim: 4, vocabSize: 64 });

        expect(() => lm.compile({
            optimizer: "adam",
            loss: "sparseCategoricalCrossentropy",
            metrics: ["perplexity", "recall", "precision"]
        })).not.toThrow();
    });
});
