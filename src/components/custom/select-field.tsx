import * as React from "react"

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";


export function SelectField({ placeholder, label, value, onValueChange, className, size, options, id, icon, readonly, ...props }: {
    value?: string;
    label?: string | React.JSX.Element
    onValueChange: (value: string) => void;
    options: string[] | { [key: string]: string };
    placeholder?: string;
    className?: string;
    size?: "sm" | "default" | undefined;
    id?: string;
    icon?: React.JSX.Element;
    readonly?: string[];
} & React.ComponentProps<"button">) {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger size={size} id={id} className={cn("w-full ring-0! focus:ring-0! text-start", className)} {...props} suppressHydrationWarning>
                {icon}
                <span className="truncate min-w-0 flex-1">
                    {/* {value != undefined ? label : undefined} */}<SelectValue id={id ? `${id}-label` : undefined} placeholder={placeholder} suppressHydrationWarning />
                </span>
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    {label && <SelectLabel>{label}</SelectLabel>}
                    {Array.isArray(options)
                        ? options.map((option, index) => (
                            <SelectItem disabled={readonly?.includes(option)} key={option + index} value={option}>{option}</SelectItem>
                        ))
                        : Object.keys(options).length > 0
                            ? Object.keys(options).map((option, index) => (
                                <SelectItem disabled={readonly?.includes(option)} key={option + index} value={option}>{options[option]}</SelectItem>
                            ))
                            : <></>}

                </SelectGroup>
            </SelectContent>
        </Select >
    )
}
