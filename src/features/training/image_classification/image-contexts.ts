import React from "react";
import ImageDataset from "@/lib/data-processing/dataset_image";


export interface ImageContextArgs {
    imageset: ImageDataset;
    status: {
        dataset: boolean;
        layers: boolean;
        hyperparameters: boolean;
        training: boolean;
    };
}


export const ImageContext = React.createContext<ImageContextArgs>({
    imageset: new ImageDataset(),
    status: {
        dataset: false,
        layers: false,
        hyperparameters: false,
        training: false,
    },
});
