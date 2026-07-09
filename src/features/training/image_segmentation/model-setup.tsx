"use client"

import React from "react";
import { Check, Package } from "lucide-react";

import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from "@/components/ui/field"

import { Container } from "@/features/training/container";
import { ProjectContext, useProject } from "@/features/training/project-contexts";
import { SegmentationContext } from "@/features/training/image_segmentation/segmentation-contexts";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useDialogue } from "@/components/dialogue";
import { error_text_css, field_layout_css } from "@/features/training/regression/hyperparameters";
import { FieldLabel as ParamLabel } from "@/features/training/regression/hyperparameters";
import { SelectField } from "@/components/custom/select-field";
import useRender from "@/components/use-render";
import { Loss } from "@/types/hyperparameters";
import ProjectConfig from "@/lib/data-processing/project_config";


const FILTER_OPTIONS = [4, 8, 16, 32, 64];
const DEPTH_OPTIONS = [2, 3, 4, 5, 6];
const SUCCESS_ICON_STYLE = "text-success size-5";


export default function ModelSize() {
    return (
        <Container
            id="model-setup"
            heading="Model Setup"
            subheading="Choose the type of model, its width and depth, and the size of your images"
            icon={Package}
            className="grow flex flex-col w-full"
            contentClassName="w-full!"
        >
            <div className="flex flex-col gap-4 md:max-w-2xl">

                <ModelType />

                <Separator />

                <UNetParameters />

            </div>
        </Container>
    )
}


