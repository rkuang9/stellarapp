import React from "react";

import {
    Camera,
    Play,
    Trash
} from "lucide-react";

import { Container } from "@/features/training/container";
import { useProject } from "@/features/training/project-contexts";
import { toaster } from "@/components/toaster";
import { abbreviatedCount, argMax, freeImage, wait } from "@/lib/utility";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Gallery, GalleryImage } from "@/features/training/image_classification/gallery";
import ImageModelWorker from "@/lib/webworker/image_client";
import type ProjectConfig from "@/lib/data-processing/project_config";
import { downloadModel } from "@model-io";


export default function Inference() {
    const { project_config, worker, meta, cache } = useProject<ProjectConfig>();
    const [download_progress, setDownloadProgress] = React.useState<number | undefined>(undefined);
    const [loaded_images, setLoadedImages] = React.useState<{ url: string, prediction: number[] }[]>([]);


    const downloadCloudModel = async () => {
        if (!downloadModel) {
            return;
        }

        toaster.info("Downloading model files");

        const { model_json, weights_bin } = await downloadModel({
            username: meta.project!.username,
            project_name: meta.project!.project_name,
            callback: event => {
                setDownloadProgress(event.loaded / event.total!);
            }
        })

        cache.cloud_model_state = "downloaded";
        // keep the download indicator at 100% for a little longer for
        // the user to see that it completed
        wait(2_000).then(() => setDownloadProgress(undefined));

        const { parameters } = await worker!.load({ model_json, weights_bin, project_config });

        toaster.success(`Loaded model with ${abbreviatedCount(parameters, 2)} parameters`);
    }


    const onClear = () => {
        if (loaded_images.length == 0) {
            return;
        }

        for (const { url } of loaded_images) {
            freeImage(url);
        }

        setLoadedImages([]);
    }


    const onImagesLoad = async (images: Blob[]) => {
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


    const makePrediction = (images: Blob[]) => {
        if (images.length == 0) {
            return;
        }

        (worker as ImageModelWorker)?.predict({
            inputs: images,
            batch_size: project_config.model.batch_size,
            backend: project_config.model.backend,
            input_shape: project_config.model.input_shape
        }).then(predictions => {
            if (predictions.length == 0) {
                toaster.error(`Zero predictions were made`);
                return;
            }

            const new_images: { url: string; prediction: number[] }[] = [];

            for (let i = 0; i < predictions.length; i++) {
                new_images.push({
                    url: URL.createObjectURL(images[i]),
                    prediction: predictions[i]
                })
            }

            setLoadedImages([...new_images, ...loaded_images]);

        }).catch(error => {
            toaster.error(`An error occurred while making a prediction: ${error.toString()}`);
        })
    }


    return <Container
        id="inference"
        heading={`Inference`}
        subheading={`Classify images directly in the browser ${download_progress != undefined ? `(Downloading model files...${(download_progress * 100).toFixed(0)}%)` : ""}`}
        className="h-full grow flex flex-col"
        icon={Play}
    >
        <div className="flex flex-col gap-2 grow overflow-auto">
            <div className="grow-10 flex flex-col overflow-auto">
                <ImageClassificationInference
                    images={loaded_images}
                    onehotEncoding={project_config.preprocessing.onehot_encoding}
                    onChange={onImagesLoad}
                    onClear={onClear} />
            </div>
        </div>
    </Container>
}


function ImageClassificationInference({ images, onehotEncoding, onChange, onClear }: {
    images: { url: string, prediction: number[] }[];
    onChange: (images: Blob[]) => void;
    onClear: () => void;
    onehotEncoding: { [key: string]: number }
}) {
    const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
        onChange(loadImages(event.clipboardData.items))
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        onChange(loadImages(event.dataTransfer.items));
    }

    const onLoadImages = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            onChange([...event.target.files]);
        }
    }

    const categories = Object.fromEntries(Object.entries(onehotEncoding).map(([key, value]) => [value, key]));

    return <div className="flex flex-col grow gap-2 overflow-auto">
        <div className="flex gap-2">
            <Button variant="outline" className="cursor-pointer grow sm:grow-0 border-theme! px-6!" asChild>
                <Label htmlFor="load-inference-images" className="cursor-pointer">
                    <Camera />Load images
                </Label>
            </Button>

            <input hidden id="load-inference-images" type="file" accept="image/*" multiple onChange={onLoadImages} />

            <Button onClick={onClear} id="clear-image-predictions" variant="outline" className="cursor-pointer hidden sm:flex ring-0 focus:ring-0!">
                <Trash className="text-error" />Clear
            </Button>

            <Button onClick={onClear} id="clear-image-predictions-mobile" variant="outline" className="cursor-pointer flex sm:hidden ring-0 focus:ring-0!" size="icon">
                <Trash className="text-error" />
            </Button>
        </div>

        <Gallery
            className="grid-cols-12 overflow-auto h-full bg-muted p-2 rounded-md"
            onDragOver={event => event.preventDefault()}
            onPaste={onPaste}
            onDrop={onDrop}
        >
            {images.length > 0
                ? images.map((image, index) => {
                    const max_index = argMax(image.prediction);
                    const category = categories[max_index];
                    const top_prediction_pretty = `${(image.prediction[max_index] * 100).toFixed(2)}%`;

                    return (<div key={index} id={`prediction-${index}`} className="col-span-4 md:col-span-3 lg:col-span-2 flex flex-col gap-2">
                        <GalleryImage src={image.url} alt={image.url} />
                        <div className="flex flex-col">
                            <span id={`prediction-${index}-category`} className="text-lg truncate">{category}</span>
                            <span id={`prediction-${index}-score`} className="text-sm truncate">{top_prediction_pretty}</span>
                        </div>
                    </div>)
                })
                : <label htmlFor="load-inference-images" className="border border-dashed rounded-md col-span-12 flex justify-center items-center text-muted-foreground cursor-pointer">
                    Drag and drop or paste images here for classification
                </label>}
        </Gallery>
    </div >
}


function loadImages(images: DataTransferItemList): Blob[] {
    const loaded: Blob[] = [];
    const img: string[] = Object.keys(images);

    for (const i in img) {
        if (images[i].type && images[i].type.startsWith("image")) {
            const blob = images[i].getAsFile();

            if (blob) {
                loaded.push(blob);
            }
        }
    }

    return loaded;
}
