/**
 * 
 */
export default class ModelTimer {
    protected total_batches = 0;

    // timestamps
    protected time_global_start: number = 0;
    protected time_epoch_start: number = 0;
    protected time_last_batch: number = 0;
    protected time_ema: number = 0;

    // smoothing factor, formula 2 / (N + 1), heavier weight on the last N batches
    protected alpha_smoothing = 0.1;

    protected current_batch: number = 0; // starts at 0, tracked in case of premature epoch end
    protected current_epoch: number = -1;


    /**
     * @param focus_window the number of recent batches to place heavier weight on, defaults to `10` batches
     */
    constructor(focus_window: number = 10) {
        this.alpha_smoothing = 2 / (focus_window + 1);
    }


    public start(total_batches: number, starting_epoch?: number) {
        this.total_batches = total_batches - 1;
        this.current_epoch = starting_epoch ?? 0;

        if (this.current_epoch == 0 || starting_epoch != undefined) {
            this.time_global_start = Date.now();
        }

        this.current_epoch = starting_epoch ?? this.current_epoch + 1;

        // start of a new epoch, zero batches have been trained
        this.current_batch = 0;

        const now = Date.now();
        this.time_epoch_start = now;
        this.time_last_batch = now;
    }


    /**
     * Mark the current batch's completion time and estimate the remaining
     * time left to epoch end. This should be called after, not before, a batch.
     * 
     * @param batch the current batch
     * @returns the estimated remaining time to epoch completion
     */
    public lap(batch: number) {
        const now = Date.now();
        const elapsed = now - this.time_last_batch;

        if (batch == 0) {
            // initial value
            this.time_ema = elapsed;
        }

        this.time_ema =
            elapsed * this.alpha_smoothing +
            (this.time_ema * (1 - this.alpha_smoothing));

        this.time_last_batch = now;

        // purposefully de-coupled from the model's reported current batch index,
        // we track it ourselves
        this.current_batch++;

        return (this.total_batches - batch) * this.time_ema / 1000;
    }


    public time(since: "epoch" | "global") {
        return since == "epoch"
            ? (Date.now() - this.time_epoch_start) / 1000
            : (Date.now() - this.time_global_start) / 1000
    }


    get epoch() {
        return this.current_epoch;
    }


    get batches() {
        return this.current_batch;
    }
}