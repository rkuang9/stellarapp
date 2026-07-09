import { AutoTokenizer, type PreTrainedTokenizer } from '@huggingface/transformers';
import { v4 as uuid } from "uuid";


type ChatRole = "system" | "user" | "assistant";


interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
}


export class ChatManager {
    private hf_tokenizer: PreTrainedTokenizer | null = null;

    protected message_history: ChatMessage[] = [];
    protected tokenizer_name: string;


    constructor(tokenizer_name: string) {
        this.tokenizer_name = tokenizer_name;
    }


    public async initialize(): Promise<void> {
        if (!this.hf_tokenizer) {
            this.hf_tokenizer = await AutoTokenizer.from_pretrained(this.tokenizer_name);
        }
    }


    public add(role: "system" | "user" | "assistant", content: string): ChatMessage[] {
        this.message_history.push({ role, content, id: uuid() });
        return this.messages;
    }


    /**
     * Add the assistant generated tokens to the chat history. If the most recent
     * chat is not from the assistant, an entry is created for it.
     */
    public append(token: string) {
        const last_msg = this.message_history.at(-1);

        if (last_msg?.role == "assistant") {
            last_msg.content += token;
        } else {
            this.message_history.push({
                id: uuid(),
                role: "assistant",
                content: token
            });
        }
    }


    public clear(): void {
        this.message_history = [];
    }


    public get messages(): ChatMessage[] {
        return [...this.message_history];
    }


    public get tokenizer(): string {
        return this.tokenizer_name;
    }


    public set tokenizer(tokenizer_name: string) {
        this.hf_tokenizer = null;
        this.tokenizer_name = tokenizer_name;
    }


    /**
     * Apply the tokenizer's chat template
     */
    public async format(content: string, system_prompt?: string): Promise<string> {
        if (!this.hf_tokenizer) {
            await this.initialize();
        }

        const chat: Omit<ChatMessage, "id">[] = [];

        if (system_prompt) {
            chat.push({ role: "system", content: system_prompt });
        }

        chat.push({ role: "user", content });

        return this.hf_tokenizer!.apply_chat_template(chat, {
            tokenize: false,
            // adds the start of the assistant prompt (e.g. <|im_start|>assistant) so that
            // the model knows to start the assistant's response. This is required because
            // the model trains with the labels masked aside from the assistant tokens (assistant tags not included)
            add_generation_prompt: true,
        }) as string;
    }


    /**
     * Get the token length of the current chat session. Due to tokenizer specific
     * tokenization, this may be less than the current KV cache size.
     */
    public async size() {
        if (!this.hf_tokenizer) {
            await this.initialize();
        }

        return (this.hf_tokenizer!.apply_chat_template(this.message_history, {
            tokenize: true,
            return_dict: false,
            return_tensor: false,
        }) as number[]).length;
    }


    /**
     * The total number of system, user, and assistant chats thus far
     */
    public get length() {
        return this.message_history.length;
    }
}
