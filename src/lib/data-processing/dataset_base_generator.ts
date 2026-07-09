export abstract class DatasetGenerator {
    protected shuffle_per_epoch: boolean;


    constructor({ shuffle = true }: { shuffle: boolean }) {
        this.shuffle_per_epoch = shuffle;
    }

    public prepare(): void { };

    public abstract generator(...args: any):
        Promise<() => Generator<{ xs: any, ys: any }, void, unknown>> |
        Promise<() => AsyncGenerator<{ xs: any, ys: any }, void, unknown>> |
        (() => Generator<{ xs: any, ys: any }, void, unknown> | AsyncGenerator<{ xs: any, ys: any }, void, unknown>);


    public abstract skip(size: number): DatasetGenerator;

    public abstract take(size: number): DatasetGenerator;

    /**
     * Shuffles the inputs together using Durstenfeld shuffle. 
     * https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     */
    public static shuffle(...array: any[]) {
        for (let i = array[0].length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            for (const arr of array) {
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
        }
    }

    /**
     * The number of inputs/labels of the dataset
     */
    public abstract get length(): number | undefined;
}
