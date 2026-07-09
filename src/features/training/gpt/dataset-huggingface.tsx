import React from "react";

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z as zod } from "zod"
import { Form, FormField } from "@/components/ui/form";

import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { SelectField } from "@/components/custom/select-field";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toaster } from "@/components/toaster";
import { Check, Info, LoaderCircle } from "lucide-react";

import { MultiSelect, MultiSelectOption } from "@/components/custom/multi-select";
import { cleanDatasetURL, SupportedMimeTypes } from "@/lib/data-processing/huggingface_datasets";
import { parseDatasetURL } from "@/lib/data-processing/huggingface_datasets";
import { readableFileSize } from "@/lib/utility";
import { LLMConfig } from "@/lib/data-processing/llm_config";
import { useProject } from "@/features/training/project-contexts";
import { useHuggingfaceDatasetSchema } from "@/hooks/use-hf-dataset-schema";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


const form_schema = zod.object({
    url: zod.string().superRefine((val, ctx) => {
        if (!val) {
            ctx.addIssue("Not a valid Huggingface dataset URL");
            return;//true;
        }

        try {
            const { type, owner, name, path } = parseDatasetURL(val);

            if (type != "datasets" || !owner || !name) {
                ctx.addIssue("Not a valid Huggingface dataset URL");
            }
        } catch (error: any) {
            ctx.addIssue(error.toString());
        }
    }),
})


interface HuggingfaceFeaturesArgs {
    system: string[],
    user: string[],
    assistant: string[],
    features: string[][]
}


