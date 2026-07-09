"use client"

import React from "react";

import {
    LoaderCircle
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator";
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card";

import { SelectField } from "@/components/custom/select-field";

import { Metric, MetricsLabels } from '@/types/hyperparameters';
import { NotifyArgs } from "@/components/dialogue";
import { ProjectContext } from "@/features/training/project-contexts";
import { MetricsLineChart } from "@/features/training/chart";


const IDLE_MESSAGE: string = "Status: Model is idle";


interface ProgressState {
    batch: number;
    total_batches: number;
    time: number;
    status?: string | React.JSX.Element;
    metrics?: { [key: string]: number };
}


// metrics that should be multipled by 100 and displayed as percentage
const PERCENTAGE = new Set<string>([
    Metric.ACCURACY,
    Metric.PRECISION,
    Metric.RECALL,
    `val_${Metric.ACCURACY}`,
    `val_${Metric.PRECISION}`,
    `val_${Metric.RECALL}`
]);


export function TrainingProgress({ notify }: { notify: NotifyArgs }) {
    const { worker, project_config, cache, full_render } = React.useContext(ProjectContext);

    const [progress, setProgress] = React.useState<ProgressState>({
        batch: 0,
        total_batches: 0,
        time: 0,
    });


    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        if (!worker?.isTraining()) {
            if (project_config.metrics_history.length == 0) {
                setProgress({
                    ...progress,
                    metrics: !worker?.isBuilt() ? undefined : progress.metrics,
                    status: undefined
                })
                return;
            } else {
                // always display the most recent epoch's metrics
                const { batch, trained_batches, total_batches, time, ...rest } = project_config.metrics_history.at(-1)!;

                setProgress({
                    ...progress,
                    batch: batch ?? trained_batches ?? 0,
                    total_batches,
                    time,
                    metrics: rest,
                    status: undefined
                });
            }
        }
    }, [worker?.isTraining(), project_config.metrics_history.length])
    /* eslint-enable react-hooks/exhaustive-deps */


    if (worker) {
        worker.onBatchEnd = (tfLogs) => {
            const { batch, epoch, size, total_batches, time, ...rest } = tfLogs;

            setProgress({
                batch: batch + 1,
                total_batches,
                time,
                metrics: rest,
            });
        }


        worker.onValBatchEnd = (tfLogs) => {
            const { batch, epoch, size, total_batches, time, ...rest } = tfLogs;

            setProgress({
                batch: batch + 1,
                total_batches,
                time,
                metrics: { ...progress.metrics, ...rest },
            })
        }


        worker.onTrainError = async (error) => {
            notify({ title: "An error occurred", description: error.toString() });
            setProgress({
                ...progress,
                status: IDLE_MESSAGE,
            })

            full_render(); // re-enable disabled components
        }


        worker.onInitialize = () => {
            const { metrics, batch, total_batches, ...rest } = progress;

            setProgress({
                ...rest,
                batch: 0,
                total_batches: 0,
                status: <div className="flex gap-1 items-center">
                    Status: Compiling model and loading training data from the dataset
                    <LoaderCircle className="animate-spin" size={14} />
                </div>
            });
        }


        worker.onEpochStart = () => {
            setProgress({
                batch: 0,
                total_batches: 0,
                time: 0,
                metrics: undefined,
                status: <div className="flex gap-1 items-center">
                    Status: Initializing new training epoch
                    <LoaderCircle className="animate-spin" size={14} />
                </div>,
            })
        }


        worker.onEpochEnd = (tfLogs) => {
            const { batch, total_batches, time, ...rest } = tfLogs;
            
            if (tfLogs) {
                project_config.metrics_history.push(tfLogs);
                setProgress({
                    ...progress,
                    batch,
                    total_batches,
                    time,
                    metrics: rest,
                    status: undefined
                });
            }

            full_render();
        }


        worker.onTrainEnd = () => {
            // worker.isTraining is not false, update the UI to show this
            full_render();
        }
    }

    const metrics_string = progress.metrics
        ? Object.keys(progress.metrics).map(metric => {
            const value = progress.metrics?.[metric];
            let display = "-";

            // the >= comparison is used here because the number zero evaluates to false
            if (value != undefined) {
                if (PERCENTAGE.has(metric)) {
                    display = `${(value * 100).toFixed(3)}%`;
                } else {
                    display = value.toFixed(5);
                }
            }

            return <div key={metric} className="text-sm">
                {MetricsLabels[metric]}: <b>{display}</b>
            </div>
        })
        : <span className="whitespace-pre-wrap">
            {progress.status ?? IDLE_MESSAGE}
        </span>;

    const current_epoch = worker?.isTraining()
        ? project_config.metrics_history.length + 1
        : project_config.metrics_history.length;

    let batch_progress;
    let eta_time;

    if (!worker?.isTraining() && project_config.metrics_history.at(-1)) {
        // trained_batches is legacy, to be removed over time!!!
        const { time, batch, trained_batches, total_batches } = project_config.metrics_history.at(-1)!;

        batch_progress = `${(batch ?? trained_batches ?? "-").toLocaleString()}/${total_batches.toLocaleString()}`;
        eta_time = prettyTime(time);
    } else if (worker?.isBuilt()) {
        batch_progress = `${progress.batch.toLocaleString()}/${progress.total_batches.toLocaleString()}`;
        eta_time = prettyTime(progress.time);
    } else {
        batch_progress = "0/0";
        eta_time = "00:00:00";
    }

    //const status_message = progress.status ? progress.status : (!worker?.isTraining() && !worker?.isBuilt() && !progress.metrics ? IDLE_MESSAGE : undefined);

    return <div id="training-progress" className="flex flex-col gap-2 p-2 border dark:bg-elevated rounded-md overflow-x-auto">
        <div className="flex gap-2 flex-wrap">
            <div className="flex flex-row gap-1 text-sm tabular-nums">
                <span id="current-epoch">Epoch {current_epoch}</span>·
                <span id="current-batch">Batch {batch_progress}</span>·
                <span id="current-eta">{eta_time}</span>
            </div>

            <div className="flex grow items-center">
                <Progress value={worker?.isBuilt() ? Math.floor(100 * progress.batch / progress.total_batches) : 0} className="[&>*]:bg-theme" />
            </div>
        </div>

        <Separator />

        <div id="training-metrics-log" className="tabular-nums flex flex-row gap-3 whitespace-nowrap overflow-auto text-sm dark:text-muted-foreground flex-wrap md:flex-nowrap" style={{ scrollbarWidth: "none" }}>
            {metrics_string}
        </div>
    </div>
}


