import React from "react";

import {
    Camera,
    Palette,
    Play,
    Trash2
} from "lucide-react";

import { Container } from "@/features/training/container";
import { useProject } from "@/features/training/project-contexts";
import { toaster } from "@/components/toaster";
import { abbreviatedCount, freeImage, wait } from "@/lib/utility";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Gallery, GalleryImageCaptioned } from "@/features/training/image_classification/gallery";
import SegmentationModelWorker from "@/lib/webworker/segmentation_client";
import useRender from "@/components/use-render";
import { useDialogue } from "@/components/dialogue";
import { tiffToPNG } from "@/lib/data-processing/dataset_segmentation";
import { useSidebar } from "@/components/ui/sidebar";
import type ProjectConfig from "@/lib/data-processing/project_config";
import { downloadModel } from "@/features/training/model_io";


export default function Inference() {
    const { project_config, worker, meta, cache } = useProject<ProjectConfig>();
    const [download_progress, setDownloadProgress] = React.useState<number | undefined>(undefined);
    const [colorize, setColorize] = React.useState<boolean>(true);
    const predictions = React.useRef<{ [filename: string]: { image_url?: string, mask_url?: string } }>({});
    const local_render = useRender();
    const { notify, Dialogue } = useDialogue();
    const unet_depth = project_config.model.layers.at(0)?.config.depth as number | undefined;

    const downloadCloudModel = async () => {
        if (!downloadModel) {
            return;
        }

        const { model_json, weights_bin } = await downloadModel({
            username: meta.project!.username,
            project_name: meta.project!.project_name,
            callback: event => setDownloadProgress(event.loaded / event.total!)
        })

        cache.cloud_model_state = "downloaded";
        // keep the download indicator at 100% for a little longer for
        // the user to see that it completed
        wait(2_000).then(() => setDownloadProgress(undefined));

        const { parameters } = await worker!.load({ model_json, weights_bin, project_config });

        toaster.success(`Loaded model with ${abbreviatedCount(parameters, 2)} parameters`);
    }


    // release the image and mask blobs for garbage collection and reset the predictions object
    const onClear = () => {
        if (Object.keys(predictions.current).length == 0) {
            return;
        }

        for (const i in predictions.current) {
            const { image_url, mask_url } = predictions.current[i];

            if (image_url) {
                freeImage(image_url);
            }

            if (mask_url) {
                freeImage(mask_url);
            }

            delete predictions.current[i];
        }

        predictions.current = {};
        local_render();
    }


    const onImagesLoad = async (images: File[]) => {
        if (!worker) {
            toaster.error("Failed to create a web worker. Please ensure your browser supports them and try reloading this page.");
            return;
        }

        if (meta.project && !worker?.isBuilt() && cache.cloud_model_state == "can_download" && downloadModel) {
            downloadCloudModel().then(() => {
                makePrediction(images);
            }).catch(error => {
                setDownloadProgress(undefined);
                cache.cloud_model_state = "error";
                toaster.error(`Error while downloading the model: ${error.toString()}`);
            });

            return;
        }

        if (!worker.isBuilt()) {
            toaster.error("The model needs to be trained before inference is available")
            return;
        }

        makePrediction(images);
    }


    const makePrediction = async (images: File[]) => {
        if (images.length == 0) {
            return;
        }

        if (unet_depth == undefined) {
            notify({
                title: "Model depth unknown",
                description: "Model depth must be set before inference to ensure the model can properly transform the input image.",
            })
            return;
        }


        for (const image of images) {
            if (!predictions.current[image.name]) {
                predictions.current[image.name] = {};
            }

            try {
                predictions.current[image.name].image_url = URL.createObjectURL(
                    image.type == "image/tiff" ? await tiffToPNG(image) : image);
                // local_render();
            } catch (error: any) {
                notify({
                    title: "Error loading image",
                    description: `An error occurred loading ${image.name}: ${error.toString()}`
                })
                break;
            }

            await (worker as SegmentationModelWorker)?.predict({
                inputs: image,
                batch_size: project_config.model.batch_size,
                backend: project_config.model.backend,
                depth: unet_depth,
                colorize,
            }).then(predicted => {
                if (predicted) {
                    predictions.current[image.name].mask_url = URL.createObjectURL(predicted);
                    local_render();
                }
            }).catch(error => {
                notify({
                    title: "An error occurred during inference",
                    description: error.toString()
                })
            })
        }
    }


    const onChangeColorize = (color: boolean) => {
        setColorize(color);
    }


    return <Container
        id="inference"
        heading="Predict"
        subheading={`Run image segmentation directly in the browser. You can add color to distinguish segmented categories or just receive the raw outputs. ${download_progress != undefined ? `(Downloading model files...${(download_progress * 100).toFixed(0)}%)` : ""}`}
        className="h-full grow flex flex-col"
        icon={Play}
    >
        <Dialogue />

        <div className="flex flex-col gap-2 grow overflow-auto">
            <div className="grow-10 flex flex-col overflow-auto">
                <DisplaySegmentationInferences
                    disabled={worker?.isTraining()}
                    images={predictions.current}
                    onehotEncoding={project_config.preprocessing.onehot_encoding}
                    onChange={onImagesLoad}
                    onClear={onClear}
                    colorize={colorize}
                    onChangeColorize={onChangeColorize}
                />
            </div>
        </div>
    </Container>
}