function UNetParameters() {
    const { project_config, worker, full_render } = useProject<ProjectConfig>();
    const { status } = React.useContext(SegmentationContext);
    const local_render = useRender();
    const { notify, Dialogue } = useDialogue();

    const config = project_config.model.layers.at(0)?.config;

    const units = config?.units as number | undefined;
    const [height, width] = project_config.model.input_shape as number[];
    const depth = config?.depth as number | undefined;
    const filters = config?.filters as number | undefined;

    const field_errors: { [key: string]: string | React.JSX.Element | undefined } = {
        units: units != undefined && units > 0 ? undefined : "There should be at least 2 categories to be segmented",
        height: depth != undefined && height != 0 && (height % Math.pow(2, depth) == 0) ? undefined : <div>Must be divisible by 2<sup>{depth}</sup></div>,
        width: depth != undefined && width != 0 && (width % Math.pow(2, depth) == 0) ? undefined : <div>Must be divisible by 2<sup>{depth}</sup></div>,
        depth: depth != undefined && DEPTH_OPTIONS.includes(depth) ? undefined : `The model depth should be one of ${DEPTH_OPTIONS.toString()} to avoid running out of memory`,
        filters: filters != undefined && FILTER_OPTIONS.includes(filters) ? undefined : `The feature detail level should be one of ${FILTER_OPTIONS.toString()}`
    }

    const iconStyle = (field: string) => `shrink-0 size-5 ${field_errors[field] ? "invisible" : "text-success"}`;

    React.useEffect(() => {
        const all_ok = Object.values(field_errors).filter(error => error != undefined).length == 0;

        if (!config) {
            if (status.model_setup != false) {
                status.model_setup = false;
                full_render();
            }

            return;
        }

        if (status.model_setup != all_ok) {
            status.model_setup = all_ok;
            full_render();
        }
    });


    const onChangeUnits = (event: React.ChangeEvent<HTMLInputElement>) => {
        const new_value = Number(event.target.value == "" ? undefined : event.target.value);
        const config = project_config.model.layers.at(0)?.config;

        if (!config) {
            return;
        }

        if (isNaN(new_value)) {
            delete project_config.model.layers.at(0)?.config.units;
            local_render();
            return;
        }

        // when users enter 2, in the backend it's 1 and indicates a binary mask
        config.units = Math.round(new_value) - 1;

        const current_loss_fn = project_config.model.loss_fn;

        if (config.units == 1) {
            if (!current_loss_fn || current_loss_fn == Loss.DICE_CATEGORICAL_CROSS_ENTROPY) {
                project_config.model.loss_fn = Loss.DICE_BINARY_CROSS_ENTROPY;
            } else if (current_loss_fn == Loss.CATEGORICAL_CROSS_ENTROPY) {
                project_config.model.loss_fn = Loss.BINARY_CROSS_ENTROPY;
            }
        } else if (config.units > 1) {
            if (!current_loss_fn || current_loss_fn == Loss.DICE_BINARY_CROSS_ENTROPY) {
                project_config.model.loss_fn = Loss.DICE_CATEGORICAL_CROSS_ENTROPY;
            } else if (current_loss_fn == Loss.BINARY_CROSS_ENTROPY) {
                project_config.model.loss_fn = Loss.CATEGORICAL_CROSS_ENTROPY;
            }
        }

        if (current_loss_fn != project_config.model.loss_fn) {
            full_render();
        } else {
            local_render();
        }
    }


    const onChangeImageShape = (size: number, side: "height" | "width") => {
        if (isNaN(size) || size < 0) {
            size = 0;
        }

        if (size == project_config.model.input_shape[side == "height" ? 0 : 1]) {
            // no change, avoid rerendering
            return;
        }

        project_config.model.input_shape[side == "height" ? 0 : 1] = Math.round(size);
        local_render();
    }


    const onChangeFilters = (new_filters: number) => {
        const config = project_config.model.layers.at(0)?.config;

        if (isNaN(new_filters) || !config || config.filters == new_filters) {
            return;
        }

        config.filters = new_filters;
        local_render();
    }


    const onChangeDepth = (new_depth: number) => {
        const config = project_config.model.layers.at(0)?.config;

        if (!config || config.depth == new_depth) {
            return;
        }

        config.depth = new_depth;
        local_render();
    }

    const explain_image_size = "Images require the same size for batch processing." +
        " Images that do not match your target size will be scaled and randomly cropped" +
        " (preserving aspect ratio) each training pass.\n\nSetting a large size" +
        " will retain fine image detail while a smaller size reduces computational load." +
        " Some common sizes are 256x256 and 512x512."

    return <div className="flex flex-col gap-2">
        <div className="md:grid grid-cols-12 flex flex-col overflow-auto gap-y-2 grow w-full py-1">
            <Dialogue />

            <div className={field_layout_css}>
                <ParamLabel
                    disabled={worker?.isTraining()}
                    error={!!field_errors.units && units != undefined}
                    notify={notify}
                    title="Number of categories"
                    description="The number of distinct objects (including the background) in your dataset to be segmented"
                />
            </div>

            <div className={field_layout_css}>
                <div className="grow">
                    <Input
                        id="segmentation-categories"
                        disabled={worker?.isTraining()}
                        type="text"
                        placeholder="e.g. 184 for the Coco-stuff dataset"
                        value={units == undefined ? "" : units + 1}
                        onChange={onChangeUnits}
                    />
                    {field_errors.units && units != undefined && <span className={error_text_css}>{field_errors.units}</span>}
                </div>
                <Check className={iconStyle("units")} />
            </div>

            <div className={field_layout_css}>
                <ParamLabel
                    disabled={worker?.isTraining()}
                    error={!!field_errors.depth}
                    notify={notify}
                    title="Model depth"
                    description="The number of times the model shrinks the image to learn overall context before expanding it back to find precise detail."
                />
            </div>

            <div className={field_layout_css}>
                <div className="grow">
                    <SelectField
                        id="segmentation-depth"
                        disabled={worker?.isTraining()}
                        value={String(depth)}
                        placeholder="Depth"
                        onValueChange={val => onChangeDepth(Number(val))}
                        options={DEPTH_OPTIONS.map(option => String(option))}
                    />
                    {field_errors.depth && <span className={error_text_css}>{field_errors.depth}</span>}
                </div>
                <Check className={iconStyle("depth")} />
            </div>


            <div className={field_layout_css}>
                <ParamLabel
                    disabled={worker?.isTraining()}
                    error={!!field_errors.filters}
                    notify={notify}
                    title="Feature detail level"
                    description="The base number of unique features the model should learn from images. This is also referred to as filters or kernels."
                />
            </div>

            <div className={field_layout_css}>
                <div className="grow">
                    <SelectField
                        id="segmentation-filters"
                        disabled={worker?.isTraining()}
                        value={String(filters)}
                        placeholder="Filters"
                        onValueChange={val => onChangeFilters(Number(val))}
                        options={FILTER_OPTIONS.map(option => String(option))}
                    />
                    {field_errors.filters && <span className={error_text_css}>{field_errors.filters}</span>}
                </div>
                <Check className={iconStyle("filters")} />
            </div>

            <div className={field_layout_css}>
                <ParamLabel
                    disabled={worker?.isTraining()}
                    error={!!field_errors.height}
                    notify={notify}
                    title="Image height"
                    description={explain_image_size}
                />
            </div>

            <div className={field_layout_css}>
                <div className="grow">
                    <Input
                        id="segmentation-height"
                        disabled={worker?.isTraining()}
                        type="text"
                        placeholder="256px"
                        value={height == 0 ? "" : height}
                        onChange={event => onChangeImageShape(Number(event.target.value), "height")}
                    />
                    {field_errors.height && <span className={error_text_css}>{field_errors.height}</span>}
                </div>
                <Check className={iconStyle("height")} />
            </div>

            <div className={field_layout_css}>
                <ParamLabel
                    disabled={worker?.isTraining()}
                    error={!!field_errors.width}
                    notify={notify}
                    title="Image width"
                    description={explain_image_size}
                />
            </div>

            <div className={field_layout_css}>
                <div className="grow">
                    <Input
                        id="segmentation-width"
                        disabled={worker?.isTraining()}
                        type="text"
                        placeholder="256px"
                        value={width == 0 ? "" : width}
                        onChange={event => onChangeImageShape(Number(event.target.value), "width")}
                    />
                    {field_errors.width && <span className={error_text_css}>{field_errors.width}</span>}
                </div>
                <Check className={iconStyle("width")} />
            </div>


        </div>

        {!isNaN(height * width) && height * width > (Math.pow(512, 2)) && <FieldDescription className="text-warn">
            The total number of pixels, {height}x{width} = {(height * width).toLocaleString()}, is large. Please ensure your device has enough memory to support it.
        </FieldDescription>}
    </div>
}


