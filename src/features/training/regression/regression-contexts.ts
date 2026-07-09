import React from "react";
import type ForgeFrame from "@/lib/data-processing/forgeframe";


export interface RegressionContextArgs {
    dataframe?: ForgeFrame;
    dataframeRef: React.RefObject<ForgeFrame | undefined> | null;
    status: {
        dataset: boolean;
        layers: boolean;
        hyperparameters: boolean;
        training: boolean;
    };
}


export const RegressionContext = React.createContext<RegressionContextArgs>({
    dataframe: undefined,
    dataframeRef: null,
    status: {
        dataset: false,
        layers: false,
        hyperparameters: false,
        training: false,
    },
});
