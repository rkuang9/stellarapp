import React from "react";
import { ChatManager } from "@/lib/data-processing/llm_chat";
import GPTModelWorker from "@/lib/webworker/gpt_client";
import { Tokenizer } from "@/lib/data-processing/nlp_sources";
import useRender from "@/components/use-render";
import { Backend } from "@/types/hyperparameters";


export interface UseChatInferenceArgs {
    tokenizerName: string;
    cacheSize: number;
    systemPrompt?: string;
    backend: Backend;
}


export function useChatInference(config: UseChatInferenceArgs, worker?: GPTModelWorker) {
    const { tokenizerName, cacheSize, systemPrompt, backend } = config;

    const chat_manager = React.useRef<ChatManager | null>(null);
    const local_render = useRender();
    const [cache_full, setCacheFull] = React.useState<boolean>(false);
    const worker_built = worker?.isBuilt();

    React.useEffect(() => {
        if (!worker?.isBuilt()) {
            // do not initialize chat unless model is ready to serve
            return;
        }

        const init = async () => {
            try {
                const manager = new ChatManager(tokenizerName);
                await manager.initialize();
                chat_manager.current = manager;
            } catch (error: any) {
                throw Error(`ChatManager.initialize: failed to initialize ${tokenizerName}: ${error.toString()}`);
            }
        };

        init();
    }, [tokenizerName, cacheSize, worker, worker_built]);


    const startChat = async (content: string) => {
        if (!worker) {
            return;
        }

        if (worker.isPredicting()) {
            worker.stop();
            return;
        }

        const manager = chat_manager.current;

        if (!manager) {
            return;
        }

        worker.onPredict = (next_token: string) => {
            manager.append(next_token);
            local_render();
        }

        worker.onFinish = (cache_full) => {
            if (cache_full) {
                setCacheFull(true);
            }
        }

        const is_new_chat = manager.length == 0;

        if (systemPrompt) {
            manager.add("system", systemPrompt);
        }

        manager.add("user", content);
        local_render();

        return worker.generate({
            chat: await manager.format(content, systemPrompt),
            isNew: is_new_chat,
            backend,
            cacheSize: cacheSize,
            tokenizer: tokenizerName as Tokenizer,
        });
    };


    const clearChat = async () => {
        if (chat_manager.current && chat_manager.current.length > 0) {
            chat_manager.current.clear();
            setCacheFull(false);
        }
    };


    const stopChat = async () => {
        await worker?.stop();
    }


    return {
        messages: chat_manager.current?.messages ?? [],
        cacheFull: cache_full,
        startChat,
        clearChat,
        stopChat
    };
}
