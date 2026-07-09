"use client"

import React from "react";


interface ClickAwayListenerProps extends React.ComponentProps<"div"> {
    onClickAway?: (event: MouseEvent | TouchEvent | React.KeyboardEvent<HTMLDivElement>) => void;
    children: React.ReactNode;
    className?: string;
}


export default function ClickAwayListener({ onClickAway, children, ...div_props }: ClickAwayListenerProps) {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent | TouchEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClickAway?.(event);
            }
        }

        document.addEventListener("pointerup", handleClickOutside);

        return () => document.removeEventListener("pointerup", handleClickOutside);
    }, [onClickAway]);

    return <div ref={ref} {...div_props}>
        {children}
    </div>;
};