function ModelType() {
    const { project_config, full_render } = useProject<ProjectConfig>();

    const is_residual = project_config.model.layers.at(0)?.config.residual as boolean | undefined;

    const onModelTypeChange = (value: "unet_classic" | "resunet") => {
        const config = project_config.model.layers.at(0)?.config;

        if (config) {
            config.residual = value == "resunet";
            full_render();
        }
    }

    return <div className="flex flex-col gap-2">
        <h3 className="text-xl">Select model type</h3>

        <RadioGroup defaultValue="plus" className="flex gap-2 text-theme!">

            <FieldLabel htmlFor="segmentation-resunet" className={is_residual ? "border-theme!" : ""}>
                <Field orientation="horizontal" className="cursor-pointer" onClick={() => onModelTypeChange("resunet")}>
                    <FieldContent>
                        <FieldTitle>ResUNet</FieldTitle>
                        <FieldDescription>Incorporates residual connections which transform the U-Net into a ResUNet.</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem checked={is_residual} value="resunet" id="segmentation-resunet" />
                </Field>
            </FieldLabel>

            <FieldLabel htmlFor="segmentation-unet" className={!is_residual ? "border-theme!" : ""}>
                <Field orientation="horizontal" className="cursor-pointer" onClick={() => onModelTypeChange("unet_classic")}>
                    <FieldContent >
                        <FieldTitle>U-Net</FieldTitle>
                        <FieldDescription className="">
                            The classic U-Net introduced in the U-Net: Convolutional Networks for Biomedical Image Segmentation <a className="text-theme hover:text-theme! select-text" href="https://arxiv.org/abs/1505.04597" target="_blank">paper</a>
                        </FieldDescription>
                    </FieldContent>
                    <RadioGroupItem checked={!is_residual} value="unet_classic" id="segmentation-unet" />
                </Field>
            </FieldLabel>

        </RadioGroup>
    </div>
}


function DepthSize() {
    const { project_config, full_render } = React.useContext(ProjectContext);

    const depth = project_config.model.layers.at(0)?.config.depth;

    const onChangeDepth = (new_depth: number) => {
        const config = project_config.model.layers.at(0)?.config;

        if (!config || config.depth == new_depth) {
            return;
        }

        config.depth = new_depth;
        full_render();
    }

    return <div className="flex flex-col gap-1">
        <div className="flex flex-col">
            <h3 className="text-xl">Set model depth</h3>

            <span className="text-sm text-muted-foreground">
                The number of times the model shrinks the image to learn the overall context before expanding it back to find precise detail.
            </span>
        </div>

        <div className="flex gap-2">
            {DEPTH_OPTIONS.map(depth_size => <Button
                id={`segmentation-depth-${depth_size}`}
                onClick={() => onChangeDepth(depth_size)}
                key={depth_size}
                variant="outline"
                className={depth_size == depth ? "bg-theme! text-background hover:text-background" : ""}>
                {depth_size}
            </Button>)}

            {!DEPTH_OPTIONS.includes(depth as number) && <Button
                className="bg-theme! hover:text-background text-background"
                disabled
                variant="outline">
                {depth}
            </Button>}
        </div>
    </div>
}


function NumFilters() {
    const { project_config, full_render } = React.useContext(ProjectContext);
    const filters = project_config.model.layers.at(0)?.config.filters;

    const onChangeFilters = (new_filters: number) => {
        const config = project_config.model.layers.at(0)?.config;

        if (!config || config.filters == new_filters) {
            return;
        }

        config.filters = new_filters;
        full_render();
    }

    return <div className="flex flex-col gap-1">
        <div className="flex flex-col">
            <h3 className="text-xl">Set feature detail level</h3>

            <span className="text-sm text-muted-foreground">
                The base number of unique features the model should learn from images.
            </span>
        </div>

        <div className="flex gap-2">
            {FILTER_OPTIONS.map(filter_count => <Button
                id={`segmentation-filters-${filter_count}`}
                onClick={() => onChangeFilters(filter_count)}
                key={filter_count}
                variant="outline"
                className={filter_count == filters ? "bg-theme! text-background hover:text-background" : ""}>
                {filter_count}
            </Button>)}

            {!FILTER_OPTIONS.includes(filters as number) && <Button
                className="bg-theme! hover:text-background text-background"
                disabled
                variant="outline">
                {filters}
            </Button>}
        </div>
    </div>
}
