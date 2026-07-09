"use client"

import React from "react";
import { Layers, Trash2 } from "lucide-react";
import { Container } from "@/features/training/container";
import { v4 as uuid } from 'uuid';
import { compatibleWithPrevLayer, getLayer } from "@/features/training/regression/layers/layer-types";
import { Button } from "@/components/ui/button";
import { ImageContext } from "@/features/training/image_classification/image-contexts";
import { LayerKiosk, LayerKioskMobile, LayerList } from "@/features/training/regression/layers";


import { useDialogue } from "@/components/dialogue";
import { useProject } from "@/features/training/project-contexts";
import useRender from "@/components/use-render";
import type ProjectConfig from "@/lib/data-processing/project_config";


const layer_kiosk = [
    getLayer("conv2d", uuid()), getLayer("maxPooling2d", uuid()), getLayer("averagePooling2d", uuid()),
    getLayer("dense", uuid()), getLayer("dropout", uuid()), getLayer("flatten", uuid()),
    getLayer("layerNormalization", uuid()), getLayer("batchNormalization", uuid()),
    getLayer("globalAveragePooling1d", uuid()), getLayer("globalMaxPooling1d", uuid()),
    getLayer("embedding", uuid()), getLayer("tokenAndPositionalEmbedding", uuid()),
    getLayer("transformerEncoder", uuid()), getLayer("transformerDecoder", uuid()),
    getLayer("lstm", uuid()), getLayer("gru", uuid()),
];


export default function ModelLayers() {
    const { status } = React.use(ImageContext);
    const { project_config, full_render } = useProject<ProjectConfig>();
    const { confirmation, Dialogue } = useDialogue();
    const local_render = useRender();

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

    const onLayerChange = () => {
        local_render();
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