"use client"

import React from "react";
import { v4 as uuid } from "uuid";
import isNumeric from "validator/lib/isNumeric";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Info, Package, WholeWord } from "lucide-react";

import { Container } from "@/features/training/container";
import { GPTContext } from "@/features/training/gpt/gpt-contexts";
import useRender from "@/components/use-render";
import { useDialogue } from "@/components/dialogue";
import { useProject } from "@/features/training/project-contexts";
import { SelectField } from "@/components/custom/select-field";
import { Tokenizer, Tokenizers } from "@/lib/data-processing/nlp_sources";
import { type LLMConfig } from "@/lib/data-processing/llm_config";
import { toaster } from "@/components/toaster";


type LlmModelPreset = "micro" | "mini" | "tiny" | "small";

const size_info = {
    "num_layers": {
        title: "Number of layers",
        description: "LLMs consist of a stack of decoder layers that help the model understand context and relationships between words, using earlier text to predict the next word (token). Adding more layers increases the model's size, enabling it to learn more complex patterns."
    },
    "num_heads": {
        title: "Heads per layer",
        description: "Attention heads are components within each decoder layer that focus on different parts of the text, helping the model learn diverse relationships between words (tokens).\n\nA value such that embedding size ÷ heads per layer is a multiple of 8 is recommended.",
    },
    "seq_length": {
        title: "Training context length",
        description: `The context length is the number of tokens per training sample. Pre-train with a shorter context length, then fine-tune with a longer one to improve the model's ability to hold long conversations.` +
            ` You may need to lower the batch size when using a large context length to avoid running out of memory.` +
            `\n\nBecause datasets may feature long user prompts, a large context length is required to fit both the user prompt and assistant response. Otherwise, training samples without assistant tokens are rendered useless due to loss masking.`
    },
    "embed_size": {
        title: "Token embedding size",
        description: "The embedding size, also known as the hidden size, is the amount of values used to represent each word (token).\n\nA large embedding size allows the model to better understand the relationship between words (tokens), but increases the model size, training time, and memory usage.",
    },
}


const SEQUENCE_LENGTH_OPTIONS = Object.fromEntries([0.25, 0.5, ...Array(80).fill(0).map((_, index) => index + 1)].map(val => {
    const value = val * 128;
    return [String(value), value.toLocaleString()]
}));


const EMBED_DIM_OPTIONS = Object.fromEntries([
    32, 64, 128, 192, 256, 384, // ok on low end devices like laptop, mobile
    512, 768, 1024, // needs good hardware
    1280, 1536, 1792, 2048, 2560, 3072, 4096, 5120 // needs really really good hardware
].map(value => [String(value), value.toLocaleString()]));


interface GPTConfigArgs {
    num_layers: number;
    num_heads: number;
    embed_dim: number;
    sequence_length: number;
}


const presets: Record<LlmModelPreset, GPTConfigArgs> = {
    micro: { num_layers: 1, num_heads: 2, embed_dim: 32, sequence_length: 64 },
    mini: { num_layers: 2, num_heads: 4, embed_dim: 32, sequence_length: 64 },
    tiny: { num_layers: 4, num_heads: 4, embed_dim: 64, sequence_length: 128 },
    small: { num_layers: 8, num_heads: 8, embed_dim: 128, sequence_length: 256 },
}


