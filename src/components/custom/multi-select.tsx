"use client"

import React from "react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuGroup
} from "@/components/ui/dropdown-menu"

import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";


export function MultiSelectOption({ className, ...props }: React.ComponentProps<typeof DropdownMenuItem>) {
    return (
        <DropdownMenuItem
            {...props}
            className={className}
        />
    )
}


/**
 * After upgrading the radix components dialog from 1.1.15 to 1.1.16 and
 * dropdown menu from 2.1.16 to 2.1.18, the DropdownMenu component's click away
 * would cause a parent Dialog component to also close, and scrolling broke.
 * 
 * Fix was to use modal=false and prevent the wheel event from propagating.
 */
export function MultiSelect({ label, children, maxRows, fullWidthMenu = true, id, className, ...props }: {
    label: React.JSX.Element | string;
    maxRows?: number;
    children: React.ReactNode;
    fullWidthMenu?: boolean;
    id?: string;
} & React.ComponentProps<"button">) {
    const [open, setOpen] = React.useState(false);

    const closeMenu = () => setOpen(false);
    const toggleMenu = () => setOpen(!open);

    return (
        <DropdownMenu
            modal={false} // prevents Dialog component from closing
            open={open} onOpenChange={undefined}
        >
            <div className={`w-full ${props.disabled ? "cursor-not-allowed" : ""}`}>
                <DropdownMenuTrigger
                    onClick={toggleMenu}
                    asChild
                    className="grow ring-0! focus:ring-0!"
                    id={id ?? undefined}
                >
                    {typeof label == "string"
                        ? <Button
                            variant="outline"
                            className={cn("flex justify-between h-auto font-normal w-full truncate min-w-0 flex-1", className)}
                            {...props}
                        >
                            <span className={`line-clamp-[${maxRows ?? "none"}] break-normal whitespace-pre-wrap text-start truncate`}>{label}</span>
                            <ChevronDown className="opacity-50 text-muted-foreground" />
                        </Button>
                        : label}
                </DropdownMenuTrigger>
            </div>

            <DropdownMenuContent
                onWheel={(e) => e.stopPropagation()} // restores scrolling
                onInteractOutside={closeMenu}
                onKeyDown={event => {
                    if (event.key == "Escape") {
                        closeMenu();
                    }
                }}
                id={id ? id + "-content" : undefined}
                className={fullWidthMenu ? "w-[var(--radix-dropdown-menu-trigger-width)]" : ""}
            >
                <DropdownMenuGroup>
                    {children}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
