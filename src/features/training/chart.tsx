"use client"

import { Label, Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"


const lineDotConfig = { fill: "#ffffff", stroke: "#ffffff", strokeWidth: 1 };


export function MetricsLineChart({ data, x, y, id }: {
    id?: string;
    data: { [key: string]: number }[];
    x: {
        key: string;
        label: string;
    };
    y: {
        key: string;
        label: string; // first label is displayed on y-axis
        dashed?: boolean;
        color?: string; // default orange
        max?: number;
    };
}) {
    const chart_config = {
        [x.key]: { label: x.label },
        [y.key]: { label: y.label },
    } satisfies ChartConfig

    const xmax = data.length > 0
        ? Math.ceil(Math.max(...data.map(i => i[x.key])))
        : 10;

    // y-axis max value the maximum of all y-axis values multiplied by some
    // constant so that the upper end of the chart has some space
    const ymax = y.max ?? (data.length > 0
        ? Math.ceil(Math.max(...data.map(ydata => ydata[y.key]))) * 1.2
        : 1);

    // the hard coded height is to avoid vertical overflow (unless user zooms in browser)
    return <ChartContainer id={`chart-container-${id}`} config={chart_config} className="aspect-auto! h-[99%]">
        <LineChart
            id="chart-main"
            margin={{ bottom: 13 }}
            accessibilityLayer
            data={data}
        >
            <CartesianGrid vertical horizontal />
            <XAxis
                domain={xmax ? [1, xmax] : undefined}
                id={`chart-x-axis-${id}`}
                dataKey={x.key}
                tickLine={true}
                axisLine={true}
                tickFormatter={(value) => value % 1 == 0 ? value.toFixed(0) : value.toFixed(2)}
                tickMargin={8}
            >
                <Label
                    id={`chart-x-axis-label-${id}`}
                    dy={20}
                    position="centerBottom"
                    style={{ textAnchor: "middle" }}
                >
                    {x.label}
                </Label>
            </XAxis>

            <YAxis
                domain={ymax ? [0, ymax] : [0, 1]}
                yAxisId="y-axis"
                id={`chart-y-axis-${id}`}
                tickLine={true}
                axisLine={true}
                tickMargin={8}
                tickFormatter={(value) => value % 1 == 0 ? value.toFixed(0) : value.toFixed(2)}
                dataKey={y.key}
            >
                <Label
                    id={`chart-y-axis-label-${id}`}
                    angle={-90}
                    position="insideLeft"
                    style={{ textAnchor: "middle" }}
                >
                    {y.label}
                </Label>
            </YAxis>

            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />

            <Line
                key={y.key}
                isAnimationActive={false}
                id={`chart-line-${y.key}`}
                yAxisId="y-axis"
                dataKey={y.key}
                type="linear"
                stroke={y.color ? y.color : "var(--theme)"}
                strokeWidth={2}
                dot={lineDotConfig}
                strokeDasharray={y.dashed ? "3 3" : undefined}
            />

        </LineChart>
    </ChartContainer>
}