function DisplaySegmentationInferences({ images, onChange, onClear, disabled, colorize, onChangeColorize }: {
    images: { [filename: string]: { image_url?: string, mask_url?: string } };
    onChange: (images: File[]) => void;
    onClear: () => void;
    onehotEncoding: { [key: string]: number };
    colorize: boolean;
    onChangeColorize: (color: boolean) => void;
    disabled?: boolean;
}) {
    const { isMobile } = useSidebar();

    const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();

        if (disabled) {
            return;
        }

        onChange(loadImages(event.clipboardData.items))
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        if (disabled) {
            return;
        }

        onChange(loadImages(event.dataTransfer.items));
    }

    const onLoadImages = (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();

        if (disabled) {
            return;
        }

        if (event.target.files) {
            onChange([...event.target.files]);
        }
    }

    const files = Object.keys(images);

    return <div className="flex flex-col grow gap-2 overflow-auto">
        <div className={`flex gap-4 sm:gap-2 ${isMobile ? "justify-between" : ""}`}>
            <Button disabled={disabled} variant="outline" className={`cursor-pointer grow-0 md:grow-0 px-6! disabled:pointer-events-none disabled:opacity-50 ${disabled ? "" : "border-theme!"}`} asChild>
                <Label htmlFor="load-segmentation-images" className={`cursor-pointer ${disabled ? "opacity-50" : ""}`}>
                    <Camera />Load images
                </Label>
            </Button>

            <input disabled={disabled} hidden id="load-segmentation-images" type="file" accept="image/*" multiple onChange={onLoadImages} />

            <div className="flex gap-4 sm:gap-2">
                <Button disabled={disabled} onClick={() => onChangeColorize(!colorize)} id="segmentation-colorize" variant="outline" className={`cursor-pointer`}>
                    <Palette className={colorize ? "text-theme" : "text-muted-foreground"} />
                    {!isMobile && <span className={colorize ? "" : "text-muted-foreground"}>Colorize</span>}
                </Button>

                <Button disabled={disabled} onClick={onClear} id="clear-image-predictions" variant="outline" className="cursor-pointer">
                    <Trash2 className="text-error" />
                    {!isMobile && <span>Clear</span>}
                </Button>
            </div>
        </div>

        <Gallery
            onDragOver={event => event.preventDefault()}
            onPaste={onPaste}
            onDrop={onDrop}
            columns={4} className={`grid-cols-12 overflow-auto h-full bg-muted p-2 rounded-md`}>
            {files.length > 0
                ? files.map(filename => <React.Fragment key={filename}>
                    <GalleryImageCaptioned
                        id={`image-${filename}`}
                        className="col-span-3 lg:col-span-2"
                        src={images[filename].image_url}
                        title={`Image: ${filename}`}
                        alt={`Image: ${filename}`}
                        caption={filename}
                    />
                    <GalleryImageCaptioned
                        id={`mask-${filename}`}
                        className="text-muted-foreground text-sm wrap-break-word col-span-3 lg:col-span-2"
                        src={images[filename].mask_url}
                        title={`Mask: ${filename}`}
                        alt={`Mask: ${filename}`}
                        caption={filename}
                    />
                </React.Fragment>)
                : <label htmlFor="load-inference-images" className="border border-dashed rounded-md col-span-12 flex justify-center items-center text-muted-foreground cursor-pointer">
                    Drag and drop or paste images to segment
                </label>}

        </Gallery>
    </div >
}


function loadImages(images: DataTransferItemList): File[] {
    const loaded: File[] = [];
    const img: string[] = Object.keys(images);

    for (const i in img) {
        if (images[i].type && images[i].type.startsWith("image")) {
            const file = images[i].getAsFile();

            if (file) {
                loaded.push(file);
            }
        }
    }

    return loaded;
}