export function MetricsChart() {
    const [active_metric, setActiveMetric] = React.useState<`${Metric}` | `val_${Metric}` | "loss" | "val_loss">("loss");
    const { project_config } = React.useContext(ProjectContext);

    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        const current_active_metric = active_metric.replace("val_", "");

        if (current_active_metric != "loss" &&
            !project_config.model.metrics.includes(current_active_metric as any)) {
            setActiveMetric("loss");
        }
    }, [project_config.model.metrics]);
    /* eslint-enable react-hooks/exhaustive-deps */

    const available_metrics: { [key: string]: string } = {
        loss: "Show loss graph",
    }

    if (project_config.model.validation_split > 0) {
        available_metrics.val_loss = "Show loss (validation) graph";
    }

    project_config.model.metrics.forEach(metric => {
        const val_metric = "val_" + metric;
        const metrics_label = MetricsLabels[metric];

        if (metrics_label) {
            available_metrics[metric] = `Show ${metrics_label.toLocaleLowerCase()} graph`;

            if (project_config.model.validation_split > 0) {
                available_metrics[val_metric] = `Show ${metrics_label.toLocaleLowerCase()} (validation) graph`;
            }
        }
    })

    const metrics = project_config.metrics_history.map((metric, epoch) => ({
        epoch: epoch + 1,
        [active_metric]: metric[active_metric]
    }));

    return <Card className="grow flex flex-col p-0 border-none rounded-md gap-2 bg-inherit!">
        {project_config.metrics_history.length > -1 && <>
            <CardHeader className="flex flex-col items-stretch !p-0 lg:flex-row rounded-md ">
                <div>
                    <SelectField
                        placeholder="Show metric"
                        value={available_metrics[active_metric] ? active_metric : ""}
                        options={available_metrics}
                        onValueChange={value => {
                            setActiveMetric(value as Metric);
                        }} />
                </div>
            </CardHeader>
            <CardContent className="grow flex flex-col dark:bg-muted! rounded-md border-0">
                <MetricsLineChart
                    id="metrics-chart"
                    data={metrics}
                    x={{ key: "epoch", label: "Epoch" }}
                    y={{
                        key: active_metric,
                        max: (active_metric == "acc" || active_metric == "val_acc") ? 1 : undefined,
                        label: MetricsLabels[active_metric],
                        color: "var(--theme)"
                    }}
                />
            </CardContent>
        </>}
    </Card>
}


function pad(time: number) {
    return (time < 10 ? "0" : "") + time;
}

function prettyTime(seconds: number) {
    // with Math.ceil(), any time less than 1 second will still display 1 second left
    const total_seconds = Math.ceil(seconds);

    const hours = Math.floor(total_seconds / 3600);
    const minutes = Math.floor(total_seconds % 3600 / 60);
    const seconds_remaining = total_seconds % 60;

    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds_remaining);
}
