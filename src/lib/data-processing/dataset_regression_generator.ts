import { DatasetGenerator } from "@/lib/data-processing/dataset_base_generator";


export class DatasetRegressionGenerator extends DatasetGenerator {
    protected xs: number[][] | number[][][];
    protected ys: number[][];

    constructor({ xs, ys, shuffle = true }: {
        xs: number[][] | number[][][];
        ys: number[][];
        shuffle?: boolean;
    }) {
        super({shuffle});

        if (xs.length != ys.length) {
            throw Error(`DatasetRegression: there are not a same number of inputs (${xs.length}) as labels (${ys.length})`);
        }

        this.xs = xs;
        this.ys = ys;

        this.shuffle_per_epoch = shuffle;
    }


    /**
     * Shuffle the dataset once
     */
    public shuffle() {
        DatasetGenerator.shuffle(this.xs, this.ys);
    }


    public override skip(size: number) {
        return new DatasetRegressionGenerator({
            xs: this.xs.slice(size, this.xs.length),
            ys: this.ys.slice(size, this.ys.length),
            shuffle: this.shuffle_per_epoch
        });
    }


    public override take(size: number) {
        return new DatasetRegressionGenerator({
            xs: this.xs.slice(0, size),
            ys: this.ys.slice(0, size),
            shuffle: this.shuffle_per_epoch
        });
    }


    public override generator() {
        const shuffle = this.shuffle_per_epoch;

        const x_train = this.xs;
        const y_train = this.ys;

        return function* () {
            if (shuffle) {
                DatasetGenerator.shuffle(x_train, y_train);
            }

            for (let i = 0; i < x_train.length; i++) {
                yield {
                    xs: x_train[i],
                    ys: y_train[i]
                }
            }
        }
    }


    public override get length() {
        return this.xs.length;
    }
}
