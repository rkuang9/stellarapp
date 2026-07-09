import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"


export interface ContainerArgs {
    id?: string,
    heading: string,
    subheading?: string | React.JSX.Element,
    children: React.ReactNode,
    className?: string,
    icon?: LucideIcon,
    contentClassName?: string,
}


export function Container({
    id,
    heading,
    subheading,
    children,
    className = "",
    icon: Icon,
    contentClassName
}: ContainerArgs) {
    const pad = "px-0 md:px-4 lg:px-5";

    return <Card className={cn("container bg-transparent border-0 shadow-none", className)} id={id}>
        <CardHeader className={pad}>

            <CardTitle className="text-2xl sm:text-4xl flex items-center gap-3 font-medium">
                {Icon && <Icon className="shrink-0 size-6 sm:size-9" size={36} />}{heading}
            </CardTitle>

            {subheading && <CardDescription>
                {subheading}
            </CardDescription>}

        </CardHeader>
        
        <CardContent className={cn(`grow flex flex-col overflow-auto ${pad}`, contentClassName)}>
            {children}
        </CardContent>
    </Card>
}