export default function ModelSize() {
    const { project_config, worker, full_render } = useProject<LLMConfig>();
    const { status } = React.useContext(GPTContext);
    const render = useRender();
    const { Dialogue, notify, confirmation } = useDialogue();

    const embed_size_head_error: boolean = project_config.preprocessing.embed_dim > 0 &&
        project_config.preprocessing.num_heads > 0 &&
        project_config.preprocessing.embed_dim % project_config.preprocessing.num_heads != 0;

    React.useEffect(() => {
        const all_ok =
            !!project_config.preprocessing.tokenizer &&
            project_config.preprocessing.embed_dim > 0 &&
            project_config.preprocessing.num_heads > 0 &&
            project_config.preprocessing.num_layers > 0 &&
            project_config.preprocessing.sequence_length > 0 &&
            !embed_size_head_error;

        if (status.model_size != all_ok) {
            status.model_size = all_ok;
            full_render();
        }
    });


    const onChangeTokenizer = async (tokenizer: string) => {
        if (!Tokenizers[tokenizer as Tokenizer]) {
            return;
        }

        if (project_config.preprocessing.tokenizer &&
            project_config.metrics_history.length != 0 &&
            !await confirmation({
                title: "Change tokenizer?",
                description: "Changing the tokenizer will require your datasets to be tokenized again. Are you sure?"
            })) {
            return;
        }

        project_config.preprocessing.tokenizer = tokenizer as Tokenizer;
        project_config.preprocessing.vocab_size = Tokenizers[tokenizer as Tokenizer].vocab_size;
        render();
    }


    const tokenizerInfo = () => {
        notify({
            title: "Tokenizer",
            description: "Tokenizers break down text into words and subwords, then convert them into tokens (numbers) for model training." +
                "\n\nTo keep the model's vocabulary consistent, the tokenizer must remain the same during and after training."
        })
    }


    const onChangeModelSize = (new_value: string, field: keyof GPTConfigArgs) => {
        let value = Number(new_value);

        if (!isNumeric(new_value) || value < 1) {
            value = 0;
        }

        project_config.preprocessing[field] = value;
        render();
    }


    const recommendHeads = (val: string) => {
        const new_embed_size = Number(val);
        if (isNaN(new_embed_size)) {
            return;
        }

        const recommended_heads = [
            new_embed_size / 128,
            new_embed_size / 64,
            new_embed_size / 32
        ].filter(heads => Number.isInteger(heads));

        if (recommended_heads.length > 0 &&
            !recommended_heads.includes(project_config.preprocessing.num_heads)) {
            toaster.info(`To optimize GPU memory and training time, use one of` +
                ` the following number of heads per layer: ${recommended_heads.join(", ")}`,
                { duration: 7_000 });
        }
    }


    const onPresetSelect = (preset: LlmModelPreset) => {
        project_config.preprocessing = {
            ...project_config.preprocessing,
            ...structuredClone(presets[preset])
        }

        full_render();
    }

    const current_model_config = {
        num_layers: project_config.preprocessing.num_layers,
        num_heads: project_config.preprocessing.num_heads,
        embed_dim: project_config.preprocessing.embed_dim,
        sequence_length: project_config.preprocessing.sequence_length
    };

    const model_config_string = JSON.stringify(current_model_config);

    // key order matters, it should follow the preset key order
    const is_custom_model_config =
        model_config_string != JSON.stringify(presets.micro) &&
        model_config_string != JSON.stringify(presets.mini) &&
        model_config_string != JSON.stringify(presets.tiny) &&
        model_config_string != JSON.stringify(presets.small);

    const presetButtonStyle = (preset: "micro" | "mini" | "tiny" | "small") => {
        return `cursor-pointer grow basis-0 ${!is_custom_model_config && model_config_string == JSON.stringify(presets[preset]) ? "bg-theme! text-background hover:text-background" : ""}`
    };


    return <Container
        id="model-size"
        heading="Set Model Size"
        subheading="Large models are more capable but take longer to train. Small models are suitable for narrower set of tasks and low power devices like smartphones."
        icon={Package}
    >
        <Dialogue />

        <div className="flex gap-3 h-full">
            <div className="flex flex-col gap-5 grow overflow-x-auto">
                <Label id="model-presets" className="text-lg">Choose a size preset</Label>

                <div className="flex grow gap-2 flex-wrap w-full lg:w-3/4 xl:w-1/2">
                    {(["micro", "mini", "tiny", "small"] as LlmModelPreset[]).map((size) => <Button
                        key={size}
                        disabled={worker?.isTraining()}
                        onClick={() => onPresetSelect(size)}
                        variant="outline"
                        id={`gpt-${size}`}
                        className={presetButtonStyle(size)}
                    >
                        <span className="first-letter:uppercase">{size}</span>
                    </Button>)}

                    <Button
                        disabled={!is_custom_model_config || worker?.isTraining()}
                        id="gpt-custom"
                        variant="outline"
                        className={`grow sm:grow-0 ${is_custom_model_config ? "bg-theme! text-background" : ""}`}
                    >
                        Custom
                    </Button>
                </div>

                <Separator />

                <div className="flex flex-col lg:flex-row gap-2 justify-between">
                    <div id="layers" className="grid grid-cols-2 gap-3 w-full lg:w-3/4 xl:w-1/2">
                        <div className="flex flex-col gap-3 col-span-1">
                            <Label>
                                {size_info.num_layers.title}
                                <Info
                                    className="cursor-pointer text-muted-foreground"
                                    size={16}
                                    onClick={() => notify({
                                        title: size_info.num_layers.title,
                                        description: size_info.num_layers.description
                                    })} />
                            </Label>
                            <Input
                                disabled={worker?.isTraining()}
                                id="num-layers"
                                value={project_config.preprocessing.num_layers || ""}
                                type="text"
                                placeholder={String(presets.micro.num_layers)}
                                onChange={event => onChangeModelSize(event.target.value, "num_layers")} />
                        </div>

                        <div className="flex flex-col  gap-3 col-span-1">
                            <Label className={embed_size_head_error ? "text-error" : ""}>
                                {size_info.num_heads.title}
                                <Info
                                    className="cursor-pointer text-muted-foreground"
                                    size={16}
                                    onClick={() => notify({
                                        title: size_info.num_heads.title,
                                        description: size_info.num_heads.description
                                    })} />
                            </Label>
                            <Input
                                disabled={worker?.isTraining()}
                                id="num-heads"
                                value={project_config.preprocessing.num_heads || ""}
                                className={`${embed_size_head_error ? "border-error focus-visible:border-error" : ""}`}
                                type="text"
                                placeholder={String(presets.micro.num_heads)}
                                onChange={event => onChangeModelSize(event.target.value, "num_heads")} />
                        </div>

                        <div className="flex flex-col  gap-3  col-span-1">
                            <Label>
                                {size_info.seq_length.title}
                                <Info
                                    className="cursor-pointer text-muted-foreground"
                                    size={16}
                                    onClick={() => notify({
                                        title: size_info.seq_length.title,
                                        description: size_info.seq_length.description
                                    })} />
                            </Label>
                            <SelectField
                                disabled={worker?.isTraining()}
                                id="sequence-length"
                                value={String(project_config.preprocessing.sequence_length)}
                                options={SEQUENCE_LENGTH_OPTIONS}
                                onValueChange={val => onChangeModelSize(val, "sequence_length")} />
                        </div>

                        <div className="flex flex-col  gap-3  col-span-1" >
                            <Label className={embed_size_head_error ? "text-error" : ""}>
                                {size_info.embed_size.title}
                                <Info
                                    className="cursor-pointer text-muted-foreground"
                                    size={16}
                                    onClick={() => notify({
                                        title: size_info.embed_size.title,
                                        description: size_info.embed_size.description
                                    })} />
                            </Label>
                            <SelectField
                                disabled={worker?.isTraining()}
                                id="embed-size"
                                value={String(project_config.preprocessing.embed_dim)}
                                onValueChange={val => {
                                    onChangeModelSize(val, "embed_dim");
                                    recommendHeads(val);
                                }}
                                options={EMBED_DIM_OPTIONS} />
                        </div>
                    </div>
                </div>

                {embed_size_head_error && <span id="model-size-error-msg" className="text-sm text-error">
                    The embedding size ({project_config.preprocessing.embed_dim}) must be divisible by the number of heads per layer ({project_config.preprocessing.num_heads})
                </span>}

                <div>
                    <ParameterCount />
                </div>

                <Separator />

                <div className="space-y-2">
                    <Label id="tokenizer-label" className="text-lg flex gap-2 items-center">
                        Choose a tokenizer

                        <Info
                            size={20}
                            className="cursor-pointer text-muted-foreground"
                            onClick={tokenizerInfo}
                        />
                    </Label>

                    <SelectField
                        disabled={worker?.isTraining()}
                        id="tokenizer"
                        className="w-full sm:w-fit text-start overflow-hidden"
                        value={project_config.preprocessing.tokenizer ?? ""}
                        options={Object.fromEntries(Object.keys(Tokenizers).map(tokenizer => [tokenizer, `${Tokenizers[tokenizer as Tokenizer].label} (${Tokenizers[tokenizer as Tokenizer].vocab_size.toLocaleString()} tokens)`]))}
                        onValueChange={onChangeTokenizer}
                        placeholder="Choose tokenizer"
                        icon={<WholeWord className="text-theme" />}
                    />
                </div>

            </div>
        </div>
    </Container>
}


