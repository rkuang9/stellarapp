import { DatasetGenerator } from "@/lib/data-processing/dataset_base_generator";
import { OneHotEncodingArgs } from "@/lib/data-processing/project_config";
import * as tf from "@tensorflow/tfjs";


export class DatasetImageGenerator extends DatasetGenerator {
    protected xs: Blob[]
    protected ys: string[];


    constructor({ xs, ys, shuffle = true }: {
        xs: Blob[];
        ys: string[];
        shuffle: boolean
    }) {
        super({ shuffle });

        this.shuffle_per_epoch = shuffle;
        this.xs = xs;
        this.ys = ys;
    }


    /**
     * Shuffle the dataset once
     */
    public shuffle() {
        DatasetGenerator.shuffle(this.xs, this.ys);
    }


    public skip(size: number) {
        return new DatasetImageGenerator({
            xs: this.xs.slice(size, this.xs.length),
            ys: this.ys.slice(size, this.ys.length),
            shuffle: this.shuffle_per_epoch
        })
    }


    public take(size: number) {
        return new DatasetImageGenerator({
            xs: this.xs.slice(0, size),
            ys: this.ys.slice(0, size),
            shuffle: this.shuffle_per_epoch
        })
    }


    public async dataset(onehot_encoding: OneHotEncodingArgs, shape: number[]) {
        const shuffle = this.shuffle_per_epoch;

        const x_train = await Promise.all(this.xs.map(blob => createImageBitmap(blob)));
        const y_train = this.ys;

        return x_train.map((blob, index) => {
            return {
                xs: tf.tidy(() => tf.image.resizeBilinear(tf.browser.fromPixels(blob), [shape[0], shape[1]]).div(255)),
                ys: tf.tensor1d([onehot_encoding[y_train[index]]])
            }
        })
    }


    public override generator(onehot_encoding: OneHotEncodingArgs, shape: number[]) {
        const shuffle = this.shuffle_per_epoch;

        const x_train = this.xs;
        const y_train = this.ys;

        return async function* () {
            if (shuffle) {
                DatasetGenerator.shuffle(x_train, y_train);
            }

            for (let i = 0; i < x_train.length; i++) {
                try {
                    // skip bad images with try catch
                    const bitmap = await createImageBitmap(x_train[i]);
                    const tensor = tf.tidy(() => tf.image.resizeBilinear(tf.browser.fromPixels(bitmap), [shape[0], shape[1]]).div(255));
                    bitmap.close();

                    yield {
                        xs: tensor,
                        ys: tf.tensor1d([onehot_encoding[y_train[i]]])
                    }
                } catch {
                    continue;
                }
            }
        }
    }


    public override get length() {
        return this.xs.length;
    }
}
