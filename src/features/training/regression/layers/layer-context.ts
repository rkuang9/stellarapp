import React from "react";
import { ConfirmArgs } from "@/components/dialogue";

interface LayerContext {
    selected: number;
    setSelected: React.Dispatch<React.SetStateAction<number>>;
    onLayerChange: () => void;
    confirmation: ConfirmArgs;
    disabled: boolean;
}


export const LayerContext = React.createContext<LayerContext>({
    selected: 0,
    setSelected: () => { },
    onLayerChange: () => { },
    confirmation: async () => { return false },
    disabled: false
});