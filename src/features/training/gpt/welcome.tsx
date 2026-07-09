import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "@/features/training/container";
import { FolderClosed, Smile } from "lucide-react";
import { parseProjectUpload } from "@/lib/data-processing/model_io_handler";
import { ProjectType } from "@/types/project_types";
import { useDialogue } from "@/components/dialogue";
import { abbreviatedCount } from "@/lib/utility";
import { useProject } from "@/features/training/project-contexts";
import { toaster } from "@/components/toaster";
import { LLMConfig } from "@/lib/data-processing/llm_config";
import { GithubIcon } from "@/components/icons/github";


export default function Welcome() {
    const { project_config, worker, cache, full_render } = useProject<LLMConfig>();
    const { Dialogue, notify } = useDialogue();

    const GitHubLink = () => <a
        className="inline-flex gap-1 items-center hover:underline text-theme px-2"
        href="https://github.com/rkuang9/tfjs-stellar"
        target="_blank" >
        <GithubIcon className="size-4" /> tfjs-stellar
    </a>


    const onLoadResumeProject = async (files: FileList | null) => {
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

        if (loaded_project?.project_type != ProjectType.TEXT_GENERATION) {
            notify({
                title: "Project not loaded",
                description: "This is not a GPT project."
            });

            return;
        }

        if (project_config) {
            project_config.load(loaded_project);

            // these values are held in a React state rather in the project_config,
            // so they need to be saved to the cache for them to retrieve and delete
            cache.load.learning_rate = project_config.model.learning_rate;
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
                        description: `The model was not loaded. Inference is unavailable until the model is retrained.\n\n${message ?? ""}`,
                    });
                }).finally(() => {
                    full_render(); // full rerender to display loaded values 
                });
            } else {
                toaster.success(`Model configurations loaded`);
                full_render();
            }
        }
    }


    return <Container
        id="welcome"
        className="gap-2"
        heading="Train and run LLMs In Your Browser"
        icon={Smile}
    >
        <Dialogue />

        <div className="flex flex-col gap-1 text-lg">

        </div>

        <div className="flex flex-col gap-1 text-lg">
            <div className="flex flex-col gap-2 justify-center">
                <span>Train your very own generative large language model in the browser. Simply provide some text and start training.</span>

                <span className="flex flex-wrap items-center">Model training is powered by <GitHubLink /></span>
            </div>

            <div className="flex gap-2 items-center text-base flex-wrap">
                <span>
                    Want to resume from a model you saved to your device?
                </span>
                <div>
                    <Button variant="outline" asChild disabled={worker?.isTraining()}>
                        <label
                            id="load-existing-gpt-label"
                            htmlFor="load-local-project"
                            className={`cursor-pointer ${worker?.isTraining() ? "text-muted-foreground hover:text-muted-foreground" : ""}`}
                        >
                            <FolderClosed className="text-theme" /> Load existing project.zip
                        </label>
                    </Button>

                    <Input
                        disabled={worker?.isTraining()}
                        value="" // set to ""so the same document (for whatever reason) can be loaded in succession
                        onChange={event => onLoadResumeProject(event.target.files)}
                        hidden
                        id="load-local-project"
                        type="file"
                        accept="application/zip,.zip" />
                </div>
            </div>
        </div>

    </Container>
}