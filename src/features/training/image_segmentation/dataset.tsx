"use client"

import React from "react";

import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ExternalLink,
    FileText,
    Folder,
    Info,
    Trash2
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button";

import { useDialogue } from "@/components/dialogue";
import { Container } from "@/features/training/container";

import { ProjectContext, useProject } from "@/features/training/project-contexts";
import { Gallery, GalleryImage } from "@/features/training/image_classification/gallery";
import { SegmentationContext } from "@/features/training/image_segmentation/segmentation-contexts";
import { ImageType, MASK_SUFFIXES } from "@/lib/data-processing/dataset_segmentation";


const IMAGES_PER_PAGE = 24;


function CocoLink() {
    return <span>
        Don&apos;t have a dataset? Try <a
            className="text-theme underline inline-flex items-center gap-1"
            href="https://cocodataset.org/#download"
            target="_blank"
        >
            COCO-Stuff <ExternalLink size={16} />
        </a>.
    </span>
}


export default function Dataset() {
    const { status, segmentationset } = React.useContext(SegmentationContext);
    const { full_render, worker } = useProject();

    const [page, setPage] = React.useState<number>(0);
    const { Dialogue, notify, confirmation } = useDialogue();

    const max_page = Math.max(Math.ceil(segmentationset.files.length / IMAGES_PER_PAGE) - 1, 0); // start from zero

    React.useEffect(() => {
        let all_ok = true;

        if (segmentationset.size == 0) {
            all_ok = false;
        }

        if (status.dataset != all_ok) {
            status.dataset = all_ok;
            full_render();
        }
    });


    const onPageChange = (direction: "previous" | "next" | "start" | "end") => {

        if (direction == "previous") {
            setPage(page == 0 ? 0 : page - 1);
        } else if (direction == "next") {
            setPage(page == max_page ? page : page + 1);
        } else if (direction == "start") {
            setPage(0)
        } else {
            setPage(max_page);
        }

    }

    const removeAllImages = async () => {
        if (await confirmation({ title: "Clear dataset", description: "Are you sure you want to remove all images?" })) {
            segmentationset.reset();

            if (page != 0) {
                setPage(0);
            } else {
                full_render();
            }
        }
    }


    const showMaskExplanation = () => {
        notify({
            title: "What are segmentation masks?",
            description: "Segmentation masks are single channel (greyscale) images where" +
                " objects of interest are encoded with pixel value (e.g. 0 for person, 1 for road, 2 for tree)." +
                "\n\nIf there are very few objects to segment, the pixel values remain close to 0, resulting in a black image." +
                "\n\nSome images contain a color palette to visually translate encoded pixels to presentable colors."
        });
    }

    const showCommonSuffixes = () => {
        notify({
            title: "Image and segmentation mask naming",
            description: <div className="text-sm text-muted-foreground flex flex-col gap-2">
                Images and their segementation mask should be named identically
                (excluding file extension). However, some datasets add a suffix such as
                <ul className="list-inside list-disc text-sm pl-4">
                    <li>tree_000001.jpg</li>
                    <li>tree_000001_seg.png</li>
                </ul>

                <span>The following common suffixes are recognized</span>

                <ul className="list-inside list-disc text-sm pl-4">
                    {MASK_SUFFIXES.map(suffix => <li key={suffix}>{suffix}</li>)}
                </ul>

                <span>For example, the following files are considered image & mask pairs</span>

                <ul className="list-inside list-disc text-sm pl-4">
                    <li>TCGA_CS_4941_19960909_1.tif</li>
                    <li>TCGA_CS_4941_19960909_1<span className="font-extrabold text-theme">_seg</span>.tif</li>
                </ul>
                <ul className="list-inside list-disc text-sm pl-4">
                    <li>TCGA_CS_4941_19960909_2.tif</li>
                    <li>TCGA_CS_4941_19960909_2<span className="font-extrabold text-theme">_mask</span>.tif</li>
                </ul>
            </div>
        })
    }

    const incomplete_pairs = segmentationset.files.length - segmentationset.size;

    return <Container
        id="dataset"
        heading="Load Images and Masks"
        subheading={<span>
            Load your image and segmentation mask folders separately. Ensure your image and segmentation masks are named identically or differ by a <span
                className="text-theme hover:cursor-pointer inline-flex gap-1 items-center"
                onClick={showCommonSuffixes}
            >
                common suffix <Info size={16} className="select-none" />
            </span>. <CocoLink />
        </span>}
        icon={FileText}
        className="flex flex-col h-11/12 gap-2"
        contentClassName=""
    >
        <Dialogue />

        <div className="flex flex-col gap-2 overflow-auto grow-2">
            <div className="flex flex-col gap-4">
                <span className="text-sm text-muted-foreground w-fit" onClick={showMaskExplanation}>
                    What are <span className="text-theme hover:cursor-pointer">
                        segmentation masks and why might they be entirely black?
                        <Info className="select-none inline-flex ml-1 mb-1" size={16} />
                    </span>
                </span>

                <div className="flex gap-2 flex-wraqp">
                    <div className="min-w-0 grow basis-0 lg:basis-auto lg:grow-0 flex flex-col gap-2">
                        <LoadDataset type="image" disabled={worker?.isTraining()} />
                    </div>

                    <div className="min-w-0 grow basis-0 lg:basis-auto lg:grow-0 flex flex-col gap-2">
                        <LoadDataset type="mask" disabled={worker?.isTraining()} />
                    </div>

                    <Button
                        title="Clear dataset"
                        variant="outline"
                        className="hover:cursor-pointer" disabled={segmentationset.files.length == 0 || worker?.isTraining()}
                        onClick={removeAllImages}
                    >
                        <Trash2 className="text-error" />
                    </Button>
                </div>
            </div>


            <Gallery columns={4} className="grid-cols-12 overflow-auto h-full bg-muted p-2 rounded-md">
                {segmentationset.files
                    .slice(page * IMAGES_PER_PAGE, page * IMAGES_PER_PAGE + IMAGES_PER_PAGE)
                    .map(name => <React.Fragment key={name}>
                        <div className="flex flex-col gap-2 col-span-3 lg:col-span-2">
                            <LazyImage cleanedName={name} type="image" />
                        </div>
                        <div className="flex flex-col gap-2 col-span-3 lg:col-span-2">
                            <LazyImage cleanedName={name} type="mask" />
                        </div>
                    </React.Fragment>)}
            </Gallery>

            <div className="flex flex-wrap-reverse gap-4 justify-end items-center">
                <div className="flex gap-4 items-center justify-end">
                    <div className="flex gap-2">
                        <Button
                            disabled={page == 0 || worker?.isTraining()}
                            onClick={() => onPageChange("start")}
                            className="cursor-pointer"
                            variant="outline"
                            size="icon-sm">
                            <ChevronsLeft />
                        </Button>

                        <Button disabled={page <= 0 || worker?.isTraining()}
                            onClick={() => onPageChange("previous")}
                            className="cursor-pointer"
                            variant="outline"
                            size="icon-sm">
                            <ChevronLeft />
                        </Button>
                    </div>

                    <span className="text-muted-foreground text-sm">{page + 1} / {max_page + 1}</span>

                    <div className="flex gap-2">
                        <Button
                            disabled={page >= max_page || worker?.isTraining()}
                            onClick={() => onPageChange("next")}
                            className="cursor-pointer"
                            variant="outline"
                            size="icon-sm">
                            <ChevronRight />
                        </Button>

                        <Button
                            disabled={page >= max_page || worker?.isTraining()}
                            onClick={() => onPageChange("end")}
                            className="cursor-pointer"
                            variant="outline"
                            size="icon-sm">
                            <ChevronsRight />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col text-sm text-muted-foreground">
                <span>Complete image-mask pairs: {segmentationset.size.toLocaleString()}</span>
                {incomplete_pairs > 0 && <span className="text-error">Incomplete image-mask pairs: {(incomplete_pairs).toLocaleString()} (will be excluded during training)</span>}
            </div>
        </div>

    </Container>
}