export function ParameterCount() {
    const { project_config } = useProject<LLMConfig>();
    const { embed_dim, num_layers } = project_config.preprocessing;

    const { Dialogue, notify } = useDialogue();

    const vocab_size = project_config.preprocessing.vocab_size ?? 50257;

    // token and positional embeddings
    const embedding_size = embed_dim * vocab_size;

    // transformer params
    const dense_proj_size = embed_dim * embed_dim + embed_dim;
    const mh_attention_size = dense_proj_size * 4;
    const layer_norm_size = embed_dim * 2;

    // feedforward is made of a relu and a linear layer, the relu is 4x d_model,
    // both their weights are of same size but biases are not
    const feedforward_size = 8 * embed_dim * embed_dim + 5 * embed_dim;

    // decoder only, no cross attention therefore only 1 attention sublayer
    const single_transformer_size =
        mh_attention_size + layer_norm_size +
        feedforward_size + layer_norm_size;

    // output layer
    const softmax_size = embed_dim * vocab_size + (embed_dim > 0 ? vocab_size : 0);

    const total_size = embedding_size + single_transformer_size * num_layers + softmax_size;

    const showSize = () => {
        notify({
            title: "Model size",
            description: <div className="text-muted-foreground text-sm text-start">
                <p>Total parameters: {total_size.toLocaleString()}</p>
                <ul className="list-inside list-disc text-sm">
                    <li>Embedding Layer: {embedding_size.toLocaleString()}</li>
                    <li>Transformer Decoder Layer Stack: {(single_transformer_size * num_layers).toLocaleString()}</li>
                    <li>Output Layer: {softmax_size.toLocaleString()}</li>
                </ul>
                <br />
                <p>Models under {Number(process.env.NEXT_PUBLIC_MODEL_PARAM_LIMIT).toLocaleString()} parameters can be saved online.</p>
            </div>
        })
    }

    return <div className="text-muted-foreground text-sm flex gap-2 items-center flex-wrap">
        <Dialogue />
        <span>Model size: {!!total_size ? total_size.toLocaleString() : "-"}</span>
        <Info size={16} className="cursor-pointer hover:text-primary shrink-0" onClick={showSize} />
    </div>
}
