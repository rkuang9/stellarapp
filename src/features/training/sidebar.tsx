"use client"

import * as React from "react"

import {
    Layers2,
    Download,
    CircleCheck,
    type LucideIcon
} from "lucide-react";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar
} from "@/components/ui/sidebar";


import { NotifyArgs } from "@/components/dialogue"
import { ProjectContext } from "@/features/training/project-contexts";
import { saveAs } from "@/lib/data-processing/model_io_handler";
import { useDialogue } from "@/components/dialogue";
import ProjectTypes, { ProjectFolderZipName } from "@/types/project_types";
import { Spinner } from "@/components/ui/spinner";
import { toaster } from "@/components/toaster";
import Link from "next/link";


const SERIALIZE_MODEL_ID = "model-download";

export const BREAKING_CHANGE_MSG = {
    title: "Breaking change found",
    description: "A change was made that is not compatible with the current trained model. Saving will delete the model. Continue?"
}


interface SectionStatus {
    [section: string]: boolean;
}


type Sections = {
    title: string;
    url: string;
    status: string;
    icon: LucideIcon;
}[]

const sidebar_entry_indent = "pl-3";


export default function ProjectSidebar({ sectionStatus, sections, ...props }: React.ComponentProps<typeof Sidebar> & {
    sectionStatus: SectionStatus,
    sections: Sections
}) {

    const { notify, Dialogue } = useDialogue();
    const { isMobile } = useSidebar();

    return (
        <Sidebar side={isMobile ? "right" : "left"} collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenuButton
                    asChild
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
                >
                    <a className="truncate font-medium"
                        // don't use Next.js's Link component because it bypasses the onbeforeunload event
                        href={"/"}
                    >
                        <div className="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                            <Layers2 className="size-4 text-theme" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate">{process.env.NEXT_PUBLIC_PROJECT_NAME}</span>
                            <span className="truncate text-xs text-muted-foreground">New model</span>
                        </div>
                    </a>
                </SidebarMenuButton>

            </SidebarHeader>


            <SidebarContent>
                <NavMain sections={sections} sectionStatus={sectionStatus} />
            </SidebarContent>


            <SidebarFooter>
                <Dialogue />
                <DownloadModel notify={notify} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}


export function NavMain({ sections, sectionStatus }: {
    sections: Sections
    sectionStatus: SectionStatus;
}) {
    const { project_config } = React.useContext(ProjectContext);
    const success_color = "text-success/85";
    const sidebar = useSidebar();

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel className={sidebar_entry_indent}>{ProjectTypes[project_config.project_type].label}</SidebarGroupLabel>
            <SidebarMenu>
                {sections.map(item => (
                    <SidebarMenuItem key={`section-${item.url}`}>
                        <SidebarMenuButton
                            id={`section-${item.url}`}
                            onClick={() => scrollToSection(item.url)}
                            tooltip={item.title}
                            className={`cursor-pointer ${sidebar_entry_indent}`} size={sidebar.open ? "lg" : "default"}>
                            {item.icon && <item.icon />}
                            <div className="flex gap-2 items-center">
                                <span>{item.title}</span>
                                {sectionStatus[item.status] === true && <div>
                                    <CircleCheck className={success_color} size={16} />
                                </div>}
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    )
}



function DownloadModel({ notify }: { notify: NotifyArgs }) {
    const { worker, project_config, meta, cache } = React.useContext(ProjectContext);
    const sidebar = useSidebar();
    const [download_progress, setDownloadProgress] = React.useState<number | undefined>(undefined);

    const download = () => {
        if (worker?.isTraining()) {
            notify({
                title: "Model is busy",
                description: `Wait until the model finishes ${worker.isTraining() ? "training" : "generating"} or stop it to continue.`
            });
            return;
        }

        const save_file_name = meta.project?.project_name ?? ProjectFolderZipName;

        toaster.info("Serializing the model, this may take a while", { duration: 5_000 });

        worker?.serialize(project_config, save_file_name).then(download_link => {
            saveAs(download_link, save_file_name);
        });
    }

    const label = download_progress && download_progress > 0 ? <div className="flex gap-2 items-center">
        <span>Downloading</span>
        <Spinner />
        <span>{(download_progress * 100).toFixed(0)}%</span>
    </div> : "Download Model";

    return <SidebarMenuItem>
        <SidebarMenuButton
            id={SERIALIZE_MODEL_ID}
            onClick={download}
            disabled={worker?.isTraining()}
            size={sidebar.open ? "lg" : "default"}
            className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer ${sidebar_entry_indent}`}
        >
            <Download className="size-4" />

            <div className="grid flex-1 text-left text-sm leading-tight">
                {label}
            </div>
        </SidebarMenuButton>
    </SidebarMenuItem>
}
