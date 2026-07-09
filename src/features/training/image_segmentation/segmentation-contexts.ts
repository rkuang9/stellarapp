import React from "react";
import SegmentationDataset from "@/lib/data-processing/dataset_segmentation";


export interface SegmentationContextArgs {
    segmentationset: SegmentationDataset;
    status: {
        dataset: boolean;
        model_setup: boolean;
        hyperparameters: boolean;
        training: boolean;
    };
}


export const SegmentationContext = React.createContext<SegmentationContextArgs>({
    segmentationset: new SegmentationDataset(),
    status: {
        dataset: false,
        model_setup: false,
        hyperparameters: false,
        training: false,
    },
});
