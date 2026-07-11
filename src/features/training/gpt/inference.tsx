import React from "react";

import { Container } from "@/features/training/container";
import {
    ChatContainerContent,
    ChatContainerRoot,
} from "@/components/prompt-kit/chat-container";
import {
    Message,
    MessageAction,
    MessageActions,
    MessageContent,
} from "@/components/prompt-kit/message";
import {
    PromptInput,
    PromptInputAction,
    PromptInputActions,
    PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input";
import {
    ArrowUp,
    Copy,
    Square,
    SquarePen,
    MessageCircle
} from "lucide-react";

import { toaster } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import useRender from "@/components/use-render";
import { useProject } from "@/features/training/project-contexts";
import { useChatInference } from "@/hooks/use-llm-chat";
import { LLMConfig } from "@/lib/data-processing/llm_config";
import GPTModelWorker from "@/lib/webworker/gpt_client";
import { Tokenizer, Tokenizers } from "@/lib/data-processing/nlp_sources";
import { abbreviatedCount } from "@/lib/utility";
import { SelectField } from "@/components/custom/select-field";
import { downloadModel } from "@model-io";


const kv_cache_size_options = {
    "1024": "1,024",
    "2048": "2,048",
    "4096": "4,096",
    "8192": "8,192",
    "16384": "16,384",
    "32768": "32,768",
    "65536": "65,536",
    "131072": "131,072"
};


const PROMPT_PLACEHOLDER = "What's on your mind?";


export default function ModelInference() {
    const [prompt, setPrompt] = React.useState<string>("");
    const [system_status, setSystemStatus] = React.useState<string>(""); // empty status means model built and all ok
    const local_render = useRender();
    const [cache_size, setCacheSize] = React.useState<number>(2048);
    const [system_prompt, setSystemPrompt] = React.useState<string>("You are a friendly, helpful assistant.");

    const { worker, project_config, meta, cache } = useProject<LLMConfig, GPTModelWorker>();
    const worker_built = worker?.isBuilt();

    React.useEffect(() => {
        if (worker?.isBuilt()) {
            setSystemStatus("");
        }
    }, [worker, worker_built]);

    const {
        messages,
        cacheFull,
        startChat,
        stopChat,
        clearChat,
    } = useChatInference({
        tokenizerName: project_config.preprocessing.tokenizer as Tokenizer,
        systemPrompt: system_prompt ? system_prompt : undefined,
        cacheSize: cache_size,
        backend: project_config.model.backend
    }, worker);


    const downloadCloudModel = async () => {
        if (!downloadModel) {
            return;
        }

        setPrompt("");
        setSystemStatus("Downloading model files...0%");

        const { model_json, weights_bin } = await downloadModel({
            username: meta.project!.username,
            project_name: meta.project!.project_name,
            callback: event => {
                setSystemStatus(`Downloading model files...${(100 * event.loaded / event.total!).toFixed(0)}%`);
            }
        })

        cache.cloud_model_state = "downloaded";

        setSystemStatus("");

        const { parameters } = await worker!.load({ model_json, weights_bin, project_config });

        local_render(); // lets the useChatInference hook initialize a chat history
        toaster.success(`Loaded model with ${abbreviatedCount(parameters, 1)} parameters`);
    }


    const handleSubmit = async () => {
        if (!worker) {
            toaster.error("Failed to create a web worker. Please ensure your browser supports them and try reloading this page.");
            return;
        }


        if (worker?.isPredicting()) {
            stopChat();
            return;
        }

        if (cache.cloud_model_state == "can_download" && !worker?.isBuilt() && downloadModel != undefined) {
            try {
                await downloadCloudModel();
            } catch (error: any) {
                cache.cloud_model_state = "error";
                setSystemStatus(`Error while downloading the model. Try reloading this page or retrain the model.\n${error.toString()}`);

                return;
            }
        }

        if (!worker?.isBuilt()) {
            toaster.error("The model has not yet been trained.");
            setPrompt("");
            return;
        }


        if (!project_config.preprocessing.tokenizer || !Tokenizers[project_config.preprocessing.tokenizer]) {
            toaster.error(`Tokenizer not found. Please select the same tokenizer this model was trained with.`);
            return;
        }

        const prompt_cleaned = prompt.trim();

        if (!prompt_cleaned) {
            return
        }

        // scroll the page so that the entire chat inference is in view
        document.getElementById("inference")?.scrollIntoView({ behavior: "smooth" });

        startChat(prompt_cleaned).catch(error => {
            toaster.error(error.toString());
        });

        setPrompt("");
    }


    const newChat = () => {
        clearChat();
        setPrompt("");
        local_render();
    }

    return <Container
        id="inference"
        heading="Chat With The Model"
        className="h-full grow flex flex-col"
        icon={MessageCircle}
        contentClassName="py-0"
    >
        <div className="flex flex-col overflow-auto w-full justify-center h-full">
            {messages.length != 0 && <ChatContainerRoot className="relative flex-1 space-y-0 overflow-y-auto px-4 py-0">
                <ChatContainerContent className="space-y-12 px-4 py-12">
                    {messages.filter(message => message.role != "system").map((message, index) => {
                        const is_assistant = message.role === "assistant";

                        return (
                            <Message id={`chat-msg-container-${index}`} key={message.id} className={`mx-auto flex w-full max-w-3xl flex-col gap-2 px-0 md:px-6 ${is_assistant ? "items-start" : "items-end"}`}>
                                {is_assistant
                                    ? <div>
                                        <MessageContent
                                            //id={`chat-msg-content-${index}`} // TODO: find out why this doesn't work
                                            className="text-foreground prose w-full flex-1 bg-transparent p-0 text-wrap min-w-0 wrap-anywhere" markdown>
                                            {message.content}
                                        </MessageContent>
                                        <MessageActions className="-ml-2.5 flex">
                                            <MessageAction tooltip="Copy" delayDuration={0} side="bottom">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-full cursor-pointer"
                                                    onClick={event => navigator.clipboard.writeText(message.content)}
                                                >
                                                    <Copy />
                                                </Button>
                                            </MessageAction>
                                        </MessageActions>
                                    </div>
                                    : <div className="group flex flex-col items-end gap-1 max-w-[85%] sm:max-w-[75%]">
                                        <MessageContent
                                            id={`chat-msg-content-${index}`}
                                            className="bg-muted text-primary rounded-3xl px-5 py-2.5">
                                            {message.content}
                                        </MessageContent>
                                        <MessageActions
                                            className="flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                            <MessageAction tooltip="Copy" delayDuration={0} side="bottom">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-full cursor-pointer"
                                                    onClick={event => navigator.clipboard.writeText(message.content)}
                                                >
                                                    <Copy />
                                                </Button>
                                            </MessageAction>
                                        </MessageActions>
                                    </div>}
                            </Message>
                        )
                    })}
                </ChatContainerContent>
            </ChatContainerRoot>}

            <div className="inset-x-0 bottom-0 mx-auto w-full max-w-3xl shrink-0 px-4 md:px-5">
                <PromptInput
                    disabled={worker?.isTraining()}
                    value={prompt}
                    onValueChange={setPrompt}
                    onSubmit={handleSubmit}
                    className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
                >
                    <div className="flex flex-col">
                        <PromptInputTextarea
                            id="chat-input"
                            disabled={worker?.isTraining() || cacheFull}
                            placeholder={PROMPT_PLACEHOLDER}
                            className="min-h-[2.5rem] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base bg-transparent!"
                        />

                        <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
                            <div className="flex items-center gap-2">
                                <PromptInputAction tooltip="New chat" side="bottom">
                                    <Button
                                        id="start-new-chat"
                                        variant="outline"
                                        size="icon"
                                        disabled={worker?.isPredicting() || worker?.isTraining()}
                                        onClick={newChat}
                                        className="cursor-pointer rounded-full"
                                    >
                                        <SquarePen />
                                    </Button>
                                </PromptInputAction>

                                <PromptInputAction tooltip="KV cache size" side="bottom">
                                    <SelectField
                                        id="kv-cache-size"
                                        disabled={messages.length > 0}
                                        label="KV cache size, maximum tokens per chat session"
                                        value={String(cache_size)}
                                        options={kv_cache_size_options}
                                        onValueChange={val => {
                                            if (!isNaN(Number(val))) {
                                                setCacheSize(Number(val));
                                            }
                                        }} />
                                </PromptInputAction>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    id="chat-control-button"
                                    size="icon"
                                    onClick={handleSubmit}
                                    disabled={worker?.isTraining()}
                                    className={`cursor-pointer rounded-full ${prompt.trim() || worker?.isPredicting() ? "" : "hidden"}`}
                                >
                                    {worker?.isPredicting()
                                        ? <Square id="chat-control-button-stop" />
                                        : prompt.trim() ? <ArrowUp id="chat-control-button-start" /> : <></>}
                                </Button>
                            </div>
                        </PromptInputActions>
                    </div>
                </PromptInput>

                <span className="flex grow justify-end text-muted-foreground text-sm">{cacheFull
                    ? "You've reached the KV cache maximum length for this conversation, but you can keep talking by starting a new chat."
                    : (system_status || "\u00A0")}
                </span>

            </div>
        </div>
    </Container>
}
