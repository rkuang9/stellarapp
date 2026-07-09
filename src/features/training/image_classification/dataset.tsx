"use client"

import React from "react";

import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    FileText,
    Folder,
    Search,
    Trash2
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button";

import { useDialogue } from "@/components/dialogue";
import { toaster } from "@/components/toaster";
import { MultiSelect, MultiSelectOption } from "@/components/custom/multi-select";
import { Container } from "@/features/training/container";

import { ImageContext } from "@/features/training/image_classification/image-contexts";
import { useProject } from "@/features/training/project-contexts";
import ImageDataset, { ImageView } from "@/lib/data-processing/dataset_image";
import { getImageShape } from "@/lib/utility_browser";
import { Gallery, GalleryImage } from "@/features/training/image_classification/gallery";
import { SelectField } from "@/components/custom/select-field";

import { DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import type ProjectConfig from "@/lib/data-processing/project_config";


const IMAGES_PER_PAGE = 24;


export default function Dataset() {
    const { status, imageset } = React.useContext(ImageContext);
    const { project_config, full_render, worker } = useProject<ProjectConfig>();
    const [image_view, setImageView] = React.useState<ImageView[]>([]);
    const [pagination, setPagination] = React.useState<{ category?: string, page: number }>({ category: undefined, page: 0 });
    const max_pages = pagination.category ? Math.ceil(imageset.category(pagination.category).length / IMAGES_PER_PAGE) - 1 : 0;


    React.useEffect(() => {
        let all_ok = true;

        if (project_config.preprocessing.input_cols.length == 0) {
            all_ok = false;
        }

        if (imageset.size == 0) {
            all_ok = false;
        }

        if (status.dataset != all_ok) {
            status.dataset = all_ok;
            full_render();
        }
    });


    React.useEffect(() => {
        if (pagination.category && !imageset.categories.includes(pagination.category)) {
            setPagination({ category: undefined, page: 0 });
        } else if (!pagination.category && imageset.categories.length > 0) {
            setPagination({ ...pagination, category: imageset.categories[0] })
        }
    }, [pagination, imageset.categories])


    /* eslint-disable react-hooks/exhaustive-deps */
    React.useEffect(() => {
        if (!pagination.category) {
            setImageView([]);
            return;
        }

        if (pagination.category && pagination.page >= 0 && pagination.page <= max_pages) {
            imageset.images(pagination.category, (pagination.page * IMAGES_PER_PAGE), IMAGES_PER_PAGE).then(images => setImageView([...images]));
        }
    }, [pagination.category, pagination.page]);
    /* eslint-enable react-hooks/exhaustive-deps */


    const onCategoryChange = (category: string) => {
        setPagination({ ...pagination, category })
    }


    const onPageChange = (direction: "previous" | "next" | "start" | "end") => {
        if (!pagination.category) {
            return;
        }

        if (direction == "previous") {
            setPagination({ ...pagination, page: pagination.page > 0 ? pagination.page - 1 : 0 })
        } else if (direction == "next") {
            setPagination({ ...pagination, page: pagination.page < max_pages ? pagination.page + 1 : max_pages })
        } else if (direction == "start") {
            setPagination({ ...pagination, page: 0 })
        } else {
            setPagination({ ...pagination, page: max_pages })
        }
    }

    const onChangePredictCategories = (category: string) => {
        if (!project_config.preprocessing.input_cols.includes(category)) {
            project_config.preprocessing.input_cols.push(category)
        } else {
            project_config.preprocessing.input_cols =
                project_config.preprocessing.input_cols.filter(existing => existing != category);
        }

        full_render();
    }


    const clearPredictionCategories = () => {
        project_config.preprocessing.input_cols = [];
        full_render();
    }

    return <Container
        id="dataset"
        heading="Select Training Data"
        subheading="Choose the image categories for the vision model to train on."
        icon={FileText}
        className="flex flex-col h-11/12 gap-2"
        contentClassName=""
    >
        <div className="flex flex-col gap-2 overflow-auto grow-2">
            <div className="flex gap-2 flex-wraqp">
                <div className="min-w-0 grow basis-0 lg:basis-auto lg:grow-0 flex flex-col gap-2">
                    <LoadDataset />
                </div>


                <div className="min-w-0 grow basis-0 shrink-0 lg:basis-auto lg:grow-0 flex flex-col gap-2">
                    <SelectField
                        disabled={worker?.isTraining()}
                        icon={<Search />}
                        label="Show image category"
                        placeholder="Show image category"
                        value={pagination.category ?? ""}
                        options={[...imageset.categories]}
                        onValueChange={onCategoryChange}
                    />
                </div>
            </div>


            <div className="flex gap-2 grow-3 min-w-0 items-end justify-between">
                <MultiSelect
                    disabled={worker?.isTraining()}
                    id="target-cols"
                    maxRows={3}
                    className={`${project_config.preprocessing.input_cols.length == 0 ? "text-muted-foreground hover:text-muted-foreground" : ""}`}
                    label={project_config.preprocessing.input_cols.length == 0 ? imageset.categories[0] ?? "Select target prediction categories" : project_config.preprocessing.input_cols.join(", ")}
                >
                    <DropdownMenuLabel className="select-none">Select target prediction categories</DropdownMenuLabel>
                    {project_config.preprocessing.input_cols.length > 0 && <MultiSelectOption onClick={clearPredictionCategories} className="cursor-pointer">
                        <Trash2 className="text-error" />Clear all selections
                    </MultiSelectOption>}

                    {imageset.categories.map(category => (
                        <MultiSelectOption
                            className={
                                project_config.preprocessing.input_cols.includes(category)
                                    ? "bg-elevated-2! hover:bg-elevated-2 cursor-pointer"
                                    : "cursor-pointer"
                            }
                            onClick={() => onChangePredictCategories(category)}
                            key={category}
                        >
                            {category}
                        </MultiSelectOption>
                    ))}
                </MultiSelect>
            </div>


            <Gallery className="grid-cols-12 overflow-auto h-full bg-muted p-2 rounded-md">
                {image_view.map((img, index) => <GalleryImage key={img.path + index} className="col-span-4 md:col-span-3 lg:col-span-2" src={img.url} alt={img.path} />)}
            </Gallery>


            <div className="flex gap-4 justify-between md:justify-end items-center">
                <div className="flex gap-2">
                    <Button
                        disabled={pagination.page == 0 || worker?.isTraining()}
                        onClick={() => onPageChange("start")}
                        className="cursor-pointer"
                        variant="outline"
                        size="icon-sm">
                        <ChevronsLeft />
                    </Button>

                    <Button disabled={pagination.page <= 0 || worker?.isTraining()}
                        onClick={() => onPageChange("previous")}
                        className="cursor-pointer"
                        variant="outline"
                        size="icon-sm">
                        <ChevronLeft />
                    </Button>
                </div>

                <span className="text-muted-foreground text-sm">{pagination.page + 1} / {max_pages + 1}</span>

                <div className="flex gap-2">
                    <Button
                        disabled={pagination.page >= max_pages || worker?.isTraining()}
                        onClick={() => onPageChange("next")}
                        className="cursor-pointer"
                        variant="outline"
                        size="icon-sm">
                        <ChevronRight />
                    </Button>

                    <Button
                        disabled={pagination.page >= max_pages || worker?.isTraining()}
                        onClick={() => onPageChange("end")}
                        className="cursor-pointer"
                        variant="outline"
                        size="icon-sm">
                        <ChevronsRight />
                    </Button>
                </div>
            </div>
        </div>

    </Container>
}


function LoadDataset() {
    const { imageset } = React.useContext(ImageContext);
    const { project_config, full_render, worker } = useProject<ProjectConfig>();
    const { notify, Dialogue, confirmation } = useDialogue();
    const [filename, setFilename] = React.useState<string>("");


    const handleImageDataset = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length < 1) {
            return;
        }

        const file = event.target.files[0];

        if (file.type != "application/zip" && file.type != "application/x-zip-compressed") {
            notify(`The dataset file type is unsupported: ${file.type}`);
            setFilename("");
            return;
        }

        toaster.info(`Loading ${file.name}...`);

        ImageDataset.load(file, true).then(async loaded_imset => {
            const categories = loaded_imset.categories;

            if (loaded_imset.categories.length < 2) {
                notify({
                    title: "Insufficient dataset",
                    description: `Datasets require at least 2 image categories.`
                })

                return;
            }

            if (loaded_imset.size == 0) {
                notify({
                    title: "Empty dataset",
                    description: `No images were found in this dataset.`
                })

                return;
            }

            const invalid_classes = project_config.preprocessing.input_cols.filter(col => !categories.includes(col));

            if (invalid_classes.length > 0) {
                const ask = await confirmation({
                    title: "Conflicting image categories",
                    description: `Some of your category prediction targets were not found in this dataset. Would you like to replace them and continue?\n\n` +
                        `Invalid image categories: ${[...new Set(invalid_classes)].join(", ")}`,
                    yes: "Replace and continue",
                    no: "Cancel"
                });

                if (ask) {
                    project_config.preprocessing.input_cols = categories;
                } else {
                    // do not load the image dataset
                    return;
                }
            }

            // handle the image shape which is taken from the first image, notify the user
            // that changing it requires retraining
            const { path: first_image_path } = (await loaded_imset.images(loaded_imset.categories[0], 0, 1))[0];
            const [new_height, new_width] = await getImageShape(await loaded_imset.blob(first_image_path));

            if (project_config.model.input_shape.length > 0) {
                const [current_height, current_width, current_channels] = project_config.model.input_shape;

                if (new_height != current_height || new_width != current_width || current_channels != 3) {
                    if (worker?.isBuilt() && await confirmation({
                        title: "Image shape changed",
                        description: `A new image shape of [${new_height}, ${new_width}, 3] was detected from this dataset.` +
                            ` Should this new image shape be used for training?\n\n` +
                            `Images are resized to a common shape for model training. Changing it may require training a new model.`,
                        yes: "Use new shape",
                        no: `No, continue using [${current_height}, ${current_width}, ${current_channels}]`
                    })) {
                        project_config.model.input_shape = [new_height, new_width, 3];
                    }
                }
            } else {
                project_config.model.input_shape = [new_height, new_width, 3];
            }

            imageset.from(loaded_imset);

            if (project_config.preprocessing.input_cols.length == 0) {
                project_config.preprocessing.input_cols = categories;
            }

            setFilename(file.name);
            toaster.success(`Loaded image dataset with ${imageset.size} images`);
            full_render();

        }).catch(error => {
            notify(`Failed to load ${file.name}: ${error.toString()}`);
            setFilename("");
        });
    }


    return (
        <>
            <Dialogue />

            <Button
                id="load-images-button"
                variant="outline"
                asChild
                className={`${imageset.size == 0 ? "border-theme!" : ""} ${worker?.isTraining() ? "text-muted-foreground hover:text-muted-foreground" : ""}`}
            >
                <label
                    id="load-dataset-label"
                    htmlFor="load-dataset"
                    className="flex items-center gap-2 cursor-pointer w-full"
                >
                    <Folder className="text-theme" />

                    <span className="truncate min-w-0 flex-1 text-start">
                        {filename ? `Dataset: ${filename}` : "Load image dataset"}
                    </span>
                </label>
            </Button>

            <Input
                value=""
                disabled={worker?.isTraining()}
                onChange={handleImageDataset}
                hidden
                id="load-dataset"
                multiple
                type="file"
                accept="application/zip,.zip"
            />
        </>
    );
}
