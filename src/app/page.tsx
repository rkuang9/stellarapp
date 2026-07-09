import Link from "next/link";

import {
    CodeXml,
    ExternalLink,
    Rocket,
    Share2,
    ShieldUser,
    Layers2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card";

import NavBar from "@/components/navbar";
import Footer from "@/components/footer";
import { discordURL, newModelURL, searchModelsURL } from "@/lib/utility";
import HuggingfaceLogo from "@/components/icons/huggingface";


export default function App() {
    return <div className="min-h-screen flex flex-col">
        <NavBar />

        <div className="flex flex-col grow gap-[2rem] px-3 md:px-4 lg:px-5">
            <HeroPanel />

            <Features />

            <About />

            <div className="h-[10vh]" />
        </div>

        <Footer />
    </div>
}


function HeroPanel() {
    return (
        <section className="relative overflow-hidden flex justify-center container mx-auto py-8 sm:py-16 max-w-5xl flex-col items-center text-center gap-2 xl:gap-4">
            <div className="text-theme p-4">
                <Layers2 size="3rem" />
            </div>

            <h1 className="text-primary leading-tighter text-4xl font-semibold tracking-tight text-balance lg:leading-[1.1] lg:font-semibold xl:text-5xl xl:tracking-tighter max-w-4xl">
                Create and Run AI in the Browser
            </h1>

            <p className="text-foreground max-w-5xl text-base text-wrap sm:text-lg">
                Train and run AI models in your browser. No code, no debugging, just model design. Everything stays on your device.
            </p>

            <div className="mt-6 flex justify-center gap-3 flex-col sm:flex-row w-full">
                <Button id="hero-get-started" size="lg" className="shadow-sm transition-shadow hover:shadow cursor-pointer bg-theme hover:bg-theme/80 px-8!" asChild>
                    <Link href={newModelURL()} prefetch={false}>
                        Start Now
                    </Link>
                </Button>
            </div>

        </section>
    );
};


const feature_cards_content: { label: string; description: string; icon: React.JSX.Element; available: boolean; url?: string; }[] = [
    {
        available: true,
        icon: <Layers2 className="text-[length:inherit] text-theme" />,
        label: "Large Language Models",
        description: "Train and fine-tune chatbots that become domain experts.",
    }, {
        available: true,
        icon: <HuggingfaceLogo className="text-[length:inherit]! size-7! text-theme" />,
        label: "Huggingface Datasets",
        description: "Load datasets from Huggingface for LLM pre-training and fine-tuning."
    }, {
        available: true,
        icon: <Rocket className="text-[length:inherit] text-theme" />,
        label: "Models In The Browser",
        description: "Create TensorFlow.js and WebGPU powered models in the browser.",
    }, {
        available: true,
        icon: <ShieldUser className="text-[length:inherit] text-theme" />,
        label: "Data Privacy",
        description: "No uploads, no data collection. Everything stays on your device.",
    }, {
        available: true,
        icon: <CodeXml className="text-[length:inherit] text-theme" />,
        label: "No Code",
        description: `No more debugging code. Just focus on your model design and dataset.`
    }, {
        available: true,
        icon: <Share2 className="text-[length:inherit] text-theme" />,
        label: "Save and Share Models",
        description: "Save, share, and fine-tune models from the community.",
    }
];


function Features() {
    return (
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center py-2">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {feature_cards_content.map(feature => {
                    const card_content = <Card key={feature.label} className="h-full w-full border-0 bg-elevated gap-6 dark:hover:bg-elevated/50">
                        <CardHeader className="flex gap-5 items-center">
                            {feature.icon} <h2 className="text-lg font-semibold">{feature.label}</h2>
                        </CardHeader>
                        <CardContent className="text-left">
                            <p className="text-muted-foreground leading-snug">
                                {feature.description}
                            </p>
                        </CardContent>
                    </Card>

                    return <div className="h-full w-full cursor-default" key={feature.label}>{card_content}</div>
                })}
            </div>
        </div>
    );
}


function About() {
    return <section id="about" className="container mx-auto max-w-4xl space-y-8 text-center py-2">

        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl lg:text-3xl">
            About
        </h2>

        <p className="text-muted-foreground max-w-4xl text-base text-balance">
            <b className="text-primary">{process.env.NEXT_PUBLIC_PROJECT_NAME} does not steal your training data nor collect information about you.</b>{" "}
            Instead of uploading your data to some remote server, model training and inference is done locally, using your device&apos;s hardware.
        </p>

        <p>
            Questions? Visit the <a id="about-discord" target="_blank" className="hover:underline text-theme" href={discordURL()}>Discord server</a>
        </p>

    </section>
}
