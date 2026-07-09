"use client"

import React from "react";

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogOverlay
} from "@/components/ui/dialog"

import { X as CloseIcon } from "lucide-react";


export interface ConfirmState {
    title?: string;
    description: string | React.JSX.Element;
    yes?: string;
    no?: string;
}


export interface NotifyState {
    title?: string;
    description: string | React.JSX.Element;
}


export interface ModalState {
    open: boolean;
    title?: string;
    description?: string | React.JSX.Element;
    yes?: string;
    no?: string;
}


export type ConfirmArgs = ({ title, description, yes, no }: ConfirmState) => Promise<boolean | undefined>;
export type NotifyArgs = (args: NotifyState | string) => Promise<void>;


export interface Dialogue {
    confirmation: ConfirmArgs;
    notify: NotifyArgs;
    Dialogue: () => React.JSX.Element;
}


const default_agree_label = "OK";
const default_decline_label = "Cancel";


/**
 * Confirmation, aka the action the user pressed the button for, should always be the "yes"
 * option which appears on the right, while the declination should always be the "no" 
 * option which appears to the left
 * 
 * * Implementation inspired by https://dev.to/brainrepo/a-pseudo-imperative-approach-for-react-confirmation-dialogs-3jcn
 */
export function useDialogue(): Dialogue {
    const [state, setState] = React.useState<ModalState & {
        confirm?: () => void;
        decline?: () => void;
        exit?: () => void;
    }>({
        open: false,
        yes: default_agree_label,
        no: default_decline_label
    });

    const auto_focus = React.useRef<HTMLButtonElement | null>(null);

    React.useEffect(() => {
        if (!state.open) {
            return;
        }
        requestAnimationFrame(() => auto_focus.current?.focus());
    }, [state.open])


    async function confirmation({ title, description, yes = default_agree_label, no = default_decline_label }: ConfirmState) {
        return new Promise<boolean | undefined>(resolve => {
            setState({
                open: true,
                title,
                description,
                yes,
                no,
                confirm: () => {
                    setState({ open: false });
                    resolve(true);
                },
                decline: () => {
                    setState({ open: false });
                    resolve(false);
                },
                exit: () => {
                    setState({ open: false });
                    resolve(undefined);
                }
            });
        });
    }


    async function notify(args: NotifyState | string) {
        const { title, description } = typeof args == "string"
            ? { title: undefined, description: args }
            : args;

        return new Promise<void>(resolve => {
            setState({
                open: true,
                title,
                description,
                yes: undefined,
                no: undefined,
                confirm: () => {
                    setState({ open: false });
                    resolve();
                },
                decline: () => {
                    setState({ open: false });
                    resolve();
                },
                exit: () => {
                    setState({ open: false });
                    resolve(undefined);
                }
            })
        })
    }

    const onConfirm = () => {
        state.confirm?.();
    }


    const onDecline = () => {
        state.decline?.();
    }

    const onNoAnswer = () => {
        state.exit?.();
    }


    function Dialogue() {
        return <>
            {state.open && <Dialog open={state.open} onOpenChange={onNoAnswer}>
                <DialogOverlay className="backdrop-blur-xs" />
                <DialogContent
                    className="bg-inherit border break-words whitespace-pre-wrap max-w-sm sm:max-w-3/4 md:max-w-3/4 lg:max-w-2xl"
                    onKeyDown={event => {
                        if (event.key === "Escape") {
                            onNoAnswer();
                            return;
                        }
                    }}
                    onOpenAutoFocus={e => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle className="flex justify-between">{state.title}
                            <div
                                data-slot="dialog-close"
                                className="ring-offset-background focus:ring-ring data-[state=open]:bg-theme data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                            >
                                <CloseIcon />
                                <span className="sr-only">Close</span>
                            </div>
                        </DialogTitle>
                        {
                            typeof state.description == "string"
                                ? <DialogDescription className="text-start wrap-anywhere">
                                    {state.description}
                                </DialogDescription>
                                :
                                <>
                                    <DialogDescription className="sr-only" />
                                    <div id="dialog-description">
                                        {state.description}
                                    </div>
                                </>
                        }
                    </DialogHeader>

                    <DialogFooter>
                        {!state.yes && !state.no
                            ? <Button ref={auto_focus} id="dialogue-close" onClick={onConfirm} className="cursor-pointer" variant="outline">Close</Button>
                            : <>
                                <Button id="dialogue-no" onClick={onDecline} className="cursor-pointer" variant="outline" type="submit">{state.no}</Button>
                                <Button ref={auto_focus} id="dialogue-yes" onClick={onConfirm} className="cursor-pointer" type="submit">{state.yes}</Button>
                            </>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>}
        </>
    }

    return { confirmation, notify, Dialogue }
}