function LazyImage({ cleanedName, type }: { cleanedName: string, type: ImageType }) {
    const { segmentationset } = React.useContext(SegmentationContext);
    const [loaded, setLoaded] = React.useState<boolean>(false);

    const image_pair = segmentationset.get(cleanedName);

    const file_true_name = image_pair?.[type]?.name ?? "";
    const file = image_pair?.[type];
    const file_url = image_pair?.[`${type}_url`];

    // load the image into memory
    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        if (loaded || !cleanedName || !file) {
            return;;
        }

        if (file_url) {
            setLoaded(true);
            return;
        }

        if (!file_url) { // but image file exists
            segmentationset.lazyDisplayImage(cleanedName, type).then(result => {
                setLoaded(true);
            }).catch(error => {
                setLoaded(true);
            })
        }
    }, [loaded])
    /* eslint-enable react-hooks/exhaustive-deps */

    return <>
        <GalleryImage
            className="text-muted-foreground text-sm wrap-break-word"
            src={file_url} title={file_true_name ?? cleanedName}
            alt={loaded
                ? `File ${file_true_name ?? cleanedName} has an image format not supported by the browser for display`
                : file ? `Loading ${file_true_name}` : `Missing ${type == "image" ? "image" : "segmentation mask"}`}
        />
        {file_true_name && <span title={file_true_name} className="text-xs truncate first-letter:uppercase">{type}: {file_true_name}</span>}
    </>
}


function LoadDataset({ type, disabled }: { type: ImageType, disabled?: boolean; }) {
    const { segmentationset } = React.useContext(SegmentationContext);
    const { full_render } = useProject();
    const { Dialogue, notify } = useDialogue();


    const handleImageDataset = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files ||
            event.target.files.length == 0 ||
            [...event.target.files].filter(file => (
                file.type.includes("image") || // production
                process.env.NODE_ENV != "production" && ["jpg", "png", "tiff"].includes(file.name.split(".")[1]) // playwright test image loading
            )).length == 0) {
            notify({
                title: "Empty folder",
                description: "No images were found in this folder"
            });
            return;
        }

        const files = [...event.target.files].filter(file => file.type.includes("image")).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))


        try {
            if (type == "mask") {
                await segmentationset.loadMask(files);
            } else {
                await segmentationset.loadImage(files);
            }
        } catch (error: any) {
            notify({
                title: "Error loading images",
                description: `An error occurred while loading images: ${error.toString()}`
            })
        }

        full_render();
    }

    return (
        <>
            <Dialogue />
            <Button
                id={`load-${type}-button`}
                variant="outline"
                asChild
                disabled={disabled}
                className={`border-theme text-muted-foreground hover:text-muted-foreground`}
            >
                <label
                    id="load-dataset-label"
                    htmlFor={`load-${type}-folder`}
                    className="flex items-center gap-2 cursor-pointer w-full"
                >
                    <Folder className="text-theme" />

                    <span className="truncate min-w-0 flex-1 text-start">
                        {type == "image" ? "Load images folder" : "Load masks folder"}
                    </span>
                </label>
            </Button>

            <Input
                value=""
                disabled={disabled}
                onChange={handleImageDataset}
                {...{ webkitdirectory: "" }}
                hidden
                id={`load-${type}-folder`}
                multiple
                type="file"
            />

            <Input hidden value="" disabled id={`load-${type}-folder-playwright`} multiple type="file" onChange={handleImageDataset} />
        </>
    );
}