export default function HuggingfaceDataset({ url, files, features, closeMenu, type }: {
    url: string,
    files?: string[],
    features?: HuggingfaceFeaturesArgs,
    closeMenu: () => void,
    type: "pretrain" | "finetune"
}) {
    const { project_config, full_render } = useProject<LLMConfig>();
    const current_url = React.useRef<string>(url);
    const {
        files: hf_files, loading_files,
        features: hf_features, loading_features,
        load, clear, fetch_error
    } = useHuggingfaceDatasetSchema();

    const [selected_files, setSelectedFiles] = React.useState<string[]>(files || []);
    const [selected_features, setSelectedFeatures] = React.useState<HuggingfaceFeaturesArgs>(features || {
        system: [],
        user: [],
        assistant: [],
        features: []
    });

    const form = useForm<zod.infer<typeof form_schema>>({
        resolver: zodResolver(form_schema),
        mode: "onBlur",
        defaultValues: {
            url: url
        }
    });

    const onSubmit = () => {
        if (!form.getValues("url")) {
            toaster.error("Please enter a valid dataset URL.");
            return;
        }

        if (selected_files.length == 0) {
            toaster.error("Please select at least one file from the dataset.");
            return;
        }

        if (type == "pretrain" && selected_features.features.length == 0) {
            toaster.error("Please select at least one feature for pretraining.");
            return;
        } else if (type == "finetune" && (!selected_features.user || !selected_features.assistant)) {
            toaster.error("Please select an input/role feature and a response/content feature")
            return;
        }

        if (type == "pretrain") {
            project_config.preprocessing.pretraining_datasets[form.getValues("url")] = { files: selected_files, features: selected_features.features };
        } else {
            project_config.preprocessing.finetuning_datasets[form.getValues("url")] = {
                files: selected_files, features: {
                    user: selected_features.user,
                    assistant: selected_features.assistant,
                    system: selected_features.system
                }
            };
        }

        closeMenu();
        full_render();
    }


    const onBlurURL = async (event: React.FocusEvent<HTMLInputElement, Element>) => {
        try {
            let new_url = form.getValues("url");

            if (!new_url || !await form.trigger("url") || new_url == current_url.current) {
                if (!new_url) {
                    current_url.current = "";
                }

                clear();
                return;
            }

            new_url = cleanDatasetURL(form.getValues("url"));

            setSelectedFeatures({ user: [], assistant: [], features: [], system: [] });
            setSelectedFiles([]);
            form.setValue("url", new_url);

            if (!new_url) {
                current_url.current = "";
                clear();
                return;
            }

            const { type, owner, name } = parseDatasetURL(new_url);

            if (type == "datasets" && owner && name) {
                current_url.current = "";

                load(new_url).then(() => {
                    current_url.current = new_url;
                });
            }
        } catch (error: any) {
            toaster.error(error.toString());
        }
    }

    const onSelectFile = (path: string) => {
        setSelectedFiles(!selected_files.includes(path)
            ? [...selected_files, path]
            : selected_files.filter(i => i != path));
    }


    const onSelectAllFiles = () => {
        setSelectedFiles(selected_files.length == hf_files.length
            ? []
            : hf_files.map(file => file.path));
    }


    const onFeatureChange = (role: "user" | "assistant" | "system" | "features", value: string) => {
        const selected = value.split(".").filter(Boolean);

        if (selected.length > 0) {
            setSelectedFeatures(old => ({ ...old, [role]: selected }))
        }
    }

    const loader_circle = <LoaderCircle className="animate-spin size-3 text-theme" />;
    const loading_features_indicator = loading_features && loader_circle;

    return <Card id="llm-dataset-hf-container" className="bg-transparent border-0 flex flex-col h-full min-h-0">
        <CardHeader className="px-0 sm:px-6">
            <CardTitle className="text-xl flex gap-2 items-center">Load datasets from Huggingface</CardTitle>
            <CardDescription className="flex flex-col gap-2">
                <span>Add a Huggingface dataset using its URL. If the dataset has an exceedingly large number of files, use the subfolder URL to avoid <a className="inline text-theme" target="_blank" href="https://huggingface.co/docs/hub/rate-limits#rate-limit-tiers">rate limits</a> and display just what you need.</span>
                <span>{`Supported dataset formats: ${Object.keys(SupportedMimeTypes).join(", ").toUpperCase()}`}</span>
            </CardDescription>
        </CardHeader>


        <CardContent className="text-sm text-muted-foreground space-y-4 grow overflow-scroll px-0 sm:px-6">
            <Form {...form}>
                <FormField control={form.control} name="url"
                    render={({ field, fieldState }) => <Field>
                        <Label>
                            Dataset URL{hf_files.length > 0 && hf_features.length > 0 && <Check className="shrink-0 size-3 text-success" />}{(loading_features || loading_files) && loader_circle}
                        </Label>
                        <Input
                            {...field}
                            spellCheck={false}
                            id="llm-datase-hf-url"
                            aria-invalid={fieldState.invalid}
                            onBlur={onBlurURL}
                        />
                        {fetch_error && <span className="text-error">{fetch_error}</span>}
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>}>
                </FormField>
            </Form>

            {type == "pretrain" && <Field>
                <Label>
                    <span>Select feature</span>
                    <div>
                        {loading_features && loader_circle}
                        {selected_features.features.length > 0 && <Check className="shrink-0 size-3 text-success" />}
                    </div>
                </Label>
                <SelectField
                    value={selected_features.features?.join(".") || ""}
                    id="llm-dataset-hf-pretrain-feature"
                    options={hf_features}
                    onValueChange={value => onFeatureChange("features", value)} />
            </Field>}

            {type == "finetune" && <>
                <Field className="gap-1">
                    <FieldLabel className="gap-2">
                        <span>Input or role prompt field</span>
                        <ShowPopover text={`The user's question or instruction to the model. For conversational (multi-turn chat) datasets, this is the identifier for the chat content's speaker (e.g. "user" or "assistant").`} />
                        {loading_features_indicator}
                    </FieldLabel>
                    <SelectField
                        value={selected_features.user.join(".")}
                        id="llm-dataset-hf-user-feature" options={hf_features} onValueChange={value => onFeatureChange("user", value)} />
                </Field>

                <Field>
                    <FieldLabel className="gap-2">
                        <span>Response or content field</span>
                        <ShowPopover text={`The model's reply to the conversation. For conversational (multi-turn chat) datasets, this is what's spoken by role.`} />
                        {loading_features_indicator}
                    </FieldLabel>

                    <SelectField
                        value={selected_features.assistant.join(".")}
                        id="llm-dataset-hf-assistant-feature"
                        options={hf_features}
                        onValueChange={value => onFeatureChange("assistant", value)} />
                </Field>

                <Field>
                    <FieldLabel className="gap-2">
                        <span>System prompt field (optional)</span>
                        <ShowPopover text="A set of instructions that define the model's behavior and constraints. If provided, it is inserted at the start of each input prompt and is not visible to the end-user. This should be left blank for conversational (multi-turn chat) datasets." />
                        {loading_features_indicator}
                    </FieldLabel>

                    <SelectField
                        value={selected_features.system.join(".")}
                        id="llm-dataset-hf-system-feature"
                        options={hf_features}
                        onValueChange={value => onFeatureChange("system", value)} />
                </Field>
            </>}

            <Field>
                <Label>
                    Select dataset files {selected_files.length > 0 && <Check className="shrink-0 size-3 text-success" />}{(loading_features || loading_files) && loader_circle}
                    {hf_files.length > 0 && <ShowPopover text="The selected files should contain your selected features. If there are too many files to select, try using one of the dataset's subfolder's URL." />}
                </Label>

                <MultiSelect
                    id="hf-dataset-file-list"
                    label={selected_files.length > 0 ? `${selected_files.at(0)}${selected_files.length > 1 ? "..." : ""}` : ""}
                >
                    {hf_files.length > 5 && <MultiSelectOption
                        id="llm-dataset-hf-file-list-select-all"
                        onClick={onSelectAllFiles}>
                        {hf_files.length == selected_files.length ? "Clear selections" : "Select all"}
                    </MultiSelectOption>}

                    {hf_files.map((file, index) => <div
                        key={index}
                        id={file.path}
                        onClick={() => onSelectFile(file.path)}
                        className={`${selected_files.includes(file.path) ? "bg-accent" : ""} text-muted-foreground flex justify-between hover:bg-accent focus:bg-accent focus:text-accent-foreground w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none`}
                    >
                        <span className="min-w-0 flex-1 break-words">{file.path}</span>
                        <span className="shrink-0">{readableFileSize(file.size, 0)}</span>
                    </div>)}
                </MultiSelect>
            </Field>
        </CardContent>

        <CardContent className="px-0 sm:px-6">
            <DialogFooter className="flex flex-row">
                <DialogClose asChild className="grow sm:grow-0">
                    <Button className="cursor-pointer" variant="outline">Cancel</Button>
                </DialogClose>
                <Button className="cursor-pointer grow sm:grow-0" onClick={onSubmit}>Add</Button>
            </DialogFooter>
        </CardContent>
    </Card >
}


function ShowPopover({ text }: { text: string }) {
    return <Popover>
        <PopoverTrigger asChild>
            <Info className="size-4 cursor-pointer" />
        </PopoverTrigger>
        <PopoverContent className="text-sm text-muted-foreground">
            {text}
        </PopoverContent>
    </Popover>
}
