import GPTInterface from "@/features/training/gpt/interface";
import { Metadata } from "next";


export const metadata: Metadata = {
    title: `${process.env.NEXT_PUBLIC_PROJECT_NAME} | Create a GPT model`,
    description: "Train and run your own generative large language model in the browser, with your own hardware, while keeping your data private."
}


export default function App() {
    return <GPTInterface meta={{}} />
}
