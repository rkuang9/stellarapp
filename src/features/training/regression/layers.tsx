"use client"

import React from "react";
import { Layers, Trash2, Plus } from "lucide-react";
import { Container } from "@/features/training/container";
import { v4 as uuid } from 'uuid';
import { getLayerComponent } from "@/features/training/regression/layers/layer-components";
import { compatibleWithPrevLayer, getLayer, LayerConfig, updateLayerRank } from "@/features/training/regression/layers/layer-types";
import { Button } from "@/components/ui/button";
import { RegressionContext } from "@/features/training/regression/regression-contexts";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useRender from "@/components/use-render";
import { LayerContext } from "@/features/training/regression/layers/layer-context";
import { useDialogue } from "@/components/dialogue";
import { MultiSelect, MultiSelectOption } from "@/components/custom/multi-select";
import { ProjectContext, useProject } from "@/features/training/project-contexts";
import type ProjectConfig from "@/lib/data-processing/project_config";


const layer_kiosk = [
    getLayer("dense", uuid()), getLayer("dropout", uuid()), getLayer("flatten", uuid()),
    getLayer("embedding", uuid()), getLayer("tokenAndPositionalEmbedding", uuid()),
    getLayer("transformerEncoder", uuid()), getLayer("transformerDecoder", uuid()),
    getLayer("lstm", uuid()), getLayer("gru", uuid()),
    getLayer("layerNormalization", uuid()), getLayer("batchNormalization", uuid()),
    getLayer("globalAveragePooling1d", uuid()), getLayer("globalMaxPooling1d", uuid()),
    getLayer("conv2d", uuid()), getLayer("maxPooling2d", uuid()), getLayer("averagePooling2d", uuid()),
];


export default function ModelLayers() {
    const { status } = React.use(RegressionContext);
    const { project_config, full_render } = useProject<ProjectConfig>();
    const { confirmation, Dialogue } = useDialogue();
    const render = useRender();

    React.useEffect(() => {
        let all_ok: boolean = project_config.model.layers.length > 0;

        for (let i = 0; i < project_config.model.layers.length; i++) {
            const current_layer = project_config.model.layers[i];
            const previous_layer = i > 0 ? project_config.model.layers[i - 1] : null;

            if (!compatibleWithPrevLayer(current_layer, previous_layer, project_config.model.input_shape).compatible) {
                all_ok = false;
                break;
            }

            for (const param in project_config.model.layers[i].config) {
                if (project_config.model.layers[i].config[param] == -9000 &&
                    !project_config.model.layers[i].auto) {
                    all_ok = false;
                    break;
                }
            }
        }

        if (status.layers != all_ok) {
            status.layers = all_ok;
            full_render();
        }
    });

    const onLayerChange = () => {
        render();
    }

    const clearAllLayers = () => {
        if (project_config.model.layers.length == 0) {
            return;
        }

        confirmation({ description: "Are you sure you want to delete all layers?" }).then(answer => {
            if (answer) {
                project_config.model.layers = [];
                full_render();
            }
        })
    }

    return (
        <Container
            id="layers"
            heading="Model Layers"
            subheading="Build the model by stacking together a list of layers to form a neural network."
            icon={Layers}
            className="grow flex flex-col h-11/12 w-full"
            contentClassName="w-full!"
        >
            <Dialogue />

            <div className="flex gap-2 lg:hidden">
                <LayerKioskMobile selection={layer_kiosk} />

                <Button id="remove-all-layers" variant="outline" size="icon" onClick={clearAllLayers}>
                    <Trash2 className="text-error" />
                </Button>
            </div>
            <div className="flex flex-row grow justify-around overflow-auto gap-2 my-2">
                <div className="dark:bg-elevated w-full lg:w-9/12 overflow-y-auto border rounded-md">
                    <LayerList selection={layer_kiosk} onLayerChange={onLayerChange} />
                </div>

                <div className="hidden lg:flex lg:w-3/12 flex-col overflow-auto">
                    <LayerKiosk selection={layer_kiosk} />
                </div>
            </div>
        </Container>
    )
}


