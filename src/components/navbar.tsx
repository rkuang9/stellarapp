"use client"

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Layers2,
    Menu
} from "lucide-react";

import { discordURL, newModelURL } from "@/lib/utility";


interface MenuItem {
    label: string;
    url: string;
    target?: "_blank" | "_self";
    id?: string;
}


export default function Navbar({ sticky = false, container = true }: { sticky?: boolean, container?: boolean }) {

    const menu_routes: MenuItem[] = [
        { label: "Start Now", url: newModelURL(), id: "new_model" },
        { label: "About", url: "/#about" },
        { label: "Discord", url: discordURL(), target: "_blank", id: "discord" },
    ];

    const logo_icon = <Link prefetch={false} href="/" id="home" className="flex items-center gap-2 pointer-cursor">
        <Layers2 className="text-theme" />

        <span className="text-2xl font-semibold tracking-wide">
            {process.env.NEXT_PUBLIC_PROJECT_NAME!}
        </span>
    </Link>;

    return (
        <section className={`p-3 md:px-4 lg:px-5 ${sticky ? "sticky" : "static"} top-0 bg-background-page z-[1000] ${container ? "container max-w-7xl mx-auto" : ""}`}>
            <div className="flex sm:hidden items-center justify-between">
                <div className="flex flex-row-reverse gap-4 items-center">
                    {logo_icon}

                    <Sheet>
                        <SheetTrigger id="mobile-navbar-sheet-trigger" asChild>
                            <Button id="mobile-navbar-sheet-trigger-button" variant="outline" className="bg-transparent!" size="icon" suppressHydrationWarning>
                                <Menu className="size-[1rem]" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent id="mobile-navbar-sheet-content" side="left" className="overflow-y-auto z-[9001]">
                            <SheetHeader>
                                <SheetTitle>
                                    {logo_icon}
                                </SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col gap-4 p-4">
                                {menu_routes.map(route => renderMobileItem(route))}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

            <nav className="hidden sm:flex items-center justify-between">
                {logo_icon}
                <div className="flex items-center gap-6">


                    <div className="flex items-center">
                        <NavigationMenu>
                            <NavigationMenuList>
                                {menu_routes.map(route => renderDesktopItem(route))}
                            </NavigationMenuList>
                        </NavigationMenu>
                    </div>
                </div>


            </nav>
        </section>
    )
};


function renderDesktopItem(route: MenuItem) {
    return <NavigationMenuItem key={route.label}>
        <Link
            id={route.id}
            target={route.target}
            prefetch={false}
            href={route.url}
            className="bg-transparent hover:bg-elevated rounded-md px-4 py-2 text-sm font-medium"
        >
            {route.label}
        </Link>
    </NavigationMenuItem>;
};

function renderMobileItem(route: MenuItem) {
    return (
        <Link
            key={route.label}
            target={route.target} prefetch={false}
            href={route.url}
            className="text-md font-semibold">
            {route.label}
        </Link>
    );
};
