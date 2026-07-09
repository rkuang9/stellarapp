import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "@/features/training/container";
import { Folder, FolderArchive, FolderClosed, Info, Smile } from "lucide-react";
import { parseProjectUpload } from "@/lib/data-processing/model_io_handler";
import { ProjectTypes } from "@/types/project_types";
import { useDialogue } from "@/components/dialogue";
import { abbreviatedCount } from "@/lib/utility";
import { useProject } from "@/features/training/project-contexts";
import { toaster } from "@/components/toaster";
import { ImageContext } from "@/features/training/image_classification/image-contexts";
import type ProjectConfig from "@/lib/data-processing/project_config";


export default function Welcome() {

    const { project_config, worker, cache, full_render } = useProject<ProjectConfig>();
    const { imageset } = React.useContext(ImageContext);
    const { Dialogue, notify, confirmation } = useDialogue();

    const onLoadLocalProject = async (files: FileList | null) => {
        if (!files || files?.length == 0) {
            return;
        }

        const {
            project_config: loaded_project, model_json, weights_bin
        } = await parseProjectUpload(files[0]);

        if (!loaded_project) {
            notify("Project not found.");
            return;
        }

        if (project_config.project_type && loaded_project?.project_type != project_config.project_type) {
            notify({
                title: "Project not loaded",
                description: `This is not a ${ProjectTypes[project_config.project_type].label.toLowerCase()} project.`
            });

            return;
        }


        if (imageset.categories.length > 0) {
            const invalid_cols = [
                ...loaded_project.preprocessing.input_cols,
            ].filter(col => {
                return !imageset.categories.includes(col)
            });

            if (invalid_cols.length > 0) {
                if (await confirmation({
                    title: "Invalid columns",
                    description: `Some of your category prediction targets were not found in this dataset. Would you like to clear them and continue?\n\n` +
                        `Invalid image categories: ${invalid_cols.join(", ")}\n\n`
                })) {
                    project_config.resetColumns();
                } else {
                    return;
                }
            }
        }


        if (project_config) {
            project_config.load(loaded_project);

            // these values are held in a React state rather in the project_config,
            // so they need to be saved to the cache for them to retrieve and delete
            cache.load.learning_rate = project_config.model.learning_rate;
            cache.load.input_cols = project_config.preprocessing.input_cols;
            cache.load.layers = project_config.model.layers;

            if (model_json && weights_bin) {
                worker?.load({
                    project_config,
                    model_json,
                    weights_bin
                }).then(({ parameters }) => {
                    toaster.success(`Loaded model with ${abbreviatedCount(parameters, 1)} parameters`);
                }).catch(async message => {
                    project_config.metrics_history = [];

                    await notify({
                        title: "An error occurred",
                        description: `The model was not loaded. Inference is unavailable until the model is retrained.\n${message ? `Error: ${message}` : ""}`,
                    });
                }).finally(() => {
                    full_render(); // full rerender to display loaded values 
                });
            } else {
                toaster.success("Loaded training configurations (no model)");
                full_render();
            }
        }
    }

    const dataset_example: { [key: string]: string[] } = {
        dogs: ["dog1.jpg", "retriever.jpg", "alaskan.png"],
        cats: ["cat1.jpg", "orange.jpg", "void.png"],
        birds: ["bird1.jpg", "parakeet.jpg", "parrot.png"],
    };

    const explainDatasetFolder = () => {
        notify({
            title: "Image dataset structure",
            description: <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <span>The image dataset zip folder should consist of <span className="text-theme">subfolders</span>, labeled by category, each containing at least one image file.</span>
                <div className="flex gap-2 items-center"><FolderArchive className="size-5" />Animals-Dataset.zip</div>
                <div className="flex flex-col gap-2 text-start">
                    {Object.keys(dataset_example).map(category => <ul key={category} className="list-disc list-inside pl-4">
                        <div className="flex gap-2 items-center">
                            <Folder className="size-5" />
                            <span className="text-theme">{category}</span>
                        </div>

                        {dataset_example[category].map(image => <li key={image} className="pl-4">
                            {image}
                        </li>)}
                    </ul>)}
                </div>
            </div>
        })
    }

    return <Container
        id="welcome"
        className="gap-2"
        heading="Train AI Models In Your Browser"
        icon={Smile}
    >
        <Dialogue />

        <div className="flex flex-col gap-1 text-base">
            <div className="">
                Load your <span onClick={explainDatasetFolder} className="text-theme inline-flex items-center gap-1 hover:underline cursor-pointer">image dataset<Info className="size-5" /></span> to start training your image classification model.
            </div>

            <div className="flex gap-2 items-center text-base flex-wrap">
                <span>
                    Want to resume from a project you saved to your device?
                </span>
                <div>
                    <Button variant="outline" disabled={worker?.isTraining()} asChild>
                        <label id="load-existing-label" htmlFor="load-local-project" className="cursor-pointer">
                            <FolderClosed className="text-theme" /> Load project.zip
                        </label>
                    </Button>

                    <Input
                        value="" // set to ""so the same document (for whatever reason) can be loaded in succession
                        onChange={event => onLoadLocalProject(event.target.files)}
                        hidden
                        id="load-local-project"
                        type="file"
                        accept="application/zip,.zip" />
                </div>
            </div>
        </div>

    </Container>
}
