import React from "react";


export interface GPTContextArgs {
    status: {
        dataset: boolean;
        model_size: boolean;
        hyperparameters: boolean;
        training: boolean;
    };
}


export const GPTContext = React.createContext<GPTContextArgs>({
    status: {
        dataset: false,
        model_size: false,
        hyperparameters: false,
        training: false,
    }
});
