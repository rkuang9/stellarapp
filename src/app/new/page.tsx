import Link from "next/link";
import { Metadata } from "next";

import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { loginURL, newModelURL } from "@/lib/utility";
import ProjectTypes, { ProjectType } from "@/types/project_types";

import { Camera, ChartLine, Images, Languages } from "lucide-react";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from "@/components/ui/field"


export const metadata: Metadata = {
    title: `${process.env.NEXT_PUBLIC_PROJECT_NAME} | Create new model`,
    description: "Create and run new machine learning model in the browser."
}


const model_types = [
    {
        title: ProjectTypes[ProjectType.TEXT_GENERATION].label,
        description: ProjectTypes[ProjectType.TEXT_GENERATION].description,
        Icon: Languages,
        url: newModelURL(ProjectType.TEXT_GENERATION),
        id: ProjectType.TEXT_GENERATION,
    },
    {
        title: ProjectTypes[ProjectType.IMAGE_SEGMENTATION].label,
        description: ProjectTypes[ProjectType.IMAGE_SEGMENTATION].description,
        Icon: Images,
        url: newModelURL(ProjectType.IMAGE_SEGMENTATION),
        id: ProjectType.IMAGE_SEGMENTATION,
    },
    {
        title: ProjectTypes[ProjectType.TABULAR_REGRESSION].label,
        description: ProjectTypes[ProjectType.TABULAR_REGRESSION].description,
        Icon: ChartLine,
        url: newModelURL(ProjectType.TABULAR_REGRESSION),
        id: ProjectType.TABULAR_REGRESSION,
    },
    {
        title: ProjectTypes[ProjectType.IMAGE_CLASSIFICATION].label,
        description: ProjectTypes[ProjectType.IMAGE_CLASSIFICATION].description,
        Icon: Camera,
        url: newModelURL(ProjectType.IMAGE_CLASSIFICATION),
        id: ProjectType.IMAGE_CLASSIFICATION,
    },
];



export default async function NewModel() {

    return (
        <div className="h-screen flex flex-col">
            <Navbar />

            <div className="container mx-auto flex flex-col max-w-7xl gap-6 grow px-4 md:px-4 lg:px-5 items-center justify-center">

                <span className="text-pretty text-start text-2xl sm:text-3xl w-full md:max-w-2xl font-light">
                    What type of model do you want to train?
                </span>

                <div className="w-full md:max-w-2xl flex flex-col gap-6">
                    {model_types.map(model => <a id={model.id} href={model.url} key={model.title}>
                        <FieldLabel className="group bg-elevated dark:hover:bg-elevated/50 hover:cursor-pointer h-full">
                            <Field orientation="horizontal">
                                <FieldContent>
                                    <FieldTitle className="w-full flex grow justify-between text-lg group-hover:text-theme">{model.title}</FieldTitle>
                                    <FieldDescription className="">
                                        {model.description}
                                    </FieldDescription>
                                </FieldContent>

                                <FieldContent className="grow-0 h-full justify-center">
                                    <model.Icon className="size-8 group-hover:text-theme" />
                                </FieldContent>

                            </Field>
                        </FieldLabel>
                    </a>)}
                </div>

            </div>

            <Footer />
        </div>
    );
};