export function LayerList({ selection, onLayerChange }: { selection: LayerConfig[], onLayerChange: () => void }) {
    const { project_config, worker } = React.useContext(ProjectContext);
    const [selected, setSelected] = React.useState<number>(-1);

    const { confirmation, Dialogue } = useDialogue();

    return (
        <div className="flex flex-col grow p-2 gap-2 w-full">
            <Dialogue />
            {project_config.model.layers.length == 0 && <div className="hidden lg:block w-full"><LayerKioskMini selection={selection} index={0} /></div>}
            <LayerContext value={{
                onLayerChange: onLayerChange,
                selected: selected,
                setSelected: setSelected,
                confirmation,
                disabled: worker?.isTraining() ?? false
            }}>
                {project_config.model.layers.map((layer, index) => {
                    const LayerComponent = getLayerComponent(layer.identifier)!;

                    const current_layer = project_config.model.layers[index];
                    const previous_layer = index > 0 ? project_config.model.layers[index - 1] : null;

                    const check = compatibleWithPrevLayer(current_layer, previous_layer, project_config.model.input_shape);

                    // here rather than gap on parent div, we use margin and padding to ensure smoothness
                    return <div
                        key={`layer-${index}`}
                        id={`layer-${index}`}
                        className="flex flex-col gap-2 items-center"
                        onClick={() => setSelected(index)}
                    >
                        <LayerComponent index={index} error={!check.compatible} />
                        {!check.compatible && <span className="text-error text-start w-full text-xs px-2">{check.reason}</span>}
                        <div className="w-full hidden lg:block">
                            <LayerKioskMini index={index} selection={selection} />
                        </div>
                    </div>
                })}
            </LayerContext>
        </div>
    )
}


export function LayerKiosk({ selection }: { selection: LayerConfig[] }) {
    const { project_config, worker, full_render } = React.useContext(ProjectContext);

    const addLayer = (identifier: string) => {
        // add a layer to the end of the list
        project_config.model.layers = [...project_config.model.layers, getLayer(identifier, uuid())];
        updateLayerRank(project_config.model.layers, project_config.model.input_shape);
        full_render();
    }

    return (
        <div className="flex flex-col overflow-auto gap-2" style={{ scrollbarColor: "grey transparent" }}>
            {selection.map((layer, index) => <Button
                disabled={worker?.isTraining()}
                id={`kiosk-${layer.identifier}`}
                key={layer.identifier + index}
                suppressHydrationWarning
                onClick={() => addLayer(layer.identifier)}
                variant="outline"
                className="flex justify-start cursor-pointer truncate text-muted-foreground"
                title={layer.label}
            >
                <Plus className="text-theme" />
                {layer.label}
            </Button>)}
        </div>
    )
}


export function LayerKioskMobile({ selection }: { selection: LayerConfig[] }) {
    const { project_config, worker, full_render } = React.useContext(ProjectContext);

    const addLayer = (identifier: string) => {
        // add a layer to the end of the list
        project_config.model.layers.push(getLayer(identifier, uuid()));
        updateLayerRank(project_config.model.layers, project_config.model.input_shape);
        full_render();
    }

    return (
        <MultiSelect
            disabled={worker?.isTraining()}
            fullWidthMenu={false}
            label={
                <Button variant="outline" className="grow ring-0! focus:ring-0!">
                    <Plus />
                    Add layer
                </Button>}
        >
            {selection.map(layer => (
                <MultiSelectOption
                    key={layer.identifier}
                    onClick={event => {
                        event.stopPropagation();
                        addLayer(layer.identifier);
                    }}>
                    {layer.label}
                </MultiSelectOption>
            ))}
        </MultiSelect>
    )
}


function LayerKioskMini({ index, selection }: { index: number, selection: LayerConfig[] }) {
    const { project_config, worker, full_render } = React.useContext(ProjectContext);

    const addLayer = (identifier: string) => {
        // add a layer to the end of the list
        project_config.model.layers.splice(index + 1, 0, getLayer(identifier, uuid()));
        updateLayerRank(project_config.model.layers, project_config.model.input_shape);
        full_render();
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger disabled={worker?.isTraining()} title="Add layer" asChild id={"mobile-layer-kiosk-trigger-" + index} className="select-none">
                <div className="flex flex-col gap-1 items-center cursor-pointer">
                    {project_config.model.layers.length == 0 && <span className="text-muted-foreground text-xs">
                        Click here to add layers
                    </span>}
                    <Plus className="border rounded-full size-6 md:size-5 p-1" />
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="bg-elevated" id={"mobile-layer-kiosk-content-" + index}>
                {selection.map(layer => (
                    <DropdownMenuItem className="cursor-pointer hover:bg-elevated-2!" key={layer.identifier} onClick={event => {
                        event.stopPropagation();
                        addLayer(layer.identifier);
                    }}>
                        {layer.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
